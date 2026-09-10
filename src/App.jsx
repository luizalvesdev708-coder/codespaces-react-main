import React, { useEffect, useMemo, useState } from 'react';
import './App.css';

const segurados = [
  { id: '001', cpf: '123.456.789-00', nome: 'Ana Beatriz Silva', status: 'Completo', beneficio: 'Ativo', ente: 'SP', risk: 'Baixo', data: '2026-04-20', categoria: 'Aposentadoria', area: 'São Paulo / SP', docHash: '8A9F71' },
  { id: '002', cpf: '987.654.321-11', nome: 'Carlos Souza Lima', status: 'Pendente', beneficio: 'Aposentado', ente: 'RJ', risk: 'Médio', data: '2026-04-25', categoria: 'Pensão', area: 'Rio de Janeiro / RJ', docHash: 'BB23AF' },
  { id: '003', cpf: '321.654.987-22', nome: 'Maria Eduarda Rocha', status: 'Em Análise', beneficio: 'Pensionista', ente: 'MG', risk: 'Baixo', data: '2026-04-18', categoria: 'Ativo', area: 'Belo Horizonte / MG', docHash: 'FC44C1' },
  { id: '004', cpf: '456.123.789-33', nome: 'José Martins Oliveira', status: 'Rejeitado', beneficio: 'Ativo', ente: 'RS', risk: 'Alto', data: '2026-04-21', categoria: 'Aposentadoria', area: 'Porto Alegre / RS', docHash: '88EA0A' },
  { id: '005', cpf: '555.666.777-44', nome: 'Fernanda Paula Santos', status: 'Completo', beneficio: 'Pensionista', ente: 'PR', risk: 'Baixo', data: '2026-04-15', categoria: 'Pensão', area: 'Curitiba / PR', docHash: '12CC33' },
  { id: '006', cpf: '111.222.333-55', nome: 'Pedro Henrique Costa', status: 'Pendente', beneficio: 'Ativo', ente: 'BA', risk: 'Baixo', data: '2026-04-12', categoria: 'Ativo', area: 'Salvador / BA', docHash: 'A7719B' },
];

const adminTabs = [
  { label: 'Home', route: 'home' },
  { label: 'Desempenho', route: 'dashboard' },
  { label: 'Qualidade', route: 'qualidade' },
  { label: 'Compliance', route: 'compliance' },
  { label: 'Relatórios', route: 'relatorios' },
];

const side = [
  { route: 'home', label: 'Home', icon: '▦' },
  { route: 'dashboard', label: 'Dashboard', icon: '▣' },
  { route: 'cadastros', label: 'Cadastros', icon: '☰' },
  { route: 'integracoes', label: 'Integrações', icon: '⇄' },
  { route: 'qualidade', label: 'Qualidade', icon: '✦' },
  { route: 'compliance', label: 'Compliance', icon: '✓' },
  { route: 'relatorios', label: 'Relatórios', icon: '⇩' },
  { route: 'recadastramento', label: 'Recadastramento', icon: '◌' },
];

function App() {
  const [route, setRoute] = useState('login');
  const [mode, setMode] = useState('clear');
  const [session, setSession] = useState(() => {
    const stored = JSON.parse(localStorage.getItem('nexo_session') || 'null');
    if (!stored) return null;
    return { ...stored, user: { ...stored.user, role: stored.user.role || 'SYSADMIN', tenant_id: stored.user.tenant_id || 'sp-rpps' } };
  });

  function handleLogin(loginSession) {
    localStorage.setItem('nexo_session', JSON.stringify(loginSession));
    setSession(loginSession);
    setRoute('home');
  }

  function handleLogout() {
    recordAction(session?.access_token, 'logout', 'auth');
    localStorage.removeItem('nexo_session');
    setSession(null);
    setRoute('login');
  }

  function handleSessionUpdate(updatedSession) {
    localStorage.setItem('nexo_session', JSON.stringify(updatedSession));
    setSession(updatedSession);
  }

  return (
    <div className={mode === 'night' ? 'nexo-app night' : 'nexo-app'}>
      {!session ? (
        <LoginPage onLogin={handleLogin} />
      ) : (
        <Shell route={route} setRoute={setRoute} mode={mode} setMode={setMode} session={session} onLogout={handleLogout} onSessionUpdate={handleSessionUpdate} />
      )}
    </div>
  );
}

function Shell({ route, setRoute, mode, setMode, session, onLogout, onSessionUpdate }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [compactMode, setCompactMode] = useState(false);
  const [context, setContext] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [activeTenant, setActiveTenant] = useState(session.user.tenant_id);
  const [integrationHealth, setIntegrationHealth] = useState(null);
  const [auditCount, setAuditCount] = useState(null);

  useEffect(() => {
    const headers = { Authorization: `Bearer ${session.access_token}` };
    Promise.all([
      fetch('/api/context', { headers }).then((response) => response.json()),
      fetch('/api/notifications', { headers }).then((response) => response.json()),
      fetch('/api/integrations', { headers }).then((response) => response.json()),
      fetch('/api/audit?limit=1', { headers }).then((response) => response.ok ? response.json() : { items: [] }),
    ]).then(([contextData, notificationData, integrationData, auditData]) => {
      setContext(contextData);
      setActiveTenant(contextData.tenant.id);
      setNotifications(notificationData.items || []);
      const integrationItems = integrationData.items || [];
      setIntegrationHealth(integrationItems.length > 0 && integrationItems.every((item) => item.status === 'ok') ? 'ok' : 'warning');
      setAuditCount(auditData.items?.length || 0);
    }).catch(() => {});
  }, [session.access_token]);

  async function switchTenant(event) {
    const tenantId = event.target.value;
    const response = await fetch('/api/context/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ tenant_id: tenantId }),
    });
    if (response.ok) {
      const updatedSession = await response.json();
      onSessionUpdate(updatedSession);
    }
  }

  function navigate(nextRoute, action = 'navigate') {
    recordAction(session.access_token, action, 'route', nextRoute);
    setRoute(nextRoute);
  }

  return (
    <div className={`console-shell ${compactMode ? 'compact-mode' : ''}`}>
      <aside className="console-sidebar">
        <div className="brandbox">
          <div className="logo-block"><span className="logo-c">C</span><span className="logo-text">CENSO <b>&lt;/&gt;</b> DOTAL</span></div>
          <div className="brand-sub">RPPS</div>
        </div>
        <div className="side-title">NEXO OPERATIVE</div>
        <nav className="side-nav">
          {side.map((s) => (
            <button key={s.route} className={`side-link ${route === s.route ? 'selected' : ''}`} onClick={() => navigate(s.route)}>
              <span className="side-icon">{s.icon}</span>
              <span>{s.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-status">
          <span className="tiny-label">INSTANCE</span>
          <span className="status-online">{activeTenant.toUpperCase()} · {context?.environment || 'PROD'}</span>
        </div>
      </aside>
      <section className="app-workspace">
        <div className={`environment-banner ${(context?.environment || 'PROD').toLowerCase()}`}>
          <b>{context?.environment || 'PROD'}</b><span>Ambiente protegido · ações são registradas na trilha de auditoria</span><span>v{context?.version || '1.0.0'}</span>
        </div>
        <header className="topbar">
          <div className="topbar-left">
            <div className="crumb">RPPS / <span>{route}</span></div>
            <div className="topbar-title">Enterprise Console</div>
          </div>
          <div className="topbar-right">
            <label className="tenant-switcher" title="Instância ativa"><span>INSTÂNCIA</span><select value={activeTenant} onChange={switchTenant} aria-label="Selecionar instância">
              {(context?.tenants || [{ id: session.user.tenant_id, name: 'RPPS São Paulo', environment: 'PROD', porte: 'Grande' }]).map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}
            </select></label>
            <button className="header-status" onClick={() => navigate('integracoes', 'open_integrations')} title="Abrir status das integrações"><span className={`status-pulse ${integrationHealth || 'unknown'}`}></span><span><b>Integrações</b><small>{integrationHealth === 'ok' ? 'Operacionais' : integrationHealth === 'warning' ? 'Atenção' : 'Verificando'}</small></span></button>
            <button className="header-status" onClick={() => navigate('compliance', 'open_audit')} title="Abrir trilha de auditoria"><span className="audit-mark">✓</span><span><b>Auditoria</b><small>{auditCount === null ? 'Verificando' : `${auditCount} evento recente`}</small></span></button>
            <button className="icon-button" onClick={() => navigate('cadastros', 'search')} title="Pesquisar segurados" aria-label="Pesquisar segurados">⌕</button>
            <button className="icon-button notification-button" onClick={() => { recordAction(session.access_token, 'open', 'notifications'); setNotificationsOpen(!notificationsOpen); }} title="Notificações" aria-label="Notificações">♢{notifications.filter((item) => !item.read).length > 0 && <b>{notifications.filter((item) => !item.read).length}</b>}</button>
            <button className="icon-button" onClick={() => { recordAction(session.access_token, 'open', 'settings'); setSettingsOpen(!settingsOpen); }} title="Configurar console" aria-label="Configurar console">⚙</button>
            <button className="mode-button" onClick={() => { recordAction(session.access_token, 'change_theme', 'console'); setMode(mode === 'clear' ? 'night' : 'clear'); }} title="Alternar aparência">{mode === 'clear' ? 'Modo Claro' : 'Modo Escuro'}</button>
            <button className="userbox" onClick={onLogout} title="Sair">
              <span className="user-avatar">SYS</span>
              <div>
                <span className="user-name">{session.user.name}</span>
                <span className="user-ente">{session.user.role} · São Paulo</span>
              </div>
            </button>
          </div>
        </header>
        {notificationsOpen && <NotificationPanel notifications={notifications} onClose={() => setNotificationsOpen(false)} />}

        <nav className="tabbar">
          {adminTabs.map((tab) => (
            <button key={tab.route} className={`tab ${route === tab.route ? 'active' : ''}`} onClick={() => navigate(tab.route)}>{tab.label}</button>
          ))}
        </nav>

        <main className="main-content">
          {route === 'home' && <HomePage setRoute={navigate} token={session.access_token} />}
          {route === 'dashboard' && <DashboardPage token={session.access_token} />}
          {route === 'cadastros' && <CadastrosPage setRoute={setRoute} token={session.access_token} />}
          {route === 'integracoes' && <IntegracoesPage token={session.access_token} />}
          {route === 'qualidade' && <QualidadePage token={session.access_token} />}
          {route === 'compliance' && <CompliancePage token={session.access_token} />}
          {route === 'relatorios' && <RelatoriosPage token={session.access_token} />}
          {route === 'recadastramento' && <RecadastramentoPage token={session.access_token} />}
          {route.startsWith('cadastro') && <CadastroDetailPage token={session.access_token} />}
        </main>
        {settingsOpen && <SettingsPanel compactMode={compactMode} setCompactMode={setCompactMode} context={context} session={session} onClose={() => setSettingsOpen(false)} />}
      </section>
    </div>
  );
}

function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('sysadmin@rpps.sp.gov.br');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Não foi possível autenticar');
      onLogin(data);
    } catch (requestError) {
      setError(requestError.message || 'API indisponível. Inicie o backend.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-screen">
      <section className="login-panel">
        <div className="login-header">
          <span className="logo-c login-logo">C</span>
          <div>
            <div className="login-brand">CENSO <b>&lt;/&gt;</b> DOTAL</div>
            <div className="login-caption">RPPS · GOVERNANÇA PREVIDENCIÁRIA</div>
          </div>
        </div>
        <div className="login-body">
          <div className="login-title">Acesso Administrativo</div>
          <div className="login-subtitle">Autenticação de Console</div>
          <form className="login-form" onSubmit={submit}>
            <label className="login-label">Usuário</label>
            <input className="login-input" value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
            <label className="login-label">Senha</label>
            <input className="login-input" value={password} onChange={(event) => setPassword(event.target.value)} type="password" required />
            <label className="login-label">Código 2FA</label>
            <input className="login-input otp" value="482197" readOnly />
            <div className="login-actions">
              <button className="primary-button" type="submit" disabled={loading}>{loading ? 'Autenticando...' : 'Entrar no Console'}</button>
              <button className="secondary-button" type="button" onClick={() => setError('Código de demonstração: 482197')}>Solicitar Código</button>
            </div>
            {error && <div className="login-error" role="alert">{error}</div>}
          </form>
        </div>
      </section>
    </div>
  );
}

function HomePage({ setRoute, token }) {
  const [lastUpdated, setLastUpdated] = useState('17:10:44');
  const [refreshing, setRefreshing] = useState(false);

  function refreshHealth() {
    setRefreshing(true);
    recordAction(token, 'refresh', 'health');
    window.setTimeout(() => {
      setLastUpdated(new Date().toLocaleTimeString('pt-BR'));
      setRefreshing(false);
    }, 450);
  }

  return (
    <section className="page-grid">
      <section className="section-head">
        <div>
          <div className="section-kicker">Home / Diagnostic Console</div>
          <div className="section-title">Painel Geral de Recadastramento</div>
        </div>
        <div className="section-action">
          <span className="sync-tag">Último alinhamento: {lastUpdated}</span>
          <button className="primary-button smart-button" onClick={refreshHealth} disabled={refreshing}>{refreshing ? 'Atualizando...' : 'Atualizar dados'}</button>
        </div>
      </section>

      <section className="metric-strip">
        <MetricCard label="Censos concluídos" value="86.42%" trend="+2.6" unit="p.p." tone="ok" trendTone="ok" />
        <MetricCard label="Pendentes" value="312" trend="+18" unit="casos" tone="warn" trendTone="danger" />
        <MetricCard label="Inconsistências" value="47" trend="-12" unit="casos" tone="ok" trendTone="ok" />
        <MetricCard label="Provas de vida" value="92.03%" trend="+1.2" unit="p.p." tone="blue" trendTone="ok" />
      </section>

      <section className="canvas-grid">
        <article className="panel donut-panel">
          <div className="panel-head">
            <span className="panel-title">Status do Censo</span>
            <span className="panel-chip green">ONLINE</span>
          </div>
          <div className="donut-wrap">
            <div className="donut-chart">
              <span className="donut-center"><b>14.477</b><small>segurados</small></span>
            </div>
            <div className="legend-list">
              <div><span className="legend-dot ok"></span><span>Concluídos</span><b>86% · 12.450</b></div>
              <div><span className="legend-dot warn"></span><span>Pendentes</span><b>8% · 1.158</b></div>
              <div><span className="legend-dot red"></span><span>Inconsistências</span><b>6% · 869</b></div>
            </div>
          </div>
        </article>

        <article className="panel diagnostic-panel">
          <div className="panel-head">
            <span className="panel-title">Diagnostic Summary</span>
            <span className="panel-chip red">03 ALERTAS</span>
          </div>
          <div className="severity-legend"><span><i className="critical"></i>Crítico</span><span><i className="warning"></i>Atenção</span><span><i className="informative"></i>Informativo</span></div>
          <div className="alerts">
            <div className="alert-row critical-row"><span className="sev critical">!</span><span><b>Óbitos não notificados</b><small>Requer ação imediata</small></span><span className="alert-num">07</span><button className="alert-action" onClick={() => setRoute('qualidade')}>Resolver</button></div>
            <div className="alert-row"><span className="sev warn">!</span><span><b>Divergência folha</b><small>Conferir dados sincronizados</small></span><span className="alert-num">12</span><button className="alert-action" onClick={() => setRoute('integracoes')}>Ver detalhes</button></div>
            <div className="alert-row"><span className="sev info">!</span><span><b>Provas de vida expiradas</b><small>Convidar segurados ao portal</small></span><span className="alert-num">23</span><button className="alert-action" onClick={() => setRoute('recadastramento')}>Ver detalhes</button></div>
          </div>
        </article>

        <article className="panel funds-panel">
          <div className="panel-head">
            <span className="panel-title">Capacidade operacional</span>
            <span className="panel-chip blue">USO ATUAL</span>
          </div>
          <p className="panel-note">Uso de capacidade por domínio do sistema.</p>
          <div className="fund-table">
            <div className="fund-row" title="Percentual de registros previdenciários processados"><span>Fundos RPPS</span><div className="mini-bar"><span className="bar-green" style={{ width: '76%' }}></span></div><b>76%</b></div>
            <div className="fund-row" title="Percentual de liquidez conciliada"><span>Liquidez RPPS</span><div className="mini-bar"><span className="bar-blue" style={{ width: '68%' }}></span></div><b>68%</b></div>
            <div className="fund-row" title="Percentual da folha sincronizada"><span>Folha core</span><div className="mini-bar"><span className="bar-amber" style={{ width: '84%' }}></span></div><b>84%</b></div>
          </div>
        </article>
      </section>
    </section>
  );
}

function DashboardPage({ token }) {
  const [rows, setRows] = useState([]);
  const [state, setState] = useState('loading');
  const [lastUpdated, setLastUpdated] = useState('');

  async function loadDashboard() {
    setState('loading');
    try {
      const response = await fetch('/api/segurados', { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error('Não foi possível carregar os indicadores.');
      const data = await response.json();
      setRows(data.items || []);
      setLastUpdated(new Date().toLocaleTimeString('pt-BR'));
      setState('ready');
      recordAction(token, 'refresh', 'dashboard');
    } catch {
      setState('error');
    }
  }

  useEffect(() => { loadDashboard(); }, [token]);

  const total = rows.length || 1;
  const complete = rows.filter((row) => row.status === 'Completo').length;
  const pending = rows.filter((row) => row.status === 'Pendente').length;
  const analyzing = rows.filter((row) => row.status === 'Em Análise').length;
  const rejected = rows.filter((row) => row.status === 'Rejeitado').length;

  return (
    <section className="page-grid">
      <section className="section-head">
        <div>
          <div className="section-kicker">Desempenho / Dashboard</div>
          <div className="section-title">Dashboard de Operação</div>
        </div>
        <div className="section-action"><span className="sync-tag">{state === 'error' ? 'Falha na API' : lastUpdated ? `Atualizado às ${lastUpdated}` : 'Carregando...'}</span><button className="primary-button" onClick={loadDashboard} disabled={state === 'loading'}>{state === 'loading' ? 'Atualizando...' : 'Atualizar dashboard'}</button></div>
      </section>
      <section className="metric-strip">
        <MetricCard label="Completo" value={complete} trend="+12.5" unit="casos" tone="ok" trendTone="ok" />
        <MetricCard label="Pendentes" value={pending} trend="+8.1" unit="casos" tone="warn" trendTone="danger" />
        <MetricCard label="Em análise" value={analyzing} trend="-2.4" unit="casos" tone="blue" trendTone="ok" />
        <MetricCard label="Rejeitados" value={rejected} trend="-1.2" unit="casos" tone="danger" trendTone="ok" />
      </section>
      <section className="analytics-grid">
        <article className="panel">
          <div className="panel-head"><span className="panel-title">Qualidade Cadastral</span><span className="panel-chip green">{Math.round((complete / total) * 100)}%</span></div>
          <div className="progress-stack">
            <div className="progress-line"><span>Identificação</span><div className="mini-bar"><span className="bar-blue" style={{ width: '96%' }}></span></div><b>96%</b></div>
            <div className="progress-line"><span>Endereço</span><div className="mini-bar"><span className="bar-green" style={{ width: '89%' }}></span></div><b>89%</b></div>
            <div className="progress-line"><span>Dependentes</span><div className="mini-bar"><span className="bar-amber" style={{ width: '82%' }}></span></div><b>82%</b></div>
            <div className="progress-line"><span>Documentos</span><div className="mini-bar"><span className="bar-red" style={{ width: '91%' }}></span></div><b>91%</b></div>
          </div>
        </article>
        <article className="panel">
          <div className="panel-head"><span className="panel-title">Atividade Mensal</span><span className="panel-chip blue">Acompanhamento</span></div>
          <div className="bar-chart">
            {[50,80,65,90,70,86,72,96,88,76,82,68].map((v, i) => <span key={i} className="bar" style={{ height: `${v}%` }}></span>)}
          </div>
        </article>
      </section>
    </section>
  );
}

function CadastrosPage({ setRoute, token }) {
  const [rows, setRows] = useState(segurados);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/segurados', { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Falha ao carregar segurados')))
      .then((data) => setRows(data.items))
      .catch(() => setRows(segurados));
  }, [token]);

  const filteredRows = rows.filter((row) => `${row.nome} ${row.cpf}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <section className="page-grid">
      <section className="section-head">
        <div>
          <div className="section-kicker">Cadastros / Data Grid</div>
          <div className="section-title">Gestão de Segurados</div>
        </div>
        <div className="section-action">
          <input className="search-input" placeholder="Buscar CPF / Nome" value={search} onChange={(event) => setSearch(event.target.value)} />
          <button className="primary-button smart-button" onClick={() => setRoute('cadastro-new')}>+ Novo</button>
        </div>
      </section>
      <section className="panel table-panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>CPF</th><th>Nome</th><th>Benefício</th><th>Ente</th><th>Status</th><th>Data</th><th>Risco</th><th>Acao</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((s) => (
              <tr key={s.id}>
                <td>{maskCpf(s.cpf)}</td>
                <td>{s.nome}</td>
                <td>{s.beneficio}</td>
                <td>{s.ente}</td>
                <td><span className={`badge ${statusClass(s.status)}`}>{s.status}</span></td>
                <td>{formatDate(s.data)}</td>
                <td><span className={`risk risk-${riskClass(s.risk)}`}>{s.risk}</span></td>
                <td><button className="tiny-button" onClick={() => setRoute('cadastro-' + s.id)}>Visualizar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </section>
  );
}

function CadastroDetailPage({ token }) {
  const segurado = segurados[0];
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadState, setUploadState] = useState({ status: 'idle', progress: 0, message: '' });
  const [saveState, setSaveState] = useState('idle');

  function validateFile(file) {
    if (!file) return 'Selecione um arquivo.';
    if (!['application/pdf', 'image/png', 'image/jpeg'].includes(file.type)) return 'Formato inválido. Use PDF, PNG ou JPEG.';
    if (file.size > 10 * 1024 * 1024) return 'O arquivo deve ter no máximo 10 MB.';
    return '';
  }

  function chooseFile(file) {
    const error = validateFile(file);
    setSelectedFile(error ? null : file);
    setUploadState(error ? { status: 'error', progress: 0, message: error } : { status: 'ready', progress: 0, message: 'Arquivo pronto para envio.' });
  }

  function uploadFile() {
    const error = validateFile(selectedFile);
    if (error) return setUploadState({ status: 'error', progress: 0, message: error });
    const request = new XMLHttpRequest();
    const body = new FormData();
    body.append('file', selectedFile);
    body.append('segurado_id', segurado.id);
    request.open('POST', '/api/uploads');
    request.setRequestHeader('Authorization', `Bearer ${token}`);
    request.upload.onprogress = (event) => event.lengthComputable && setUploadState({ status: 'uploading', progress: Math.round((event.loaded / event.total) * 100), message: 'Enviando documento...' });
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        const data = JSON.parse(request.responseText);
        setUploadState({ status: 'success', progress: 100, message: `${data.filename} confirmado (${formatBytes(data.size_bytes)}).` });
      } else {
        let message = 'Falha ao enviar documento.';
        try { message = JSON.parse(request.responseText).detail || message; } catch {}
        setUploadState({ status: 'error', progress: 0, message });
      }
    };
    request.onerror = () => setUploadState({ status: 'error', progress: 0, message: 'Falha de conexão. Tente novamente.' });
    request.ontimeout = () => setUploadState({ status: 'error', progress: 0, message: 'Tempo limite excedido. Tente novamente.' });
    request.timeout = 30000;
    setUploadState({ status: 'uploading', progress: 0, message: 'Enviando documento...' });
    request.send(body);
  }

  async function saveCadastro() {
    setSaveState('saving');
    const response = await fetch(`/api/segurados/${segurado.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ status: segurado.status, beneficio: segurado.beneficio, ente: segurado.ente, risk: segurado.risk }) });
    setSaveState(response.ok ? 'success' : 'error');
  }

  return (
    <section className="page-grid">
      <section className="section-head">
        <div>
          <div className="section-kicker">Cadastro / Ficha do Segurado</div>
          <div className="section-title">Inspeção: {segurado.nome}</div>
        </div>
        <div className="section-action">
          <button className="secondary-button" onClick={() => recordAction(token, 'view', 'segurado', segurado.id)}>Auditar</button>
          <button className="primary-button smart-button" onClick={saveCadastro} disabled={saveState === 'saving'}>{saveState === 'saving' ? 'Salvando...' : 'Salvar'}</button>
          {saveState === 'success' && <span className="inline-success">Salvo e auditado.</span>}
          {saveState === 'error' && <span className="inline-error">Não foi possível salvar.</span>}
        </div>
      </section>
      <section className="detail-grid">
        <article className="panel detail-card">
          <div className="panel-head"><span className="panel-title">Dados do Segurado</span><span className="panel-chip green">{segurado.status}</span></div>
          <div className="detail-list">
            <div className="detail-row"><span>CPF</span><b>{maskCpf(segurado.cpf)}</b></div>
            <div className="detail-row"><span>Benefício</span><b>{segurado.beneficio}</b></div>
            <div className="detail-row"><span>Ente</span><b>{segurado.area}</b></div>
            <div className="detail-row"><span>Dependentes</span><b>02</b></div>
            <div className="detail-row"><span>Hash Doc.</span><b>{segurado.docHash}</b></div>
          </div>
        </article>
        <article className="panel upload-panel">
          <div className="panel-head"><span className="panel-title">Upload de Documentos</span><span className="panel-chip blue">Hash OK</span></div>
          <div className="drop-zone" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); chooseFile(event.dataTransfer.files[0]); }}>
            <span className="drop-icon">⇪</span>
            <span className="drop-title">Arraste documentos</span>
            <input id="document-file" className="file-input" type="file" accept="application/pdf,image/png,image/jpeg" onChange={(event) => chooseFile(event.target.files[0])} />
            <label className="secondary-button small-button" htmlFor="document-file">Selecionar</label>
            {selectedFile && <span className="upload-file-name">{selectedFile.name} · {formatBytes(selectedFile.size)}</span>}
            {selectedFile && uploadState.status !== 'success' && <button className="primary-button small-button" type="button" onClick={uploadFile} disabled={uploadState.status === 'uploading'}>{uploadState.status === 'uploading' ? 'Enviando...' : 'Enviar documento'}</button>}
            {uploadState.status === 'uploading' && <progress className="upload-progress" value={uploadState.progress} max="100">{uploadState.progress}%</progress>}
            {uploadState.message && <span className={`upload-feedback ${uploadState.status}`}>{uploadState.message}</span>}
            {uploadState.status === 'error' && selectedFile && <button className="tiny-button" type="button" onClick={uploadFile}>Tentar novamente</button>}
          </div>
          <div className="doc-list">
            <div className="doc-row"><span>RG_ana_beatriz.pdf</span><span className="doc-size">84KB</span><span className="doc-progress"><span style={{ width: '78%' }}></span></span></div>
            <div className="doc-row"><span>Comprovante_residencial.png</span><span className="doc-size">202KB</span><span className="doc-progress"><span style={{ width: '62%' }}></span></span></div>
          </div>
        </article>
      </section>
    </section>
  );
}

function IntegracoesPage({ token }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    fetch('/api/integrations', { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then((data) => setItems(data.items || []))
      .catch(() => {});
  }, [token]);

  return (
    <section className="page-grid">
      <section className="section-head"><div><div className="section-kicker">Integrações / Health Check</div><div className="section-title">Sistemas Vinculados</div></div><span className="sync-tag">Atualização em tempo real</span></section>
      <section className="panel table-panel">
        <table className="data-table">
          <thead><tr><th>Sistema</th><th>Status</th><th>Última sync</th><th>Detalhe</th></tr></thead>
          <tbody>
            {(items.length ? items : [{ name: 'Carregando...', status: 'warning', last_sync: '-', detail: 'Consultando API' }]).map((item) => <tr key={item.id || item.name}><td><b>{item.name}</b><small className="table-subtext">{item.category}</small></td><td><span className={`badge ${item.status === 'ok' ? 'success' : 'warning'}`}>{item.status === 'ok' ? 'Saudável' : 'Atenção'}</span></td><td>{item.last_sync}</td><td>{item.detail} · {item.latency_ms} ms</td></tr>)}
          </tbody>
        </table>
      </section>
    </section>
  );
}

function QualidadePage({ token }) {
  const rows = [
    { origem: 'Endereço', segurado: 'Ana B. Silva', detalhe: 'CEP divergente', sev: 'Critical', status: 'Pendente' },
    { origem: 'Dependente', segurado: 'Carlos Souza', detalhe: 'Documento ausente', sev: 'Warning', status: 'Em análise' },
    { origem: 'CPF', segurado: 'Maria E. Rocha', detalhe: 'Validação em resumo', sev: 'OK', status: 'Resolvido' },
  ];
  const [resolved, setResolved] = useState({});

  async function resolve(index) {
    await recordAction(token, 'resolve', 'inconsistencia', String(index));
    setResolved((current) => ({ ...current, [index]: true }));
  }
  return (
    <section className="page-grid">
      <section className="section-head"><div><div className="section-kicker">Qualidade de Dados</div><div className="section-title">Inconsistências e Correções</div></div></section>
      <section className="panel table-panel">
        <table className="data-table">
          <thead><tr><th>Origem</th><th>Segurado</th><th>Detalhe</th><th>Severidade</th><th>Status</th><th>Ação</th></tr></thead>
          <tbody>
            {rows.map((r, index) => <tr key={r.origem}><td>{r.origem}</td><td>{r.segurado}</td><td>{r.detalhe}</td><td><span className={`badge ${r.sev === 'Critical' ? 'danger' : r.sev==='Warning' ? 'warning' : 'success'}`}>{r.sev}</span></td><td>{resolved[index] ? 'Resolvido' : r.status}</td><td><button className="tiny-button" onClick={() => resolve(index)} disabled={resolved[index]}>{resolved[index] ? 'Resolvido' : 'Corrigir'}</button></td></tr>)}
          </tbody>
        </table>
      </section>
    </section>
  );
}

function CompliancePage({ token }) {
  const rows = [
    { hora: '2026-04-20 10:44:12', usuario: 'SYSADMIN', evento: 'Aprovação cadastro', ip: '10.24.45.38', status: 'OK' },
    { hora: '2026-04-20 10:03:53', usuario: 'João Silva', evento: 'Correção de documento', ip: '10.24.45.19', status: 'OK' },
    { hora: '2026-04-20 09:58:02', usuario: 'Sistema NEXO', evento: 'Sincronização eSocial', ip: '172.18.0.12', status: 'ALERT' },
  ];
  const [auditRows, setAuditRows] = useState(rows);

  useEffect(() => {
    fetch('/api/audit', { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Sem permissão')))
      .then((data) => setAuditRows(data.items.map((item) => ({ hora: item.created_at, usuario: item.email, evento: `${item.action} · ${item.resource}`, ip: item.tenant_id, status: 'OK' }))))
      .catch(() => setAuditRows(rows));
  }, [token]);

  return (
    <section className="page-grid">
      <section className="section-head"><div><div className="section-kicker">Compliance / Audit</div><div className="section-title">Audit Trail</div></div><span className="sync-tag">Retenção e rastreabilidade por usuário</span></section>
      <section className="panel table-panel">
        <table className="data-table">
          <thead><tr><th>Horário</th><th>Usuário</th><th>Evento</th><th>IP</th><th>Status</th></tr></thead>
          <tbody>
            {auditRows.map((r, index) => <tr key={`${r.hora}-${index}`}><td>{r.hora}</td><td>{r.usuario}</td><td>{r.evento}</td><td>{r.ip}</td><td><span className={`badge ${r.status === 'ALERT' ? 'warning' : 'success'}`}>{r.status}</span></td></tr>)}
          </tbody>
        </table>
      </section>
    </section>
  );
}

function RelatoriosPage({ token }) {
  const [reportState, setReportState] = useState({ status: 'idle', message: '' });

  async function downloadReport(path, filename) {
    setReportState({ status: 'loading', message: 'Gerando relatório...' });
    try {
      const response = await fetch(path, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) {
        let detail = `A API respondeu HTTP ${response.status}.`;
        try { detail = (await response.json()).detail || detail; } catch {}
        throw new Error(detail);
      }
      downloadBlob(await response.blob(), filename);
      setReportState({ status: 'success', message: `${filename} gerado com sucesso.` });
      recordAction(token, 'export', 'segurados', null, filename);
    } catch (error) {
      setReportState({ status: 'error', message: `Não foi possível gerar o relatório: ${error.message}` });
    }
  }

  return (
    <section className="page-grid">
      <section className="section-head">
        <div><div className="section-kicker">Relatórios</div><div className="section-title">Exportação</div></div>
      </section>
      <section className="panel report-form-panel">
        <div className="report-form">
          <label>Período<select className="select-input"><option>01/04/2026 - 30/04/2026</option></select></label>
          <label>Tipo de Benefício<select className="select-input"><option>Ativo</option><option>Aposentado</option><option>Pensionista</option></select></label>
        </div>
        <div className="report-actions">
          <button className="primary-button" type="button" onClick={() => { recordAction(token, 'export', 'segurados', null, 'print-pdf'); window.print(); }}>Download PDF</button>
          <button className="secondary-button" type="button" onClick={() => downloadReport('/api/segurados/export.csv', 'segurados.csv')} disabled={reportState.status === 'loading'}>Download CSV</button>
          <button className="secondary-button" type="button" onClick={() => downloadReport('/api/segurados/export.xml', 'segurados.xml')} disabled={reportState.status === 'loading'}>Layout XML</button>
        </div>
        {reportState.message && <div className={`report-feedback ${reportState.status}`} role={reportState.status === 'error' ? 'alert' : 'status'}>{reportState.message}</div>}
      </section>
    </section>
  );
}

function RecadastramentoPage({ token }) {
  const [step, setStep] = useState(1);
  const [cpf, setCpf] = useState('123.456.789-00');
  const [birthDate, setBirthDate] = useState('1990-05-12');
  const [code, setCode] = useState('482197');
  const [address, setAddress] = useState('Rua do Comércio, 99');
  const [dependents, setDependents] = useState('02');
  const [done, setDone] = useState(false);
  return (
    <section className="page-grid recadastramento-page">
      <section className="section-head">
        <div><div className="section-kicker">Portal de Prova de Vida</div><div className="section-title">Recadastramento</div></div>
      </section>
      <section className="recadastramento-panel">
        <div className="steps">
          {[1,2,3,4].map((n) => <span key={n} className={`step ${step >= n ? 'chosen' : ''}`}>{n}</span>)}
        </div>
        {step === 1 && <div className="rec-step"><div className="step-title">Passo 01 · CPF e Data de Nascimento</div><label className="login-label">CPF</label><input className="login-input" value={cpf} onChange={(event) => setCpf(event.target.value)} /><label className="login-label">Data</label><input className="login-input" type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} /></div>}
        {step === 2 && <div className="rec-step"><div className="step-title">Passo 02 · Código de Confirmação</div><label className="login-label">Código SMS/Email</label><input className="login-input" value={code} onChange={(event) => setCode(event.target.value)} /><span className="small-text">Código enviado para +55 11 99999-9842</span></div>}
        {step === 3 && <div className="rec-step"><div className="step-title">Passo 03 · Atualização de Dados</div><label className="login-label">Endereco</label><input className="login-input" value={address} onChange={(event) => setAddress(event.target.value)} /><label className="login-label">Dependentes</label><input className="login-input" value={dependents} onChange={(event) => setDependents(event.target.value)} /></div>}
        {step === 4 && <div className="rec-step"><div className="step-title">Passo 04 · Comprovante</div><div className="proof"><span className="qr-box">QR</span><div><b>Comprovante final</b><p>Solicitação concluída.</p><p>Código: NEXO-2026-1049</p></div></div></div>}
        <div className="step-actions">
          {step > 1 && <button className="secondary-button" onClick={() => setStep(step - 1)}>Voltar</button>}
          {step < 4 && <button className="primary-button" onClick={() => { recordAction(token, 'advance', 'recadastramento', String(step)); setStep(step + 1); }}>Avançar</button>}
          {step === 4 && <button className="primary-button" onClick={() => { recordAction(token, 'complete', 'recadastramento'); setDone(true); }}>Finalizar</button>}
          {done && <span className="inline-success">Solicitação registrada.</span>}
        </div>
      </section>
    </section>
  );
}

function MetricCard({ label, value, trend, unit, tone, trendTone = tone }) {
  return (
    <article className="metric-card">
      <div className="metric-card-head">
        <span className="metric-label">{label}</span>
        <span className={`metric-icon ${tone}`}>●</span>
      </div>
      <div className="metric-value">{value}</div>
      <div className="metric-trend">
        <span className={`trend ${trendTone}`}>{trend}</span> <span className="trend-unit">{unit} no período</span>
      </div>
    </article>
  );
}

function NotificationPanel({ notifications, onClose }) {
  return (
    <aside className="notification-panel" aria-label="Central de notificações">
      <div className="settings-head"><div><span className="section-kicker">Central</span><h2>Notificações</h2></div><button className="close-button" onClick={onClose} aria-label="Fechar notificações">×</button></div>
      {notifications.length === 0 ? <p className="panel-note">Nenhuma notificação pendente.</p> : notifications.map((item) => <div className="notification-item" key={item.id}><span className={`notification-dot ${item.severity}`}></span><div><b>{item.title}</b><p>{item.message}</p><small>{item.created_at}</small></div></div>)}
    </aside>
  );
}

function SettingsPanel({ compactMode, setCompactMode, context, session, onClose }) {
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [autoUpdate, setAutoUpdate] = useState(true);
  const [dateFormat, setDateFormat] = useState('br');
  const [requiredFields, setRequiredFields] = useState(['cpf', 'nome', 'beneficio']);

  useEffect(() => {
    fetch('/api/settings', { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then((response) => response.json())
      .then((data) => { setAutoUpdate(data.auto_update); setDateFormat(data.date_format); setRequiredFields(data.required_fields); })
      .catch(() => setError('Não foi possível carregar as configurações salvas.'));
  }, [session.access_token]);

  async function saveSettings(event) {
    event.preventDefault();
    setError('');
    if (!requiredFields.length) return setError('Selecione ao menos um campo obrigatório.');
    const response = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ auto_update: autoUpdate, compact_mode: compactMode, date_format: dateFormat, required_fields: requiredFields }),
    });
    if (!response.ok) {
      const data = await response.json();
      return setError(data.detail || 'Não foi possível salvar as configurações.');
    }
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  }

  function toggleRequired(field) {
    setRequiredFields((current) => current.includes(field) ? current.filter((item) => item !== field) : [...current, field]);
  }

  return (
    <aside className="settings-panel" aria-label="Configurações do console">
      <div className="settings-head"><div><span className="section-kicker">Console / Configuração</span><h2>Preferências do sistema</h2></div><button className="close-button" onClick={onClose} aria-label="Fechar configurações">×</button></div>
      <form onSubmit={saveSettings}>
        <div className="identity-summary"><b>{context?.tenant?.name || 'Instituto RPPS'}</b><span>{context?.tenant?.porte || 'Grande'} · {context?.environment || 'PROD'}</span><span>Perfil: {session.user.role}</span><span className={context?.mfa_required ? 'security-warning' : ''}>{context?.mfa_required ? 'MFA obrigatório' : 'MFA recomendado'} · {context?.version || '1.0.0'}</span></div>
        <label className="setting-toggle"><input type="checkbox" checked={autoUpdate} onChange={(event) => setAutoUpdate(event.target.checked)} /> <span><b>Atualização automática</b><small>Sincronizar os indicadores a cada 5 minutos.</small></span></label>
        <label className="setting-toggle"><input type="checkbox" checked={compactMode} onChange={(event) => setCompactMode(event.target.checked)} /> <span><b>Modo compacto</b><small>Reduzir o espaçamento para exibir mais dados.</small></span></label>
        <fieldset className="setting-field"><legend>Campos obrigatórios no preenchimento</legend>{[['cpf', 'CPF'], ['nome', 'Nome'], ['beneficio', 'Benefício'], ['ente', 'Ente'], ['data', 'Data']].map(([field, label]) => <label key={field}><input type="checkbox" checked={requiredFields.includes(field)} onChange={() => toggleRequired(field)} /> {label}</label>)}</fieldset>
        <label className="setting-field">Formato de data<select className="select-input" value={dateFormat} onChange={(event) => setDateFormat(event.target.value)}><option value="br">DD/MM/AAAA</option><option value="iso">AAAA-MM-DD</option></select></label>
        <div className="settings-actions"><button className="secondary-button" type="button" onClick={() => setCompactMode(false)}>Restaurar padrão</button><button className="primary-button" type="submit">Aplicar alterações</button></div>
        {saved && <span className="settings-saved" role="status">Alterações aplicadas.</span>}
        {error && <span className="settings-error" role="alert">{error}</span>}
      </form>
    </aside>
  );
}

function maskCpf(cpf) {
  return cpf.replace(/\d(?!\d{0,2}$)/g, '*');
}

function statusClass(status) {
  return status.toLowerCase().replace(/\s/g, '-');
}

function riskClass(risk) {
  if (risk === 'Alto') return 'high';
  if (risk === 'Médio') return 'medium';
  return 'low';
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('pt-BR');
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function recordAction(token, action, resource, resourceId = null, result = 'success') {
  if (!token) return;
  try {
    await fetch('/api/audit/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, resource, resource_id: resourceId, result }),
    });
  } catch {
    // Auditoria não deve bloquear a operação visual quando a API estiver indisponível.
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default App;
