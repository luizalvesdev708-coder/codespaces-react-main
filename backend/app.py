import hashlib
import hmac
import csv
import io
import os
import secrets
import sqlite3
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from pathlib import Path

import jwt
from fastapi import Depends, FastAPI, File, Form, HTTPException, Response, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel


BASE_DIR = Path(__file__).resolve().parent
DATABASE_PATH = Path(os.getenv("DATABASE_PATH", BASE_DIR / "nexo.db"))
JWT_SECRET = os.getenv("JWT_SECRET", "change-this-development-secret")
JWT_ALGORITHM = "HS256"
TOKEN_MINUTES = int(os.getenv("TOKEN_MINUTES", "60"))
APP_ENV = os.getenv("APP_ENV", "PROD").upper()
APP_VERSION = os.getenv("APP_VERSION", "1.0.0")
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", BASE_DIR / "uploads"))
MAX_UPLOAD_BYTES = 10 * 1024 * 1024
ALLOWED_UPLOAD_TYPES = {"application/pdf", "image/png", "image/jpeg"}

ROLE_PERMISSIONS = {
    "SYSADMIN": {"*"},
    "Analista": {"segurados:read", "segurados:write", "qualidade:read", "integracoes:read"},
    "Auditor": {"segurados:read", "qualidade:read", "audit:read", "integracoes:read"},
    "Gestor Financeiro": {"segurados:read", "relatorios:read", "integracoes:read"},
    "Atuário": {"segurados:read", "relatorios:read", "qualidade:read", "integracoes:read"},
}

app = FastAPI(title="Nexo RPPS API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:3000").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
security = HTTPBearer()


class LoginRequest(BaseModel):
    email: str
    password: str
    otp: str | None = None


class TenantSwitchRequest(BaseModel):
    tenant_id: str


class SettingsRequest(BaseModel):
    auto_update: bool
    compact_mode: bool
    date_format: str
    required_fields: list[str]


class AuditActionRequest(BaseModel):
    action: str
    resource: str
    resource_id: str | None = None
    result: str = "success"


class SeguradoUpdate(BaseModel):
    status: str | None = None
    beneficio: str | None = None
    ente: str | None = None
    risk: str | None = None


def connect_db():
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def ensure_column(connection, table: str, column: str, definition: str):
    columns = {row[1] for row in connection.execute(f"PRAGMA table_info({table})")}
    if column not in columns:
        connection.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")


def hash_password(password: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 120_000)
    return f"{salt.hex()}${digest.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    salt_hex, digest_hex = stored_hash.split("$", 1)
    candidate = hashlib.pbkdf2_hmac(
        "sha256", password.encode(), bytes.fromhex(salt_hex), 120_000
    )
    return hmac.compare_digest(candidate.hex(), digest_hex)


def init_db():
    connection = connect_db()
    connection.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'SYSADMIN',
            tenant_id TEXT NOT NULL DEFAULT 'sp-rpps',
            auth_method TEXT NOT NULL DEFAULT 'local',
            mfa_enabled INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS tenants (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            environment TEXT NOT NULL,
            porte TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS segurados (
            id TEXT PRIMARY KEY,
            cpf TEXT NOT NULL,
            nome TEXT NOT NULL,
            status TEXT NOT NULL,
            beneficio TEXT NOT NULL,
            ente TEXT NOT NULL,
            risk TEXT NOT NULL,
            data TEXT NOT NULL,
            categoria TEXT NOT NULL,
            area TEXT NOT NULL,
            docHash TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            email TEXT NOT NULL,
            role TEXT NOT NULL,
            action TEXT NOT NULL,
            resource TEXT NOT NULL,
            resource_id TEXT,
            tenant_id TEXT NOT NULL,
            metadata TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS integrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            category TEXT NOT NULL,
            status TEXT NOT NULL,
            last_sync TEXT NOT NULL,
            latency_ms INTEGER NOT NULL,
            detail TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            severity TEXT NOT NULL,
            message TEXT NOT NULL,
            read INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS settings (
            tenant_id TEXT NOT NULL,
            setting_key TEXT NOT NULL,
            value TEXT NOT NULL,
            updated_by INTEGER,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (tenant_id, setting_key)
        );
        CREATE TABLE IF NOT EXISTS uploads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id TEXT NOT NULL,
            user_id INTEGER NOT NULL,
            segurado_id TEXT NOT NULL,
            filename TEXT NOT NULL,
            content_type TEXT NOT NULL,
            size_bytes INTEGER NOT NULL,
            path TEXT NOT NULL,
            status TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        """
    )
    ensure_column(connection, "users", "role", "TEXT NOT NULL DEFAULT 'SYSADMIN'")
    ensure_column(connection, "users", "tenant_id", "TEXT NOT NULL DEFAULT 'sp-rpps'")
    ensure_column(connection, "users", "auth_method", "TEXT NOT NULL DEFAULT 'local'")
    ensure_column(connection, "users", "mfa_enabled", "INTEGER NOT NULL DEFAULT 0")
    connection.execute(
        "INSERT OR IGNORE INTO tenants (id, name, environment, porte) VALUES (?, ?, ?, ?)",
        ("sp-rpps", "Instituto RPPS São Paulo", APP_ENV, "Grande"),
    )
    connection.execute(
        "INSERT OR IGNORE INTO tenants (id, name, environment, porte) VALUES (?, ?, ?, ?)",
        ("campinas-rpps", "Instituto RPPS Campinas", "HOMOLOG", "Médio"),
    )
    connection.execute(
        "INSERT OR IGNORE INTO users (email, name, password_hash, role, tenant_id, auth_method, mfa_enabled) VALUES (?, ?, ?, ?, ?, ?, ?)",
        ("sysadmin@rpps.sp.gov.br", "SYSADMIN", hash_password("admin123"), "SYSADMIN", "sp-rpps", "local", 0),
    )
    count = connection.execute("SELECT COUNT(*) FROM segurados").fetchone()[0]
    if count == 0:
        connection.executemany(
            "INSERT INTO segurados VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
                ("001", "123.456.789-00", "Ana Beatriz Silva", "Completo", "Ativo", "SP", "Baixo", "2026-04-20", "Aposentadoria", "São Paulo / SP", "8A9F71"),
                ("002", "987.654.321-11", "Carlos Souza Lima", "Pendente", "Aposentado", "RJ", "Médio", "2026-04-25", "Pensão", "Rio de Janeiro / RJ", "BB23AF"),
                ("003", "321.654.987-22", "Maria Eduarda Rocha", "Em Análise", "Pensionista", "MG", "Baixo", "2026-04-18", "Ativo", "Belo Horizonte / MG", "FC44C1"),
                ("004", "456.123.789-33", "José Martins Oliveira", "Rejeitado", "Ativo", "RS", "Alto", "2026-04-21", "Aposentadoria", "Porto Alegre / RS", "88EA0A"),
                ("005", "555.666.777-44", "Fernanda Paula Santos", "Completo", "Pensionista", "PR", "Baixo", "2026-04-15", "Pensão", "Curitiba / PR", "12CC33"),
                ("006", "111.222.333-55", "Pedro Henrique Costa", "Pendente", "Ativo", "BA", "Baixo", "2026-04-12", "Ativo", "Salvador / BA", "A7719B"),
            ],
        )
    connection.executemany(
        "INSERT OR IGNORE INTO integrations (name, category, status, last_sync, latency_ms, detail) VALUES (?, ?, ?, ?, ?, ?)",
        [
            ("e-Social", "Governo", "ok", "2026-04-20 09:42", 182, "Sincronizado"),
            ("CNIS", "Previdenciário", "ok", "2026-04-20 09:18", 245, "Sincronizado"),
            ("SICONFI", "Fiscal", "warning", "2026-04-19 16:15", 640, "5 pendências"),
            ("Banco de dados", "Infraestrutura", "ok", "2026-04-20 10:30", 38, "Disponível"),
        ],
    )
    connection.execute(
        "INSERT INTO notifications (title, severity, message) SELECT ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM notifications)",
        ("MFA recomendado", "warning", "Configure MFA antes de promover este ambiente para produção."),
    )
    connection.commit()
    connection.close()


def create_token(user, tenant_id: str | None = None) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user["id"]),
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
        "tenant_id": tenant_id or user["tenant_id"],
        "iat": now,
        "exp": now + timedelta(minutes=TOKEN_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError as error:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido ou expirado") from error

    connection = connect_db()
    user = connection.execute("SELECT id, email, name, role, tenant_id, auth_method, mfa_enabled FROM users WHERE id = ?", (payload["sub"],)).fetchone()
    connection.close()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuário não encontrado")
    current = dict(user)
    current["tenant_id"] = payload.get("tenant_id", current["tenant_id"])
    return current


def require_permission(permission: str):
    def dependency(user=Depends(current_user)):
        permissions = ROLE_PERMISSIONS.get(user["role"], set())
        if "*" not in permissions and permission not in permissions:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Perfil sem permissão para este módulo")
        return user
    return dependency


def audit_event(user, action: str, resource: str, resource_id: str | None = None, metadata: str | None = None):
    connection = connect_db()
    connection.execute(
        "INSERT INTO audit_logs (user_id, email, role, action, resource, resource_id, tenant_id, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (user["id"], user["email"], user["role"], action, resource, resource_id, user["tenant_id"], metadata),
    )
    connection.commit()
    connection.close()


@app.on_event("startup")
def startup():
    init_db()
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@app.get("/")
def root():
    return {"name": app.title, "status": "ok", "health": "/api/health"}


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/auth/login")
def login(request: LoginRequest):
    connection = connect_db()
    user = connection.execute("SELECT * FROM users WHERE email = ?", (request.email.lower().strip(),)).fetchone()
    connection.close()
    if user is None or not verify_password(request.password, user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="E-mail ou senha inválidos")
    user_data = {"id": user["id"], "email": user["email"], "name": user["name"], "role": user["role"], "tenant_id": user["tenant_id"], "auth_method": user["auth_method"], "mfa_enabled": bool(user["mfa_enabled"]), "permissions": sorted(ROLE_PERMISSIONS.get(user["role"], set()))}
    audit_event(user_data, "login", "auth")
    return {"access_token": create_token(user), "token_type": "bearer", "user": user_data}


@app.get("/api/auth/me")
def me(user=Depends(current_user)):
    return user


@app.get("/api/context")
def context(user=Depends(current_user)):
    connection = connect_db()
    tenant = connection.execute("SELECT * FROM tenants WHERE id = ?", (user["tenant_id"],)).fetchone()
    tenants = connection.execute("SELECT id, name, environment, porte FROM tenants ORDER BY name").fetchall()
    connection.close()
    return {"environment": APP_ENV, "version": APP_VERSION, "tenant": dict(tenant), "tenants": [dict(item) for item in tenants], "roles": sorted(ROLE_PERMISSIONS), "mfa_required": os.getenv("REQUIRE_MFA", "false").lower() == "true"}


@app.post("/api/context/switch")
def switch_context(request: TenantSwitchRequest, user=Depends(current_user)):
    connection = connect_db()
    tenant = connection.execute("SELECT * FROM tenants WHERE id = ?", (request.tenant_id,)).fetchone()
    connection.close()
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instância não encontrada")
    switched_user = {**user, "tenant_id": tenant["id"]}
    audit_event(switched_user, "switch", "tenant", tenant["id"])
    return {"access_token": create_token(switched_user), "token_type": "bearer", "user": switched_user}


@app.get("/api/segurados")
def segurados(user=Depends(require_permission("segurados:read"))):
    connection = connect_db()
    rows = connection.execute("SELECT * FROM segurados ORDER BY id").fetchall()
    connection.close()
    audit_event(user, "read", "segurados")
    return {"items": [dict(row) for row in rows], "total": len(rows)}


@app.post("/api/audit/action")
def audit_action(request: AuditActionRequest, user=Depends(current_user)):
    audit_event(user, request.action, request.resource, request.resource_id, f"result:{request.result}")
    return {"recorded": True}


@app.put("/api/segurados/{segurado_id}")
def update_segurado(segurado_id: str, request: SeguradoUpdate, user=Depends(require_permission("segurados:write"))):
    values = {key: value for key, value in request.model_dump().items() if value is not None}
    if not values:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Nenhum campo para atualizar")
    connection = connect_db()
    existing = connection.execute("SELECT id FROM segurados WHERE id = ?", (segurado_id,)).fetchone()
    if existing is None:
        connection.close()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Segurado não encontrado")
    assignments = ", ".join(f"{key} = ?" for key in values)
    connection.execute(f"UPDATE segurados SET {assignments} WHERE id = ?", [*values.values(), segurado_id])
    connection.commit()
    connection.close()
    audit_event(user, "update", "segurado", segurado_id, f"fields:{','.join(values)}")
    return {"saved": True, "id": segurado_id}


@app.get("/api/audit")
def audit(limit: int = 50, user=Depends(require_permission("audit:read"))):
    connection = connect_db()
    rows = connection.execute("SELECT * FROM audit_logs WHERE tenant_id = ? ORDER BY id DESC LIMIT ?", (user["tenant_id"], min(limit, 200))).fetchall()
    connection.close()
    return {"items": [dict(row) for row in rows]}


@app.get("/api/integrations")
def integrations(user=Depends(require_permission("integracoes:read"))):
    connection = connect_db()
    rows = connection.execute("SELECT * FROM integrations ORDER BY id").fetchall()
    connection.close()
    return {"items": [dict(row) for row in rows]}


@app.get("/api/notifications")
def notifications(user=Depends(current_user)):
    connection = connect_db()
    rows = connection.execute("SELECT * FROM notifications ORDER BY id DESC LIMIT 20").fetchall()
    connection.close()
    return {"items": [dict(row) for row in rows]}


@app.get("/api/settings")
def get_settings(user=Depends(current_user)):
    connection = connect_db()
    rows = connection.execute("SELECT setting_key, value FROM settings WHERE tenant_id = ?", (user["tenant_id"],)).fetchall()
    connection.close()
    values = {row["setting_key"]: row["value"] for row in rows}
    return {
        "auto_update": values.get("auto_update", "true") == "true",
        "compact_mode": values.get("compact_mode", "false") == "true",
        "date_format": values.get("date_format", "br"),
        "required_fields": values.get("required_fields", "cpf,nome,beneficio").split(","),
    }


@app.put("/api/settings")
def save_settings(request: SettingsRequest, user=Depends(current_user)):
    if request.date_format not in {"br", "iso"} or not request.required_fields:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Configuração de preenchimento inválida")
    allowed_fields = {"cpf", "nome", "beneficio", "ente", "data"}
    if any(field not in allowed_fields for field in request.required_fields):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Campo obrigatório não suportado")
    values = {
        "auto_update": "true" if request.auto_update else "false",
        "compact_mode": "true" if request.compact_mode else "false",
        "date_format": request.date_format,
        "required_fields": ",".join(request.required_fields),
    }
    connection = connect_db()
    connection.executemany(
        "INSERT INTO settings (tenant_id, setting_key, value, updated_by, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(tenant_id, setting_key) DO UPDATE SET value=excluded.value, updated_by=excluded.updated_by, updated_at=CURRENT_TIMESTAMP",
        [(user["tenant_id"], key, value, user["id"]) for key, value in values.items()],
    )
    connection.commit()
    connection.close()
    audit_event(user, "update", "settings", metadata="filling-rules")
    return {**request.model_dump(), "saved": True}


@app.post("/api/uploads")
async def upload_document(
    file: UploadFile = File(...),
    segurado_id: str = Form(...),
    user=Depends(current_user),
):
    if file.content_type not in ALLOWED_UPLOAD_TYPES:
        audit_event(user, "upload_error", "document", segurado_id, f"type:{file.content_type}")
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Formato inválido. Use PDF, PNG ou JPEG.")
    content = await file.read()
    if not content or len(content) > MAX_UPLOAD_BYTES:
        audit_event(user, "upload_error", "document", segurado_id, "size-limit")
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Arquivo vazio ou maior que 10 MB.")
    safe_name = Path(file.filename or "documento").name
    stored_name = f"{secrets.token_hex(8)}-{safe_name}"
    destination = UPLOAD_DIR / stored_name
    destination.write_bytes(content)
    connection = connect_db()
    cursor = connection.execute(
        "INSERT INTO uploads (tenant_id, user_id, segurado_id, filename, content_type, size_bytes, path, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (user["tenant_id"], user["id"], segurado_id, safe_name, file.content_type, len(content), str(destination), "confirmed"),
    )
    connection.commit()
    connection.close()
    audit_event(user, "upload", "document", segurado_id, f"file:{safe_name};bytes:{len(content)}")
    return {"id": cursor.lastrowid, "filename": safe_name, "size_bytes": len(content), "status": "confirmed"}


@app.get("/api/segurados/export.csv")
def export_segurados(user=Depends(require_permission("relatorios:read"))):
    connection = connect_db()
    rows = connection.execute("SELECT cpf, nome, beneficio, ente, status, data, risk FROM segurados ORDER BY id").fetchall()
    connection.close()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["CPF", "Nome", "Benefício", "Ente", "Status", "Data", "Risco"])
    writer.writerows([tuple(row) for row in rows])
    audit_event(user, "export", "segurados", metadata="csv")
    return Response(content="\ufeff" + output.getvalue(), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=segurados.csv"})


@app.get("/api/segurados/export.xml")
def export_segurados_xml(user=Depends(require_permission("relatorios:read"))):
    connection = connect_db()
    rows = connection.execute("SELECT cpf, nome, beneficio, ente, status, data, risk FROM segurados ORDER BY id").fetchall()
    connection.close()
    root = ET.Element("rpps", {"tenant": user["tenant_id"], "version": APP_VERSION})
    for row in rows:
        item = ET.SubElement(root, "segurado")
        for key, value in dict(row).items():
            ET.SubElement(item, key).text = str(value)
    audit_event(user, "export", "segurados", metadata="xml")
    return Response(content=ET.tostring(root, encoding="unicode"), media_type="application/xml", headers={"Content-Disposition": "attachment; filename=segurados.xml"})