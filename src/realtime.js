const CHANNELS = ['kpis', 'receita', 'frequency', 'atividades', 'saude-operacao', 'servidores', 'banco-dados', 'pendentes', 'logs'];
const listeners = new Map(CHANNELS.map((channel) => [channel, new Set()]));
const states = new Map(CHANNELS.map((channel) => [channel, { status: 'connected', lastUpdate: Date.now(), paused: false, failures: 0 }]));
let streamStarted = false;
let timers = [];

function emit(channel, payload) {
  const state = states.get(channel);
  if (!state || state.paused) return;
  state.lastUpdate = Date.now();
  listeners.get(channel)?.forEach((listener) => listener({ channel, payload, receivedAt: state.lastUpdate }));
}

function log(level, origin, message) {
  emit('logs', { level, origin, message, timestamp: new Date().toISOString() });
}

function randomBetween(min, max) { return Math.round(min + Math.random() * (max - min)); }

function generate(channel) {
  if (channel === 'kpis') return { cadastro: randomBetween(1500, 1600), transacoes: randomBetween(2380, 2550), usuarios: randomBetween(1400, 1600), conclusao: randomBetween(58, 78) };
  if (channel === 'receita') return { value: randomBetween(220000, 310000), point: randomBetween(45, 96) };
  if (channel === 'frequency') return { values: Array.from({ length: 20 }, () => randomBetween(35, 96)) };
  if (channel === 'atividades') return { title: ['Conciliação CNIS concluída', 'Novo relatório disponível', 'Lote de dados recebido'][randomBetween(0, 2)], time: 'agora', avatar: 'NX' };
  if (channel === 'saude-operacao') return { values: [randomBetween(35, 96), randomBetween(45, 92), randomBetween(15, 82), randomBetween(70, 99), randomBetween(45, 88)] };
  if (channel === 'servidores') return { id: ['srv-api-01', 'srv-worker-02', 'srv-report-01'][randomBetween(0, 2)], status: Math.random() > .82 ? 'critical' : Math.random() > .65 ? 'attention' : 'operational' };
  if (channel === 'banco-dados') return { id: randomBetween(1, 2) === 1 ? 'DB-001' : 'DB-002', status: Math.random() > .84 ? 'attention' : 'operational' };
  if (channel === 'pendentes') return { id: ['P-1042', 'P-1041', 'P-1038'][randomBetween(0, 2)], status: Math.random() > .7 ? 'processing' : 'pending' };
  return null;
}

function startMockStream() {
  if (streamStarted) return;
  streamStarted = true;
  CHANNELS.filter((channel) => channel !== 'logs').forEach((channel) => {
    const tick = () => {
      const chance = Math.random();
      if (chance < 0.04) {
        const state = states.get(channel);
        state.status = 'reconnecting';
        state.failures += 1;
        log('WARNING', channel, 'Canal instável; tentando reconectar com backoff.');
        emit(channel, { type: 'connection', status: 'reconnecting' });
        window.setTimeout(() => { state.status = 'connected'; log('SUCCESS', channel, 'Canal reconectado.'); }, 800 + state.failures * 300);
      } else {
        emit(channel, generate(channel));
        if (chance > 0.94) log('ERROR', channel, 'Latência acima do limite operacional.');
        else if (chance > 0.78) log('WARNING', channel, 'Atualização recebida com atraso.');
        else log('INFO', channel, 'Métrica atualizada.');
      }
      timers.push(window.setTimeout(tick, randomBetween(1800, 4600)));
    };
    timers.push(window.setTimeout(tick, randomBetween(700, 2200)));
  });
  log('SUCCESS', 'stream', 'Simulador de tempo real iniciado.');
}

export function subscribe(channel, listener) {
  if (!listeners.has(channel)) throw new Error(`Canal desconhecido: ${channel}`);
  startMockStream();
  listeners.get(channel).add(listener);
  return () => listeners.get(channel)?.delete(listener);
}

export function getChannelState(channel) { return states.get(channel) || { status: 'offline', lastUpdate: 0, paused: false }; }

export function setChannelPaused(channel, paused) {
  const state = states.get(channel);
  if (!state) return;
  state.paused = paused;
  state.status = paused ? 'paused' : 'connected';
  log('INFO', channel, paused ? 'Canal pausado pelo operador.' : 'Canal retomado pelo operador.');
}

export function destroyMockStream() {
  timers.forEach((timer) => window.clearTimeout(timer));
  timers = [];
  streamStarted = false;
}

export { CHANNELS };
