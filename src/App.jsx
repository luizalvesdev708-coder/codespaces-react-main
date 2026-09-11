import React, { useEffect, useMemo, useState } from 'react';
import './App.css';
import { getChannelState, setChannelPaused, subscribe } from './realtime';

function useRealtime(channel, initialValue = null) {
  const [value, setValue] = useState(initialValue);
  const [meta, setMeta] = useState(() => getChannelState(channel));
  useEffect(() => subscribe(channel, (event) => { setValue(event.payload); setMeta({ ...getChannelState(channel), lastUpdate: event.receivedAt }); }), [channel]);
  return { value, meta, pause: () => setChannelPaused(channel, true), resume: () => setChannelPaused(channel, false) };
}

function RealtimeStatus({ meta }) {
  const status = meta?.status || 'connected';
  return <span className={`realtime-status ${status}`} title={`${status} · ${meta?.lastUpdate ? new Date(meta.lastUpdate).toLocaleTimeString('pt-BR') : 'aguardando'}`}><i></i>{status === 'reconnecting' ? 'Reconectando' : status === 'paused' ? 'Pausado' : status === 'offline' ? 'Offline' : 'Ao vivo'}</span>;
}

const segurados = [
  { id: '001', cpf: '123.456.789-00', nome: 'Ana Beatriz Silva', status: 'Completo', beneficio: 'Ativo', ente: 'SP', risk: 'Baixo', data: '2026-04-20', categoria: 'Aposentadoria', area: 'São Paulo / SP', docHash: '8A9F71' },
  { id: '002', cpf: '987.654.321-11', nome: 'Carlos Souza Lima', status: 'Pendente', beneficio: 'Aposentado', ente: 'RJ', risk: 'Médio', data: '2026-04-25', categoria: 'Pensão', area: 'Rio de Janeiro / RJ', docHash: 'BB23AF' },
  { id: '003', cpf: '321.654.987-22', nome: 'Maria Eduarda Rocha', status: 'Em Análise', beneficio: 'Pensionista', ente: 'MG', risk: 'Baixo', data: '2026-04-18', categoria: 'Ativo', area: 'Belo Horizonte / MG', docHash: 'FC44C1' },
  { id: '004', cpf: '456.123.789-33', nome: 'José Martins Oliveira', status: 'Rejeitado', beneficio: 'Ativo', ente: 'RS', risk: 'Alto', data: '2026-04-21', categoria: 'Aposentadoria', area: 'Porto Alegre / RS', docHash: '88EA0A' },
  { id: '005', cpf: '555.666.777-44', nome: 'Fernanda Paula Santos', status: 'Completo', beneficio: 'Pensionista', ente: 'PR', risk: 'Baixo', data: '2026-04-15', categoria: 'Pensão', area: 'Curitiba / PR', docHash: '12CC33' },
  { id: '006', cpf: '111.222.333-55', nome: 'Pedro Henrique Costa', status: 'Pendente', beneficio: 'Ativo', ente: 'BA', risk: 'Baixo', data: '2026-04-12', categoria: 'Ativo', area: 'Salvador / BA', docHash: 'A7719B' },
];

const adminTabs = [
  { label: 'Início', route: 'home' },
  { label: 'Desempenho', route: 'dashboard' },
  { label: 'Qualidade', route: 'qualidade' },
  { label: 'Compliance', route: 'compliance' },
  { label: 'Relatórios', route: 'relatorios' },
];

const side = [
  { route: 'home', label: 'Painel', icon: '⌂' },
  { route: 'dashboard', label: 'Análises', icon: '◒' },
  { route: 'cadastros', label: 'Cadastros', icon: '⊞' },
  { route: 'integracoes', label: 'Integrações', icon: '⇄' },
  { route: 'qualidade', label: 'Qualidade', icon: '✦' },
  { route: 'compliance', label: 'Compliance', icon: '✓' },
];

const operativePages = [
  { route: 'operative', label: 'Visão geral', icon: '◈' },
  { route: 'operative/servers', label: 'Servidores', icon: '▣' },
  { route: 'operative/database', label: 'Banco de dados', icon: '▤' },
  { route: 'operative/pending', label: 'Pendentes', icon: '◷' },
  { route: 'operative/query', label: 'Consulta', icon: '⌕' },
];

function App() {
  const [route, setRoute] = useState(() => window.location.hash.replace(/^#\/?/, '') || 'login');
  const [mode, setMode] = useState(() => {
    const stored = localStorage.getItem('nexo_mode');
    return stored === 'night' ? 'dark' : stored === 'clear' ? 'light' : stored || 'dark';
  });
  const [systemMode, setSystemMode] = useState(() => window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  const [toast, setToast] = useState(null);
  const [session, setSession] = useState(() => {
    let stored = null;
    try { stored = JSON.parse(localStorage.getItem('nexo_session') || 'null'); } catch { localStorage.removeItem('nexo_session'); }
    if (!stored) return null;
    return { ...stored, user: { ...stored.user, role: stored.user.role || 'SYSADMIN', tenant_id: stored.user.tenant_id || 'sp-rpps' } };
  });

  const resolvedMode = mode === 'auto' ? systemMode : mode;
  useEffect(() => { localStorage.setItem('nexo_mode', mode); }, [mode]);
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: light)');
    if (!media) return undefined;
    const update = (event) => setSystemMode(event.matches ? 'light' : 'dark');
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = resolvedMode; }, [resolvedMode]);
  useEffect(() => {
    function onHashChange() { setRoute(window.location.hash.replace(/^#\/?/, '') || 'home'); }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  useEffect(() => {
    if (!session?.access_token) return undefined;
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then((response) => { if (!response.ok) throw new Error('expired'); })
      .catch(() => { localStorage.removeItem('nexo_session'); setSession(null); setRoute('login'); setToast({ type: 'warning', message: 'Sua sessão expirou. Entre novamente.' }); });
    return undefined;
  }, [session?.access_token]);
  useEffect(() => { if (!toast) return undefined; const timer = window.setTimeout(() => setToast(null), 4200); return () => window.clearTimeout(timer); }, [toast]);

  function handleLogin(loginSession) {
    localStorage.setItem('nexo_session', JSON.stringify(loginSession));
    setSession(loginSession);
    setRoute('home');
    window.location.hash = 'home';
    setToast({ type: 'success', message: 'Login realizado. Bem-vindo ao console.' });
  }

  function handleLogout() {
    if (!window.confirm('Deseja realmente sair do console?')) return;
    recordAction(session?.access_token, 'logout', 'auth');
    localStorage.removeItem('nexo_session');
    setSession(null);
    setRoute('login');
    window.location.hash = 'login';
  }

  function handleSessionUpdate(updatedSession) {
    localStorage.setItem('nexo_session', JSON.stringify(updatedSession));
    setSession(updatedSession);
  }

  return (
    <div className={`nexo-app ${resolvedMode === 'dark' ? 'night' : 'light'}`} data-theme={resolvedMode}>
      {!session ? (
        <LoginPage onLogin={handleLogin} onToast={setToast} />
      ) : (
        <Shell route={route} setRoute={setRoute} mode={mode} resolvedMode={resolvedMode} setMode={setMode} session={session} onLogout={handleLogout} onSessionUpdate={handleSessionUpdate} onToast={setToast} />
      )}
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  );
}

function Shell({ route, setRoute, mode, resolvedMode, setMode, session, onLogout, onSessionUpdate, onToast }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [compactMode, setCompactMode] = useState(false);
  const [context, setContext] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [activeTenant, setActiveTenant] = useState(session.user.tenant_id);
  const [integrationHealth, setIntegrationHealth] = useState(null);
  const [auditCount, setAuditCount] = useState(null);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [operativeOpen, setOperativeOpen] = useState(route.startsWith('operative'));
  const liveLogs = useRealtime('logs');
  const [logs, setLogs] = useState([]);
  const [logsOpen, setLogsOpen] = useState(false);

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
  useEffect(() => {
    function onKeyDown(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setGlobalSearchOpen(true); }
      if (event.key === 'Escape') { setGlobalSearchOpen(false); setSidebarOpen(false); }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
  useEffect(() => {
    function closeOverlays(event) {
      const target = event.target;
      if (notificationsOpen && !target.closest('.notification-panel') && !target.closest('.notification-button')) setNotificationsOpen(false);
      if (settingsOpen && !target.closest('.settings-panel') && !target.closest('[title="Configurar console"]')) setSettingsOpen(false);
    }
    document.addEventListener('mousedown', closeOverlays);
    return () => document.removeEventListener('mousedown', closeOverlays);
  }, [notificationsOpen, settingsOpen]);
  useEffect(() => { if (!liveLogs.value) return; setLogs((current) => [liveLogs.value, ...current].slice(0, 250)); }, [liveLogs.value]);

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
    window.location.hash = nextRoute;
    setSidebarOpen(false);
  }

  return (
    <div className={`console-shell ${compactMode ? 'compact-mode' : ''} ${resolvedMode === 'light' ? 'light-mode' : ''}`} data-theme={resolvedMode}>
      <aside className={`console-sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="brandbox">
          <div className="logo-block"><img className="dotal-logo" src="/dotal-logo.svg" alt="Dotal consultoria" /></div>
          <div className="brand-sub">NEXO OPERATIVE · RPPS</div>
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
        <button className={`operative-nav-toggle ${route.startsWith('operative') ? 'selected' : ''}`} onClick={() => setOperativeOpen(!operativeOpen)}><span className="side-icon">⌘</span><span>Nexo Operative</span><b>{operativeOpen ? '−' : '+'}</b></button>
        {operativeOpen && <nav className="operative-subnav" aria-label="Nexo Operative"><span className="operative-caption">CENTRO OPERACIONAL</span>{operativePages.map((page) => <button key={page.route} className={`side-link operative-link ${route === page.route ? 'selected' : ''}`} onClick={() => navigate(page.route)}><span className="side-icon">{page.icon}</span><span>{page.label}</span></button>)}</nav>}
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
          <button className="mobile-menu-button" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Abrir menu">☰</button>
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
            <button className="live-header-status" onClick={() => setLogsOpen(!logsOpen)} title="Abrir logs em tempo real"><RealtimeStatus meta={liveLogs.meta} /></button>
            <button className="icon-button search-trigger" onClick={() => setGlobalSearchOpen(true)} title="Busca global (Cmd+K)" aria-label="Busca global">⌕</button>
            <button className="icon-button notification-button" onClick={() => { recordAction(session.access_token, 'open', 'notifications'); setNotificationsOpen(!notificationsOpen); }} title="Notificações" aria-label="Notificações">♢{notifications.filter((item) => !item.read).length > 0 && <b>{notifications.filter((item) => !item.read).length}</b>}</button>
            <button className="icon-button" onClick={() => { recordAction(session.access_token, 'open', 'settings'); setSettingsOpen(!settingsOpen); }} title="Configurar console" aria-label="Configurar console">⚙</button>
            <button className="mode-button" onClick={() => { const nextMode = mode === 'dark' ? 'light' : mode === 'light' ? 'auto' : 'dark'; recordAction(session.access_token, 'change_theme', 'console'); setMode(nextMode); onToast({ type: 'success', message: `Tema ${nextMode === 'auto' ? 'automático' : nextMode === 'light' ? 'claro' : 'escuro'} ativado.` }); }} title="Alternar tema">{mode === 'auto' ? '◐' : mode === 'light' ? '☀' : '☾'}</button>
            <button className="userbox" onClick={onLogout} title="Sair">
              <span className="user-avatar">SYS</span>
              <div>
                <span className="user-name">{session.user.name}</span>
                <span className="user-ente">{session.user.role} · São Paulo</span>
              </div>
            </button>
          </div>
        </header>
        {notificationsOpen && <NotificationPanel notifications={notifications} token={session.access_token} onToast={onToast} onUpdate={setNotifications} onClose={() => setNotificationsOpen(false)} />}

        <nav className="tabbar">
          {adminTabs.map((tab) => (
            <button key={tab.route} className={`tab ${route === tab.route ? 'active' : ''}`} onClick={() => navigate(tab.route)}>{tab.label}</button>
          ))}
        </nav>

        <main className="main-content">
          {route === 'home' && <HomePage setRoute={navigate} token={session.access_token} onToast={onToast} />}
          {route === 'dashboard' && <DashboardPage token={session.access_token} onToast={onToast} />}
          {route === 'cadastros' && <CadastrosPage setRoute={setRoute} token={session.access_token} />}
          {route === 'integracoes' && <IntegracoesPage token={session.access_token} />}
          {route === 'qualidade' && <QualidadePage token={session.access_token} />}
          {route === 'compliance' && <CompliancePage token={session.access_token} />}
          {route === 'relatorios' && <RelatoriosPage token={session.access_token} />}
          {route === 'recadastramento' && <RecadastramentoPage token={session.access_token} />}
          {route.startsWith('operative') && <NexoOperativePage route={route} token={session.access_token} onToast={onToast} onNavigate={navigate} />}
          {route.startsWith('cadastro') && <CadastroDetailPage token={session.access_token} />}
        </main>
        {settingsOpen && <SettingsPanel compactMode={compactMode} setCompactMode={setCompactMode} context={context} session={session} onClose={() => setSettingsOpen(false)} />}
        {globalSearchOpen && <GlobalSearch onClose={() => setGlobalSearchOpen(false)} onNavigate={(nextRoute) => { setGlobalSearchOpen(false); navigate(nextRoute, 'global_search'); }} />}
        {logsOpen && <LiveLogsPanel logs={logs} meta={liveLogs.meta} onPause={liveLogs.pause} onResume={liveLogs.resume} onClose={() => setLogsOpen(false)} />}
      </section>
    </div>
  );
}

function LoginPage({ onLogin, onToast }) {
  const [email, setEmail] = useState('sysadmin@rpps.sp.gov.br');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false });
  const emailError = touched.email && !/^\S+@\S+\.\S+$/.test(email) ? 'Informe um e-mail válido.' : '';
  const passwordError = touched.password && password.length < 8 ? 'A senha deve ter ao menos 8 caracteres.' : '';
  const passwordScore = Math.min(4, (password.length >= 8 ? 1 : 0) + (/[A-Z]/.test(password) ? 1 : 0) + (/\d/.test(password) ? 1 : 0) + (/[^A-Za-z0-9]/.test(password) ? 1 : 0));

  async function submit(event) {
    event.preventDefault();
    setTouched({ email: true, password: true });
    if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 8) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || 'Não foi possível autenticar');
      onLogin(data);
    } catch (requestError) {
      const message = requestError instanceof TypeError ? 'API indisponível. Inicie o backend na porta 8000.' : (requestError.message || 'Não foi possível autenticar.');
      setError(message);
      onToast?.({ type: 'error', message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-screen">
      <section className="login-panel">
        <div className="login-header">
          <img className="dotal-logo login-logo" src="/dotal-logo.svg" alt="Dotal consultoria" />
          <div className="login-caption">NEXO OPERATIVE · GOVERNANÇA PREVIDENCIÁRIA</div>
        </div>
        <div className="login-body">
          <div className="login-title">Acesso Administrativo</div>
          <div className="login-subtitle">Autenticação de Console</div>
          <form className="login-form" onSubmit={submit}>
            <label className="login-label">Usuário</label>
            <input className={`login-input ${emailError ? 'input-error' : ''}`} value={email} onChange={(event) => setEmail(event.target.value)} onBlur={() => setTouched((current) => ({ ...current, email: true }))} type="email" required aria-invalid={Boolean(emailError)} />
            {emailError && <span className="field-error" role="alert">{emailError}</span>}
            <label className="login-label">Senha</label>
            <input className={`login-input ${passwordError ? 'input-error' : ''}`} value={password} onChange={(event) => setPassword(event.target.value)} onBlur={() => setTouched((current) => ({ ...current, password: true }))} type="password" required aria-invalid={Boolean(passwordError)} />
            <div className="password-strength" aria-label={`Força da senha: ${passwordScore} de 4`}>{[1, 2, 3, 4].map((level) => <i className={level <= passwordScore ? 'filled' : ''} key={level}></i>)}</div>
            {passwordError && <span className="field-error" role="alert">{passwordError}</span>}
            <label className="login-label">Código 2FA</label>
            <input className="login-input otp" value="482197" readOnly />
            <div className="login-actions">
              <button className="primary-button login-submit" type="submit" disabled={loading}>{loading ? '◌ Autenticando...' : 'Entrar no Console'}</button>
              <button className="secondary-button" type="button" onClick={() => setError('Código de demonstração: 482197')}>Solicitar Código</button>
            </div>
            {error && <div className="login-error" role="alert">{error}</div>}
          </form>
        </div>
      </section>
    </div>
  );
}

function Toast({ type, message, onClose }) {
  return <div className={`app-toast ${type}`} role="status"><span>{type === 'success' ? '✓' : type === 'warning' ? '!' : '×'}</span><strong>{message}</strong><button onClick={onClose} aria-label="Fechar aviso">×</button></div>;
}

function LiveLogsPanel({ logs, meta, onPause, onResume, onClose }) {
  const [level, setLevel] = useState('ALL');
  const [origin, setOrigin] = useState('ALL');
  const [autoScroll, setAutoScroll] = useState(true);
  const levels = ['ALL', 'INFO', 'WARNING', 'ERROR', 'SUCCESS'];
  const levelLabels = { ALL: 'Todos', INFO: 'Informação', WARNING: 'Atenção', ERROR: 'Erro', SUCCESS: 'Sucesso' };
  const origins = ['ALL', ...new Set(logs.map((log) => log.origin))];
  const visible = logs.filter((log) => (level === 'ALL' || log.level === level) && (origin === 'ALL' || log.origin === origin));
  function exportLogs(type) {
    const content = type === 'json' ? JSON.stringify(visible, null, 2) : visible.map((log) => `${log.timestamp} [${log.level}] ${log.origin}: ${log.message}`).join('\n');
    downloadBlob(new Blob([content], { type: type === 'json' ? 'application/json' : 'text/plain' }), `nexo-logs.${type}`);
  }
  return <aside className="live-logs-panel" aria-label="Logs em tempo real"><div className="live-logs-head"><div><span className="operative-kicker">Observabilidade</span><h2>Logs em tempo real</h2></div><button onClick={onClose} aria-label="Fechar logs">×</button></div><div className="log-counters">{['INFO', 'WARNING', 'ERROR', 'SUCCESS'].map((item) => <span className={`log-counter ${item.toLowerCase()}`} key={item}>{levelLabels[item]} <b>{logs.filter((log) => log.level === item).length}</b></span>)}</div><div className="log-filters"><select value={level} onChange={(event) => setLevel(event.target.value)} aria-label="Filtrar nível">{levels.map((item) => <option value={item} key={item}>{levelLabels[item]}</option>)}</select><select value={origin} onChange={(event) => setOrigin(event.target.value)} aria-label="Filtrar origem"><option value="ALL">Todas as origens</option>{origins.filter((item) => item !== 'ALL').map((item) => <option value={item} key={item}>{item}</option>)}</select><button onClick={() => { setAutoScroll(!autoScroll); autoScroll ? onPause() : onResume(); }}>{autoScroll ? 'Pausar' : 'Retomar'}</button></div><div className="live-log-list" data-auto-scroll={autoScroll}>{visible.length ? visible.map((log, index) => <div className="live-log-line" key={`${log.timestamp}-${index}`}><time>{new Date(log.timestamp).toLocaleTimeString('pt-BR')}</time><b className={log.level.toLowerCase()}>{levelLabels[log.level]}</b><span>{log.origin}</span><p>{log.message}</p></div>) : <p className="panel-note">Aguardando eventos do fluxo...</p>}</div><div className="live-logs-foot"><RealtimeStatus meta={meta} /><button onClick={() => exportLogs('txt')}>TXT</button><button onClick={() => exportLogs('json')}>JSON</button></div></aside>;
}

function GlobalSearch({ onClose, onNavigate }) {
  const [query, setQuery] = useState('');
  const options = [
    ['home', 'Painel', 'Visão geral e métricas'], ['cadastros', 'Aplicativos', 'Pesquisar segurados'], ['qualidade', 'Qualidade', 'Inconsistências e correções'], ['compliance', 'Auditoria', 'Registro de atividades'], ['relatorios', 'Relatórios', 'Exportar dados'],
  ];
  const filtered = options.filter(([, label, description]) => `${label} ${description}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="search-overlay" role="dialog" aria-modal="true" aria-label="Busca global" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="search-dialog"><div className="search-dialog-input"><span>⌕</span><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar módulos, pessoas ou ações..." /><kbd>ESC</kbd></div><div className="search-results">{filtered.length ? filtered.map(([route, label, description]) => <button key={route} onClick={() => onNavigate(route)}><span className="search-result-icon">◈</span><span><b>{label}</b><small>{description}</small></span><kbd>↵</kbd></button>) : <p>Nenhum resultado para “{query}”.</p>}</div><div className="search-hint">Use <kbd>⌘ K</kbd> para abrir a busca a qualquer momento <button onClick={onClose}>Fechar</button></div></div></div>;
}

function HomePage({ setRoute, token, onToast }) {
  return <DashboardPage token={token} onToast={onToast} />;
}

const operativeServersSeed = [
  { id: 'srv-api-01', name: 'API Core 01', endpoint: '10.24.45.12:8000', status: 'operational', cpu: '38%', memory: '54%', latency: '42 ms', uptime: '99,98%', detail: 'Todas as rotas respondendo.' },
  { id: 'srv-worker-02', name: 'Worker Jobs 02', endpoint: '10.24.45.18:9001', status: 'attention', cpu: '76%', memory: '81%', latency: '188 ms', uptime: '98,42%', detail: 'Fila de sincronização acima do normal.' },
  { id: 'srv-report-01', name: 'Motor de relatórios', endpoint: '10.24.45.21:9100', status: 'critical', cpu: '92%', memory: '89%', latency: 'tempo esgotado', uptime: '94,12%', detail: 'Último sinal há 4 minutos.' },
];
const operativePendingSeed = [
  { id: 'P-1042', title: 'Aprovar lote de recadastramento', origin: 'Cadastros', status: 'pending', priority: 'Alta', owner: 'Ana Beatriz' },
  { id: 'P-1041', title: 'Reprocessar sincronização CNIS', origin: 'Integrações', status: 'processing', priority: 'Média', owner: 'Sistema' },
  { id: 'P-1038', title: 'Validar divergência da folha', origin: 'Qualidade', status: 'failed', priority: 'Crítica', owner: 'Carlos Souza' },
  { id: 'P-1036', title: 'Atualizar índice atuarial', origin: 'Relatórios', status: 'done', priority: 'Baixa', owner: 'Maria Rocha' },
];

function NexoOperativePage({ route, token, onToast, onNavigate }) {
  const [servers, setServers] = useState(operativeServersSeed);
  const [pending, setPending] = useState(operativePendingSeed);
  const [serverBusy, setServerBusy] = useState(null);
  const [serverDetail, setServerDetail] = useState(null);
  const [filter, setFilter] = useState('');
  const [dbRows, setDbRows] = useState([{ id: 'DB-001', name: 'nexo_prod', type: 'SQL', status: 'operational', size: '2,4 GB', sync: 'há 2 min' }, { id: 'DB-002', name: 'events_queue', type: 'NoSQL', status: 'attention', size: '840 MB', sync: 'há 11 min' }]);
  const [dbForm, setDbForm] = useState({ name: '', type: 'SQL' });
  const [query, setQuery] = useState('');
  const [queryResults, setQueryResults] = useState([]);
  const [queryBusy, setQueryBusy] = useState(false);
  const serverLive = useRealtime('servidores');
  const databaseLive = useRealtime('banco-dados');
  const pendingLive = useRealtime('pendentes');

  const currentPage = route.split('/')[1] || 'overview';
  const statusLabel = { operational: 'Operacional', attention: 'Atenção', critical: 'Crítico', inactive: 'Inativo', pending: 'Pendente', processing: 'Processando', done: 'Concluído', failed: 'Falhou' };
  const statusTone = (status) => status === 'operational' || status === 'done' ? 'success' : status === 'attention' || status === 'pending' || status === 'processing' ? 'warning' : status === 'inactive' ? 'neutral' : 'danger';
  const statusBadge = (status) => <span className={`operative-status ${statusTone(status)}`}><i></i>{statusLabel[status]}</span>;
  useEffect(() => { if (serverLive.value?.id) setServers((current) => current.map((server) => server.id === serverLive.value.id ? { ...server, status: serverLive.value.status } : server)); }, [serverLive.value]);
  useEffect(() => { if (databaseLive.value?.id) setDbRows((current) => current.map((db) => db.id === databaseLive.value.id ? { ...db, status: databaseLive.value.status, sync: 'agora' } : db)); }, [databaseLive.value]);
  useEffect(() => { if (pendingLive.value?.id) setPending((current) => current.map((item) => item.id === pendingLive.value.id ? { ...item, status: pendingLive.value.status } : item)); }, [pendingLive.value]);

  function exportData(rows, filename) {
    const content = JSON.stringify(rows, null, 2);
    downloadBlob(new Blob([content], { type: 'application/json' }), filename);
    recordAction(token, 'export', 'operative', filename);
    onToast?.({ type: 'success', message: `${filename} exportado com sucesso.` });
  }
  async function testServer(server) {
    if (!window.confirm(`Testar conexão com ${server.name}?`)) return;
    setServerBusy(server.id);
    await new Promise((resolve) => window.setTimeout(resolve, 700));
    setServerBusy(null);
    onToast?.({ type: server.status === 'critical' ? 'error' : 'success', message: server.status === 'critical' ? `${server.name} continua sem resposta.` : `${server.name} respondeu em ${server.latency}.` });
    recordAction(token, 'test_connection', 'server', server.id, server.status === 'critical' ? 'error' : 'success');
  }
  function addDatabase(event) {
    event.preventDefault();
    if (!/^[a-z][a-z0-9_]{2,30}$/.test(dbForm.name)) return onToast?.({ type: 'error', message: 'Use um nome técnico válido: letras minúsculas, números e underscore.' });
    if (!window.confirm(`Adicionar conexão ${dbForm.name}?`)) return;
    const row = { id: `DB-${String(dbRows.length + 1).padStart(3, '0')}`, name: dbForm.name, type: dbForm.type, status: 'operational', size: '0 MB', sync: 'agora' };
    setDbRows((current) => [...current, row]); setDbForm({ name: '', type: 'SQL' });
    onToast?.({ type: 'success', message: 'Conexão adicionada e verificada.' });
    recordAction(token, 'create', 'database', row.id);
  }
  async function runQuery(event) {
    event.preventDefault(); if (!query.trim()) return onToast?.({ type: 'error', message: 'Informe um filtro estruturado.' });
    setQueryBusy(true); await new Promise((resolve) => window.setTimeout(resolve, 450));
    setQueryResults([...dbRows, ...servers].filter((row) => JSON.stringify(row).toLowerCase().includes(query.toLowerCase()))); setQueryBusy(false);
  }
  function updatePending(item, nextStatus) {
    if (!window.confirm(`${nextStatus === 'done' ? 'Aprovar' : 'Reprocessar'} ${item.title}?`)) return;
    setPending((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: nextStatus } : entry));
    onToast?.({ type: 'success', message: `${item.id} atualizado para ${statusLabel[nextStatus]}.` });
    recordAction(token, nextStatus === 'done' ? 'approve' : 'reprocess', 'pending', item.id);
  }

  const visiblePending = pending.filter((item) => `${item.title} ${item.origin} ${item.priority}`.toLowerCase().includes(filter.toLowerCase()));
  return <section className="operative-page"><div className="operative-heading"><div><p className="dashboard-eyebrow">Nexo Operative <span>/</span> {statusLabel[currentPage] || 'Visão geral'}</p><h1>Centro de controle operacional</h1><small>Última verificação: agora · ambiente PROD</small></div><div className="operative-actions"><button className="secondary-button" onClick={() => exportData(currentPage === 'servers' ? servers : pending, `nexo-${currentPage}.json`)}>Exportar JSON</button><button className="primary-button" onClick={() => onToast?.({ type: 'success', message: 'Verificação operacional iniciada.' })}>Verificar agora</button></div></div><nav className="operative-tabs">{operativePages.map((page) => <button key={page.route} className={route === page.route ? 'active' : ''} onClick={() => onNavigate(page.route)}>{page.label}</button>)}</nav>
    {currentPage === 'overview' && <><div className="operative-health-grid"><article><span className="operative-kicker">Saúde geral</span><strong>99,8%</strong><small>Uptime nos últimos 30 dias</small></article><article><span className="operative-kicker">Serviços online</span><strong>12 <em>/ 14</em></strong>{statusBadge('operational')}</article><article><span className="operative-kicker">Alertas ativos</span><strong className="attention-value">3</strong>{statusBadge('attention')}</article><article><span className="operative-kicker">Pendências críticas</span><strong className="critical-value">1</strong>{statusBadge('critical')}</article></div><div className="operative-two-col"><article className="operative-panel"><div className="operative-panel-head"><div><span className="operative-kicker">Monitoramento</span><h2>Status dos serviços</h2></div><button onClick={() => onNavigate('operative/servers')}>Ver servidores →</button></div>{servers.map((server) => <div className="operative-mini-row" key={server.id}><span className="server-mark">◉</span><span><b>{server.name}</b><small>{server.endpoint}</small></span>{statusBadge(server.status)}<span className="last-check">agora</span></div>)}</article><article className="operative-panel"><div className="operative-panel-head"><div><span className="operative-kicker">Fila de trabalho</span><h2>Pendências prioritárias</h2></div><button onClick={() => onNavigate('operative/pending')}>Ver todas →</button></div>{pending.slice(0, 3).map((item) => <div className="operative-mini-row" key={item.id}><span className={`priority-mark ${item.priority.toLowerCase()}`}></span><span><b>{item.title}</b><small>{item.id} · {item.origin}</small></span>{statusBadge(item.status)}</div>)}</article></div></>}
    {currentPage === 'servers' && <article className="operative-panel"><div className="operative-panel-head"><div><span className="operative-kicker">Infraestrutura</span><h2>Servidores e instâncias</h2></div><input className="operative-filter" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filtrar servidor" /></div><div className="operative-table-wrap"><table className="operative-table"><thead><tr><th>Servidor</th><th>Status</th><th>CPU</th><th>Memória</th><th>Latência</th><th>Uptime</th><th>Ações</th></tr></thead><tbody>{servers.filter((server) => JSON.stringify(server).toLowerCase().includes(filter.toLowerCase())).map((server) => <tr key={server.id}><td><b>{server.name}</b><small>{server.endpoint}</small></td><td>{statusBadge(server.status)}</td><td>{server.cpu}</td><td>{server.memory}</td><td>{server.latency}</td><td>{server.uptime}</td><td><button className="table-action" onClick={() => testServer(server)} disabled={serverBusy === server.id}>{serverBusy === server.id ? 'Testando...' : 'Testar'}</button><button className="table-action" onClick={() => setServerDetail(server)}>Detalhes</button></td></tr>)}</tbody></table></div>{serverDetail && <div className="operative-detail"><b>{serverDetail.name}</b><span>{serverDetail.detail}</span><button onClick={() => setServerDetail(null)}>Fechar</button></div>}</article>}
    {currentPage === 'database' && <div className="operative-two-col"><article className="operative-panel"><div className="operative-panel-head"><div><span className="operative-kicker">Persistência</span><h2>Conexões ativas</h2></div><button onClick={() => exportData(dbRows, 'nexo-databases.json')}>Extrair JSON</button></div>{dbRows.map((db) => <div className="operative-mini-row" key={db.id}><span className="server-mark">▤</span><span><b>{db.name}</b><small>{db.type} · {db.size} · sync {db.sync}</small></span>{statusBadge(db.status)}</div>)}<form className="operative-form" onSubmit={addDatabase}><h3>Adicionar conexão</h3><input value={dbForm.name} onChange={(event) => setDbForm({ ...dbForm, name: event.target.value })} placeholder="nome_tecnico" aria-label="Nome da conexão" /><select value={dbForm.type} onChange={(event) => setDbForm({ ...dbForm, type: event.target.value })}><option>SQL</option><option>NoSQL</option></select><button className="primary-button" type="submit">Adicionar e testar</button></form></article><article className="operative-panel"><div className="operative-panel-head"><div><span className="operative-kicker">Consulta segura</span><h2>Construtor de filtros</h2></div>{statusBadge('operational')}</div><form className="operative-query" onSubmit={runQuery}><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ex.: prod, SQL ou 10.24" aria-label="Filtro estruturado" /><button className="primary-button" disabled={queryBusy}>{queryBusy ? 'Consultando...' : 'Consultar'}</button></form>{queryResults.length > 0 && <div className="query-results">{queryResults.map((row) => <div key={row.id}><b>{row.name || row.id}</b><span>{row.status || 'sem status'}</span></div>)}</div>}</article></div>}
    {currentPage === 'pending' && <article className="operative-panel"><div className="operative-panel-head"><div><span className="operative-kicker">Fluxo de trabalho</span><h2>Pendências de processamento</h2></div><input className="operative-filter" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Buscar pendência" /></div><div className="pending-summary"><strong>{pending.filter((item) => item.priority === 'Crítica' || item.priority === 'Alta').length}</strong><span>itens de alta prioridade requerem atenção</span></div>{visiblePending.map((item) => <div className="pending-row" key={item.id}><span className={`priority-mark ${item.priority.toLowerCase()}`}></span><span className="pending-content"><b>{item.title}</b><small>{item.id} · {item.origin} · responsável: {item.owner}</small></span>{statusBadge(item.status)}<span className="pending-actions">{item.status === 'pending' && <button onClick={() => updatePending(item, 'done')}>Aprovar</button>}{item.status === 'failed' && <button onClick={() => updatePending(item, 'processing')}>Reprocessar</button>}</span></div>)}</article>}
    {currentPage === 'query' && <article className="operative-panel"><div className="operative-panel-head"><div><span className="operative-kicker">Consulta cruzada</span><h2>Servidores, bancos e pendências</h2></div><button onClick={() => exportData([...servers, ...dbRows, ...pending], 'nexo-query.json')}>Exportar resultado</button></div><form className="operative-query" onSubmit={runQuery}><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filtrar por nome, status ou origem" /><button className="primary-button" disabled={queryBusy}>Consultar</button></form><div className="query-results">{(queryResults.length ? queryResults : [...servers, ...dbRows, ...pending]).map((row) => <div key={row.id}><b>{row.name || row.title}</b><span>{statusLabel[row.status] || row.status || row.origin}</span></div>)}</div></article>}
  </section>;
}

function DashboardPage({ token, onToast }) {
  const [rows, setRows] = useState([]);
  const [state, setState] = useState('loading');
  const [lastUpdated, setLastUpdated] = useState('');
  const [drilldown, setDrilldown] = useState(null);
  const [period, setPeriod] = useState('Este mês');
  const [pinned, setPinned] = useState(() => localStorage.getItem('nexo_pinned_stats') !== 'false');
  const [chartRange, setChartRange] = useState('1M');
  const [chartType, setChartType] = useState('Linha');
  const today = new Date();
  const [currentHour, setCurrentHour] = useState(() => new Date().getHours());
  const [calendarDate, setCalendarDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(today.getDate());
  const kpiLive = useRealtime('kpis');
  const revenueLive = useRealtime('receita');
  const frequencyLive = useRealtime('frequency');
  const activityLive = useRealtime('atividades');
  const healthLive = useRealtime('saude-operacao');
  const [liveActivities, setLiveActivities] = useState([]);
  const [livePoints, setLivePoints] = useState([]);
  useEffect(() => { if (activityLive.value) setLiveActivities((current) => [activityLive.value, ...current].slice(0, 3)); }, [activityLive.value]);
  useEffect(() => { if (revenueLive.value) setLivePoints((current) => [...current, revenueLive.value.point].slice(-12)); }, [revenueLive.value]);
  useEffect(() => {
    const timer = window.setInterval(() => setCurrentHour(new Date().getHours()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  const greeting = currentHour < 12 ? 'Bom dia' : currentHour < 18 ? 'Boa tarde' : 'Boa noite';
  const calendarMonthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(calendarDate);
  const calendarDays = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0).getDate();
  const calendarOffset = (new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1).getDay() + 6) % 7;
  const isCurrentMonth = calendarDate.getFullYear() === today.getFullYear() && calendarDate.getMonth() === today.getMonth();
  function changeCalendarMonth(offset) {
    setCalendarDate((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
    setSelectedDate(null);
  }
  function resetCalendar() {
    setCalendarDate(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(today.getDate());
  }

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
      onToast?.({ type: 'error', message: 'Não foi possível carregar os indicadores.' });
    }
  }

  useEffect(() => { loadDashboard(); }, [token]);
  useEffect(() => { const timer = window.setInterval(loadDashboard, 60000); return () => window.clearInterval(timer); }, [token]);
  useEffect(() => { localStorage.setItem('nexo_pinned_stats', pinned); }, [pinned]);

  const total = rows.length || 1;
  const complete = rows.filter((row) => row.status === 'Completo').length;
  const pending = rows.filter((row) => row.status === 'Pendente').length;
  const analyzing = rows.filter((row) => row.status === 'Em Análise').length;
  const rejected = rows.filter((row) => row.status === 'Rejeitado').length;

  return (
    <section className={`dashboard-page ${state === 'loading' && !rows.length ? 'dashboard-loading' : ''}`}>
      <div className="dashboard-heading"><div><p className="dashboard-eyebrow">Painel <span>/</span> Início</p><h1>{greeting}, Alex <span>✦</span></h1><small className="dashboard-updated">{state === 'error' ? 'Offline · mostrando último estado' : lastUpdated ? `Atualizado às ${lastUpdated}` : 'Sincronizando dados...'}</small></div><div className="dashboard-controls"><select value={period} onChange={(event) => { setPeriod(event.target.value); onToast?.({ type: 'success', message: `Período alterado para ${event.target.value}.` }); }} aria-label="Filtrar período"><option>Este mês</option><option>Mês passado</option><option>Últimos 90 dias</option></select><button className="dashboard-pin" onClick={() => { setPinned(!pinned); onToast?.({ type: 'success', message: pinned ? 'Cards desafixados.' : 'Cards fixados no topo.' }); }} aria-pressed={pinned} title="Fixar cards">{pinned ? '★' : '☆'}</button><button className="dashboard-date" onClick={loadDashboard} disabled={state === 'loading'}>↻ Atualizar</button></div></div>
      <section className="dashboard-stats">
        <article className="dash-stat live-widget"><RealtimeStatus meta={kpiLive.meta} /><div className="ring ring-cyan"><b>{kpiLive.value?.cadastro?.toLocaleString('pt-BR') || '1.544'}</b><span>Cadastros</span></div><p>Registros processados no período atual.</p></article>
        <article className="dash-stat live-widget"><RealtimeStatus meta={kpiLive.meta} /><div className="ring ring-pink"><b>{kpiLive.value?.transacoes?.toLocaleString('pt-BR') || '2.487'}</b><span>Transações</span></div><p>Operações conciliadas com sucesso.</p></article>
        <article className="dash-stat live-widget"><RealtimeStatus meta={kpiLive.meta} /><div className="ring ring-orange"><b>{kpiLive.value?.usuarios?.toLocaleString('pt-BR') || '1.544'}</b><span>Usuários ativos</span></div><p>Contas com atividade nos últimos 30 dias.</p></article>
        <article className="dash-feature"><div><span className="dash-label">Taxa de conclusão</span><strong>64%</strong><small>+12,5% comparado ao mês anterior</small></div><div className="feature-bars"><i style={{ height: '44%' }}></i><i style={{ height: '72%' }}></i><i style={{ height: '58%' }}></i><i style={{ height: '88%' }}></i><i style={{ height: '66%' }}></i></div></article>
      </section>
      <section className="dashboard-main-grid">
        <article className="dash-panel line-panel"><div className="dash-panel-head"><div><span className="dash-label">Desempenho</span><h2>Receita operacional</h2></div><div className="chart-actions"><div className="range-tabs">{['24H', '1S', '1M', '1A', 'Tudo'].map((range) => <button className={chartRange === range ? 'active' : ''} key={range} onClick={() => setChartRange(range)}>{range}</button>)}</div><select value={chartType} onChange={(event) => setChartType(event.target.value)} aria-label="Tipo de gráfico"><option>Linha</option><option>Colunas</option><option>Velas</option></select></div></div><div className="chart-subline"><span><i className="legend-swatch pink-swatch"></i> Receita líquida</span><b>R$ 284.930,00 <em>+8,4%</em></b></div><div className="line-chart"><div className="y-axis"><span>R$ 400 mil</span><span>R$ 320 mil</span><span>R$ 240 mil</span><span>R$ 160 mil</span><span>R$ 80 mil</span><span>R$ 0</span></div><svg viewBox="0 0 700 240" preserveAspectRatio="none" role="img" aria-label={`Gráfico de receita no período ${chartRange}`}><defs><linearGradient id="areaFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#d24b98" stopOpacity=".5"/><stop offset="1" stopColor="#792da0" stopOpacity="0"/></linearGradient></defs><path className="area-path" d="M0 192 C45 165 62 180 105 143 S165 115 205 140 S260 110 300 126 S350 160 390 106 S445 70 485 92 S540 122 585 65 S650 70 700 28 V240 H0Z"/><path className="line-path" d="M0 192 C45 165 62 180 105 143 S165 115 205 140 S260 110 300 126 S350 160 390 106 S445 70 485 92 S540 122 585 65 S650 70 700 28"/><path className="line-path second" d="M0 212 C50 203 80 218 125 184 S180 160 220 176 S275 150 320 172 S375 182 410 145 S470 135 520 155 S600 112 700 118"/></svg><div className="x-axis"><span>01 jan</span><span>05 jan</span><span>10 jan</span><span>15 jan</span><span>20 jan</span><span>25 jan</span><span>30 jan</span></div></div></article>
        <article className="dash-panel frequency-panel live-widget"><RealtimeStatus meta={frequencyLive.meta} /><div className="dash-panel-head"><div><span className="dash-label">Análises</span><h2>Frequência</h2></div><button className="panel-menu" aria-label="Mais opções">•••</button></div><div className="equalizer">{(frequencyLive.value?.values || [48,72,42,88,62,78,52,94,68,42,84,57,76,46,66,87,60,74,51,90]).map((height, index) => <button key={index} title={`Dado ${height}`} onClick={() => setDrilldown(`Dado ${height}: ${Math.round(height * 128.4)} eventos`)}><i style={{ height: `${height}%`, '--delay': `${index * 40}ms` }}></i></button>)}</div><div className="frequency-foot"><span>Baixa</span><b>12.840</b><span>Alta</span></div>{drilldown && <div className="chart-drilldown"><b>Detalhe selecionado</b><span>{drilldown}</span><button onClick={() => setDrilldown(null)}>×</button></div>}</article>
        <article className="dash-panel progress-panel"><div className="dash-panel-head"><div><span className="dash-label cyan-label">Metas do mês</span><h2>Qualidade operacional</h2></div><span className="panel-menu">•••</span></div>{[['Conciliação financeira','92%','cyan'],['Cadastros completos','76%','green'],['Documentos validados','64%','pink']].map(([label, value, tone]) => <div className="dash-progress" key={label}><div><span>{label}</span><b>{value}</b></div><span className={`dash-progress-track ${tone}`}><i style={{ width: value }}></i></span></div>)}</article>
        <article className="dash-panel activities-panel live-widget"><RealtimeStatus meta={activityLive.meta} /><div className="dash-panel-head"><div><span className="dash-label">Recente</span><h2>Atividades</h2></div><span className="panel-menu">•••</span></div><p>As últimas ações da sua equipe e atualizações importantes do sistema.</p>{liveActivities.map((activity, index) => <div className="activity-row live-activity" key={`${activity.title}-${index}`}><span className="activity-avatar">{activity.avatar}</span><span><b>{activity.title}</b><small>{activity.time}</small></span><span className="activity-dot"></span></div>)}<div className="activity-row"><span className="activity-avatar alt">SF</span><span><b>Sincronização concluída</b><small>Ontem, 16:18</small></span><span className="activity-dot green-dot"></span></div></article>
        <article className="dash-panel calendar-panel"><div className="dash-panel-head"><div><h2>{calendarMonthLabel.charAt(0).toUpperCase() + calendarMonthLabel.slice(1)}</h2><button className="calendar-today" onClick={resetCalendar}>Hoje</button></div><div className="calendar-arrows"><button onClick={() => changeCalendarMonth(-1)} aria-label="Mês anterior">‹</button><button onClick={() => changeCalendarMonth(1)} aria-label="Próximo mês">›</button></div></div><div className="calendar-grid calendar-week"><span>SEG</span><span>TER</span><span>QUA</span><span>QUI</span><span>SEX</span><span>SÁB</span><span>DOM</span></div><div className="calendar-grid calendar-days">{Array.from({ length: calendarOffset }, (_, index) => <span className="calendar-empty" key={`empty-${index}`}></span>)}{Array.from({ length: calendarDays }, (_, index) => { const day = index + 1; return <button className={`${selectedDate === day ? 'selected-day' : ''} ${isCurrentMonth && day === today.getDate() ? 'current-day' : ''}`} onClick={() => setSelectedDate(day)} key={day}>{day}</button>; })}</div></article>
      </section>
      <section className="dashboard-bottom-grid"><article className="dash-panel balance-card"><div className="dash-panel-head"><div><span className="dash-label">Saldo disponível</span><h2>Receita total</h2></div><span className="status-badge success-badge">+8,4%</span></div><strong className="balance-value">R$ 284.930,00</strong><div className="balance-meta"><span>vs. R$ 263.120,00 mês passado</span><button onClick={() => onToast?.({ type: 'success', message: 'Relatório financeiro exportado.' })}>Exportar CSV</button></div></article><article className="dash-panel transactions-card"><div className="dash-panel-head"><div><span className="dash-label">Movimentações</span><h2>Transações recentes</h2></div><button className="text-action">Ver todas</button></div>{[['Pagamento INSS','+ R$ 12.480,00','Hoje, 11:32','income'],['Folha RPPS São Paulo','- R$ 4.220,00','Hoje, 09:10','expense'],['Conciliação CNIS','+ R$ 8.750,00','Ontem, 16:42','income']].map(([label, value, date, tone]) => <div className="transaction-row" key={label}><span className={`transaction-icon ${tone}`}>{tone === 'income' ? '↗' : '↙'}</span><span><b>{label}</b><small>{date}</small></span><strong className={tone}>{value}</strong></div>)}</article><article className="dash-panel onboarding-card"><div className="dash-panel-head"><div><span className="dash-label">Primeiros passos</span><h2>Configure seu espaço</h2></div><span className="onboarding-count">2/4</span></div><div className="onboarding-track"><i style={{ width: '50%' }}></i></div><label><input type="checkbox" checked readOnly /> Convide sua equipe</label><label><input type="checkbox" checked readOnly /> Conecte uma integração</label><label><input type="checkbox" readOnly /> Personalize os widgets</label><button className="secondary-button onboarding-button" onClick={() => onToast?.({ type: 'success', message: 'Configurações abertas.' })}>Continuar configuração</button></article></section>
      <section className="timeline-panel live-widget"><RealtimeStatus meta={healthLive.meta} /><div className="dash-panel-head"><div><span className="dash-label">Indicadores</span><h2>Saúde da operação</h2></div><span className="panel-menu">•••</span></div><div className="timeline">{[['40%','Conformidade','cyan'],['75%','Eficiência','pink'],['20%','Risco','orange'],['80%','Disponibilidade','green'],['60%','Adoção','violet']].map(([value, label, tone], index) => { const current = healthLive.value?.values?.[index]; return <div className="timeline-item" key={value}><div className={`timeline-ring ${tone}`}><b>{current ? `${current}%` : value}</b></div><span>{label}</span></div>; })}</div></section>
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
      const blob = await response.blob();
      if (!blob.size) throw new Error('O arquivo gerado está vazio.');
      downloadBlob(blob, filename);
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
          <button className="primary-button" type="button" onClick={() => { recordAction(token, 'export', 'segurados', null, 'print-pdf'); window.print(); }}>Gerar PDF / Imprimir</button>
          <button className="secondary-button" type="button" onClick={() => downloadReport('/api/segurados/export.csv', 'segurados.csv')} disabled={reportState.status === 'loading'}>Baixar CSV</button>
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
        {step === 3 && <div className="rec-step"><div className="step-title">Passo 03 · Atualização de Dados</div><label className="login-label">Endereço</label><input className="login-input" value={address} onChange={(event) => setAddress(event.target.value)} /><label className="login-label">Dependentes</label><input className="login-input" value={dependents} onChange={(event) => setDependents(event.target.value)} /></div>}
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

function NotificationPanel({ notifications, token, onToast, onUpdate, onClose }) {
  async function markRead(item) {
    const response = await fetch(`/api/notifications/${item.id}/read`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) return onToast?.({ type: 'error', message: 'Não foi possível atualizar a notificação.' });
    onUpdate(notifications.map((current) => current.id === item.id ? { ...current, read: 1 } : current));
    onToast?.({ type: 'success', message: 'Notificação marcada como lida.' });
  }
  return (
    <aside className="notification-panel" aria-label="Central de notificações">
      <div className="settings-head"><div><span className="section-kicker">Central</span><h2>Notificações</h2></div><button className="close-button" onClick={onClose} aria-label="Fechar notificações">×</button></div>
      {notifications.length === 0 ? <p className="panel-note">Nenhuma notificação pendente.</p> : notifications.map((item) => <div className={`notification-item ${item.read ? 'read' : ''}`} key={item.id}><span className={`notification-dot ${item.severity}`}></span><div><b>{item.title}</b><p>{item.message}</p><small>{item.created_at}</small></div>{!item.read && <button className="notification-read" onClick={() => markRead(item)}>Marcar lida</button>}</div>)}
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
