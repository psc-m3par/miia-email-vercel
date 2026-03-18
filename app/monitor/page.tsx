'use client';

import { useState, useEffect, useCallback } from 'react';

interface LogEntry {
  timestamp: string;
  rotina: string;
  categoria: string;
  quantidade: number;
  status: 'ok' | 'erro';
  detalhes: string;
}

const ROTINAS = ['Email 1', 'FUP1', 'FUP2', 'Check Replies'];

const ROTINA_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  'Email 1':      { bg: 'bg-blue-50',   text: 'text-blue-700',   dot: 'bg-blue-500' },
  'FUP1':         { bg: 'bg-indigo-50', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  'FUP2':         { bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-500' },
  'Check Replies':{ bg: 'bg-green-50',  text: 'text-green-700',  dot: 'bg-green-500' },
};

// Calcula quando a rotina vai rodar para uma categoria
function nextRunLabel(cat: any, rotina: string): string {
  if (!cat.ativo) return 'pausado';
  if (rotina === 'Check Replies') return 'em <1min';

  const RATE_LIMIT = 55; // minutos
  const cronMinute = rotina === 'Email 1' ? 0 : 5; // :00 ou :05

  const now = new Date();

  // Quando podemos rodar (rate limit)
  const earliestRun = cat.ultimoEnvio
    ? new Date(new Date(cat.ultimoEnvio).getTime() + RATE_LIMIT * 60000)
    : now;

  // Próximo tick do cron (horário UTC)
  const candidate = new Date(now);
  candidate.setUTCSeconds(0, 0);
  candidate.setUTCMinutes(cronMinute);
  if (candidate <= now) candidate.setUTCHours(candidate.getUTCHours() + 1);

  // Avança enquanto ainda está dentro do rate limit
  while (candidate < earliestRun) {
    candidate.setUTCHours(candidate.getUTCHours() + 1);
  }

  // Avança até cair dentro da janela de horário (máx 25h)
  const maxLook = new Date(now.getTime() + 25 * 3600000);
  while (candidate < maxLook) {
    const horaBR = parseInt(
      new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hour12: false }).format(candidate)
    );
    if (horaBR >= (cat.horaInicio || 0) && horaBR < (cat.horaFim || 24)) break;
    candidate.setUTCHours(candidate.getUTCHours() + 1);
  }

  const diffMin = Math.round((candidate.getTime() - now.getTime()) / 60000);
  if (diffMin <= 1) return 'agora';
  if (diffMin < 60) return `em ${diffMin}min`;
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  return m > 0 ? `em ${h}h${m}min` : `em ${h}h`;
}

function timeAgo(tsStr: string): string {
  // supports both "2026-03-16 16:57:01" (new) and "dd/mm/yyyy, HH:MM:SS" (legacy)
  try {
    let iso: string;
    if (tsStr.match(/^\d{4}-\d{2}-\d{2}/)) {
      // new format: "2026-03-16 16:57:01" — treat as Sao Paulo time
      iso = tsStr.replace(' ', 'T') + '-03:00';
    } else {
      const [datePart, timePart] = tsStr.split(', ');
      const [d, m, y] = datePart.split('/');
      iso = `${y}-${m}-${d}T${timePart}-03:00`;
    }
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return `há ${diff}s`;
    if (diff < 3600) return `há ${Math.floor(diff / 60)}min`;
    if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
    return `há ${Math.floor(diff / 86400)}d`;
  } catch { return tsStr; }
}

export default function MonitorPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [painel, setPainel] = useState<any[]>([]);
  const [fupForecast, setFupForecast] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState('');
  const [filterRotina, setFilterRotina] = useState<string>('');
  const [filterCat, setFilterCat] = useState<string>('');
  const [forçando, setForçando] = useState<string>('');
  const [resultado, setResultado] = useState<{ key: string; msg: string; ok: boolean } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(() => {
    setRefreshing(true);
    const t = Date.now();
    Promise.all([
      fetch('/api/monitor?t=' + t, { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/sheets?type=painel&t=' + t, { cache: 'no-store' }).then(r => r.json()),
    ]).then(([monitorData, painelData]) => {
      if (monitorData.logs) setLogs(monitorData.logs);
      if (monitorData.fupForecast) setFupForecast(monitorData.fupForecast);
      if (Array.isArray(painelData)) setPainel(painelData);
      setLastUpdate(new Date().toLocaleTimeString('pt-BR'));
    }).catch(() => {
      setLastUpdate('erro ao carregar — ' + new Date().toLocaleTimeString('pt-BR'));
    }).finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  const forceRun = async (rotina: string, category: string) => {
    const key = rotina + '||' + category;
    setForçando(key);
    setResultado(null);
    try {
      let res: Response;
      if (rotina === 'Email 1') {
        res = await fetch('/api/send-emails', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category }) });
        const d = await res.json();
        setResultado({ key, ok: true, msg: d.enviados > 0 ? `${d.enviados} email(s) enviado(s)` : d.pulados?.[0] || 'Nenhum pendente' });
      } else if (rotina === 'FUP1' || rotina === 'FUP2') {
        res = await fetch('/api/send-fups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category }) });
        const d = await res.json();
        setResultado({ key, ok: true, msg: d.fups > 0 ? `${d.fups} FUP(s) enviado(s)` : d.pulados?.[0] || 'Nenhum FUP pendente no prazo' });
      } else {
        res = await fetch('/api/check-replies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category }) });
        const d = await res.json();
        setResultado({ key, ok: true, msg: d.respondidos > 0 ? `${d.respondidos} resposta(s) detectada(s)` : 'Nenhuma nova resposta' });
      }
      loadData();
      setTimeout(() => { setResultado(null); loadData(); }, 8000);
    } catch (e: any) {
      setResultado({ key, ok: false, msg: 'Erro: ' + e.message });
    } finally {
      setForçando('');
    }
  };

  const triggerScheduler = useCallback(() => {
    fetch('/api/send-emails').catch(() => {});
    fetch('/api/send-fups').catch(() => {});
    fetch('/api/check-replies').catch(() => {});
  }, []);

  useEffect(() => {
    loadData();
    triggerScheduler();
    const interval = setInterval(() => {
      loadData();
      triggerScheduler();
    }, 30000);
    return () => clearInterval(interval);
  }, [loadData, triggerScheduler]);

  const categorias = Array.from(new Set(logs.map(l => l.categoria))).filter(Boolean);

  const filteredLogs = logs.filter(l =>
    (!filterRotina || l.rotina === filterRotina) &&
    (!filterCat || l.categoria === filterCat)
  );

  // Last activity per rotina per category
  const lastPerRotina: Record<string, LogEntry> = {};
  for (const log of logs) {
    const key = log.rotina + '||' + log.categoria;
    if (!lastPerRotina[key]) lastPerRotina[key] = log;
  }

  // Total hoje por rotina+categoria
  const hojeISO = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date()); // "2026-03-16"
  const hojeOld = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date()); // legacy "16/03/2026"
  const todayTotals: Record<string, number> = {};
  for (const log of logs) {
    if (!log.timestamp.startsWith(hojeISO) && !log.timestamp.startsWith(hojeOld)) continue;
    const key = log.rotina + '||' + log.categoria;
    todayTotals[key] = (todayTotals[key] || 0) + log.quantidade;
  }

  if (loading) return (
    <div className="max-w-6xl mx-auto animate-pulse">
      <div className="h-8 bg-slate-200 rounded w-48 mb-8" />
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[1,2,3,4].map(i => <div key={i} className="h-28 bg-slate-200 rounded-xl" />)}
      </div>
      <div className="h-96 bg-slate-200 rounded-xl" />
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="font-display text-3xl font-bold text-slate-800">Monitor de Rotinas</h1>
          <p className="text-slate-400 text-xs mt-1">Atualiza a cada 30s | Ultima: {lastUpdate}</p>
        </div>
        <button onClick={loadData} disabled={refreshing} className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 disabled:opacity-60">
          {refreshing ? 'Atualizando...' : 'Atualizar'}
        </button>
      </div>

      {/* Cards de status por rotina - baseados em dados reais do forecast */}
      {(() => {
        // Aggregate forecast across all categories
        const allFc = Object.values(fupForecast);
        const totalEmail1 = allFc.reduce((s, f) => s + (f.email1Ok || 0), 0);
        const totalPendentes = allFc.reduce((s, f) => s + (f.email1Pendentes || 0), 0);
        const totalFup1 = allFc.reduce((s, f) => s + (f.fup1Ok || 0), 0);
        const totalFup1Aguardando = allFc.reduce((s, f) => s + (f.fup1Aguardando || 0), 0);
        const totalFup1Prontos = allFc.reduce((s, f) => s + (f.fup1Prontos || 0), 0);
        const totalFup2 = allFc.reduce((s, f) => s + (f.fup2Ok || 0), 0);
        const totalFup2Aguardando = allFc.reduce((s, f) => s + (f.fup2Aguardando || 0), 0);
        const totalFup2Prontos = allFc.reduce((s, f) => s + (f.fup2Prontos || 0), 0);
        const totalMonitorados = allFc.reduce((s, f) => s + (f.checkReplyTargets || 0), 0);
        const totalRespondidos = allFc.reduce((s, f) => s + (f.respondidos || 0), 0);
        const totalBounced = allFc.reduce((s, f) => s + (f.bounced || 0), 0);

        // Logs-based hoje counts
        const logsHoje = logs.filter(l => l.timestamp.startsWith(hojeISO) || l.timestamp.startsWith(hojeOld));
        const hojeEmail1 = logsHoje.filter(l => l.rotina === 'Email 1').reduce((s, l) => s + l.quantidade, 0);
        const hojeFup1 = logsHoje.filter(l => l.rotina === 'FUP1').reduce((s, l) => s + l.quantidade, 0);
        const hojeFup2 = logsHoje.filter(l => l.rotina === 'FUP2').reduce((s, l) => s + l.quantidade, 0);
        const hojeReplies = logsHoje.filter(l => l.rotina === 'Check Replies').length;

        // Last log per rotina (for timestamp)
        const lastLogPerRotina: Record<string, LogEntry> = {};
        for (const log of logs) {
          if (!lastLogPerRotina[log.rotina]) lastLogPerRotina[log.rotina] = log;
        }

        // Execution counts from logs
        const execHoje = (rotina: string) => logsHoje.filter(l => l.rotina === rotina).length;
        const enviadosHoje = (rotina: string) => logsHoje.filter(l => l.rotina === rotina).reduce((s, l) => s + l.quantidade, 0);

        const cards = [
          {
            rotina: 'Email 1',
            mainValue: execHoje('Email 1'),
            mainLabel: 'execuções hoje',
            extra: hojeEmail1 > 0 ? `${hojeEmail1} enviados` : null,
            status: totalPendentes > 0
              ? { text: `${totalPendentes} pendentes · ${totalEmail1} enviados`, color: 'text-amber-600' }
              : totalEmail1 > 0
                ? { text: `Base esgotada · ${totalEmail1} enviados`, color: 'text-green-600' }
                : null,
          },
          {
            rotina: 'FUP1',
            mainValue: execHoje('FUP1'),
            mainLabel: 'execuções hoje',
            extra: hojeFup1 > 0 ? `${hojeFup1} enviados` : null,
            status: totalFup1Prontos > 0
              ? { text: `${totalFup1Prontos} pronto(s) · ${totalFup1} total`, color: 'text-green-600' }
              : totalFup1Aguardando > 0
                ? { text: `${totalFup1Aguardando} aguardando · ${totalFup1} enviados`, color: 'text-amber-600' }
                : totalFup1 > 0
                  ? { text: `Esgotado · ${totalFup1} enviados`, color: 'text-green-600' }
                  : null,
          },
          {
            rotina: 'FUP2',
            mainValue: execHoje('FUP2'),
            mainLabel: 'execuções hoje',
            extra: hojeFup2 > 0 ? `${hojeFup2} enviados` : null,
            status: totalFup2Prontos > 0
              ? { text: `${totalFup2Prontos} pronto(s) · ${totalFup2} total`, color: 'text-green-600' }
              : totalFup2Aguardando > 0
                ? { text: `${totalFup2Aguardando} aguardando · ${totalFup2} enviados`, color: 'text-amber-600' }
                : totalFup2 > 0
                  ? { text: `Esgotado · ${totalFup2} enviados`, color: 'text-green-600' }
                  : null,
          },
          {
            rotina: 'Check Replies',
            mainValue: execHoje('Check Replies'),
            mainLabel: 'execuções hoje',
            extra: `${totalMonitorados} monitorados`,
            status: totalRespondidos + totalBounced > 0
              ? { text: `${totalRespondidos} resp. · ${totalBounced} bounce`, color: 'text-slate-500' }
              : null,
          },
        ];

        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {cards.map(card => {
              const c = ROTINA_COLORS[card.rotina] || { bg: 'bg-slate-50', text: 'text-slate-700', dot: 'bg-slate-400' };
              const lastLog = lastLogPerRotina[card.rotina];
              const isRecent = lastLog && (Date.now() - new Date(lastLog.timestamp.replace(' ', 'T') + '-03:00').getTime()) < 120000;
              return (
                <div key={card.rotina} className={`rounded-xl border p-4 ${c.bg} border-slate-200`}>
                  <div className="flex items-center gap-2 mb-3">
                    {isRecent ? (
                      <span className="relative flex h-2 w-2">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${c.dot} opacity-75`} />
                        <span className={`relative inline-flex rounded-full h-2 w-2 ${c.dot}`} />
                      </span>
                    ) : (
                      <span className={`w-2 h-2 rounded-full ${card.mainValue > 0 ? c.dot : 'bg-slate-300'}`} />
                    )}
                    <span className={`text-sm font-semibold ${c.text}`}>{card.rotina}</span>
                  </div>
                  <div className="text-2xl font-bold font-display text-slate-800 mb-1">{card.mainValue}</div>
                  <div className="text-[10px] text-slate-500 mb-1">{card.mainLabel}</div>
                  {card.extra && (
                    <div className="text-[10px] text-slate-500">{card.extra}</div>
                  )}
                  {card.status && (
                    <div className={`text-[10px] font-medium ${card.status.color}`}>{card.status.text}</div>
                  )}
                  {lastLog ? (
                    <div className="text-[10px] text-slate-400 mt-1">Ultimo: {timeAgo(lastLog.timestamp)}</div>
                  ) : (
                    <div className="text-[10px] text-slate-300 mt-1">Aguardando 1ª execução</div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Painel de execução por categoria */}
      {painel.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-display text-base font-bold text-slate-800">Execução por Categoria</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Última execução e botões para forçar cada rotina individualmente</p>
          </div>
          {resultado && (
            <div className={`mx-5 mt-3 px-4 py-2 rounded-lg text-xs font-medium ${resultado.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {resultado.msg}
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left py-2.5 px-4 text-slate-500 font-medium">Categoria</th>
                  <th className="text-center py-2.5 px-4 text-slate-400 font-medium">Status</th>
                  <th className="text-center py-2.5 px-4 text-blue-600 font-medium">Email 1</th>
                  <th className="text-center py-2.5 px-4 text-indigo-600 font-medium">FUP1</th>
                  <th className="text-center py-2.5 px-4 text-purple-600 font-medium">FUP2</th>
                  <th className="text-center py-2.5 px-4 text-green-600 font-medium">Check Replies</th>
                </tr>
              </thead>
              <tbody>
                {painel.map((cat: any) => {
                  const mkKey = (r: string) => r + '||' + cat.category;
                  const lastEmail = lastPerRotina[mkKey('Email 1')];
                  const lastFup1  = lastPerRotina[mkKey('FUP1')];
                  const lastFup2  = lastPerRotina[mkKey('FUP2')];
                  const lastReply = lastPerRotina[mkKey('Check Replies')];

                  const forecast = fupForecast[cat.category];

                  const ForecastLabel = ({ rotina }: { rotina: string }) => {
                    if (!forecast) return null;
                    const isFup1 = rotina === 'FUP1';
                    const isFup2 = rotina === 'FUP2';
                    if (!isFup1 && !isFup2) return null;

                    const aguardando = isFup1 ? forecast.fup1Aguardando : forecast.fup2Aguardando;
                    const prontos = isFup1 ? forecast.fup1Prontos : forecast.fup2Prontos;
                    const proxData = isFup1 ? forecast.fup1ProximaData : forecast.fup2ProximaData;

                    if (aguardando === 0 && prontos === 0) return null;

                    let proxLabel = '';
                    if (proxData) {
                      const diff = Math.floor((new Date(proxData).getTime() - Date.now()) / 3600000);
                      if (diff <= 0) proxLabel = 'agora';
                      else if (diff < 24) proxLabel = `em ${diff}h`;
                      else proxLabel = `em ${Math.ceil(diff / 24)}d`;
                    }

                    return (
                      <div className="text-[9px] mt-1 leading-tight">
                        {prontos > 0 && (
                          <div className="text-green-600 font-semibold">{prontos} pronto(s) agora</div>
                        )}
                        {aguardando > 0 && prontos === 0 && (
                          <div className="text-amber-600">{aguardando} aguardando</div>
                        )}
                        {aguardando > 0 && prontos === 0 && proxLabel && (
                          <div className="text-slate-400">próx: {proxLabel}</div>
                        )}
                        {aguardando > 0 && prontos > 0 && (
                          <div className="text-slate-400">+{aguardando - prontos} depois</div>
                        )}
                      </div>
                    );
                  };

                  // Status contextual quando não há log
                  const getStatusLabel = (rotina: string): { text: string; color: string } | null => {
                    if (!forecast) return null;
                    if (rotina === 'Email 1') {
                      if (forecast.email1Pendentes === 0 && forecast.email1Ok > 0)
                        return { text: `esgotado (${forecast.email1Ok})`, color: 'text-green-600' };
                    }
                    if (rotina === 'FUP1') {
                      if (forecast.fup1Aguardando === 0 && forecast.fup1Prontos === 0 && forecast.fup1Ok > 0)
                        return { text: `esgotado (${forecast.fup1Ok})`, color: 'text-green-600' };
                    }
                    if (rotina === 'FUP2') {
                      if (forecast.fup2Aguardando === 0 && forecast.fup2Prontos === 0 && forecast.fup2Ok > 0)
                        return { text: `esgotado (${forecast.fup2Ok})`, color: 'text-green-600' };
                    }
                    if (rotina === 'Check Replies') {
                      if (forecast.checkReplyTargets > 0)
                        return { text: `${forecast.checkReplyTargets} monitorados`, color: 'text-green-600' };
                      if (forecast.respondidos > 0 || forecast.bounced > 0)
                        return { text: 'todos resolvidos', color: 'text-slate-400' };
                    }
                    return null;
                  };

                  const ForceBtn = ({ rotina, color }: { rotina: string; color: string }) => {
                    const key = mkKey(rotina);
                    const running = forçando === key;
                    const res = resultado?.key === key ? resultado : null;
                    return (
                      <div className="flex flex-col items-center gap-1">
                        {(() => {
                          const last = lastPerRotina[key];
                          const statusLabel = getStatusLabel(rotina);
                          if (!last) return (
                            <div className="text-center">
                              {statusLabel ? (
                                <span className={`text-[10px] font-semibold ${statusLabel.color}`}>{statusLabel.text}</span>
                              ) : (
                                <span className="text-slate-300 text-[10px]">sem registro</span>
                              )}
                              <div className="text-[10px] text-slate-400">{nextRunLabel(cat, rotina)}</div>
                              <ForecastLabel rotina={rotina} />
                            </div>
                          );
                          const displayQty = rotina === 'Check Replies'
                            ? (todayTotals[key] || 0)
                            : last.quantidade;
                          const next = nextRunLabel(cat, rotina);
                          return (
                            <div className="text-center">
                              <div className={`font-bold ${last.status === 'ok' ? color : 'text-red-500'}`}>
                                {displayQty} <span className="font-normal text-slate-400 text-[10px]">{timeAgo(last.timestamp)}</span>
                              </div>
                              {statusLabel && displayQty === 0 ? (
                                <div className={`text-[10px] font-medium ${statusLabel.color}`}>{statusLabel.text}</div>
                              ) : (
                                <div className="text-[10px] text-slate-400">{next}</div>
                              )}
                              <ForecastLabel rotina={rotina} />
                            </div>
                          );
                        })()}
                        {res && <span className={`text-[10px] font-medium ${res.ok ? 'text-green-600' : 'text-red-500'}`}>{res.msg}</span>}
                        <button
                          disabled={!!forçando}
                          onClick={() => forceRun(rotina, cat.category)}
                          className={`mt-0.5 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors ${
                            running
                              ? 'bg-slate-100 text-slate-400 cursor-wait'
                              : 'bg-slate-100 text-slate-600 hover:bg-miia-500 hover:text-white'
                          }`}>
                          {running ? 'rodando...' : 'Forçar'}
                        </button>
                      </div>
                    );
                  };

                  return (
                    <tr key={cat.category} className="border-b border-slate-50 hover:bg-slate-50/30">
                      <td className="py-3 px-4 font-medium text-slate-700">{cat.category}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${cat.ativo ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-600'}`}>
                          {cat.ativo ? 'Ativo' : 'Pausado'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center"><ForceBtn rotina="Email 1" color="text-blue-600" /></td>
                      <td className="py-3 px-4 text-center"><ForceBtn rotina="FUP1" color="text-indigo-600" /></td>
                      <td className="py-3 px-4 text-center"><ForceBtn rotina="FUP2" color="text-purple-600" /></td>
                      <td className="py-3 px-4 text-center"><ForceBtn rotina="Check Replies" color="text-green-600" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Log de atividade */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
          <h2 className="font-display text-base font-bold text-slate-800">Log de Atividade</h2>
          <div className="flex gap-2 flex-wrap">
            <select
              value={filterRotina}
              onChange={e => setFilterRotina(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600 focus:outline-none focus:ring-2 focus:ring-miia-400/50">
              <option value="">Todas as rotinas</option>
              {ROTINAS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <select
              value={filterCat}
              onChange={e => setFilterCat(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600 focus:outline-none focus:ring-2 focus:ring-miia-400/50">
              <option value="">Todas as categorias</option>
              {categorias.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {(filterRotina || filterCat) && (
              <button
                onClick={() => { setFilterRotina(''); setFilterCat(''); }}
                className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1.5">
                Limpar filtros
              </button>
            )}
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-slate-400 text-sm">Nenhum log registrado ainda.</p>
            <p className="text-slate-300 text-xs mt-1">Os logs aparecem aqui quando emails são enviados ou respostas detectadas.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50 max-h-[500px] overflow-y-auto">
            {filteredLogs.map((log, i) => {
              const c = ROTINA_COLORS[log.rotina] || { bg: '', text: 'text-slate-700', dot: 'bg-slate-400' };
              return (
                <div key={i} className="px-5 py-3 flex items-start gap-4 hover:bg-slate-50/50">
                  <div className="flex items-center gap-2 min-w-[130px]">
                    <span className={`w-1.5 h-1.5 rounded-full mt-0.5 flex-shrink-0 ${log.status === 'ok' ? c.dot : 'bg-red-500'}`} />
                    <span className={`text-[11px] font-semibold ${c.text}`}>{log.rotina}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium text-slate-700">{log.categoria}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${log.status === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                        {log.status === 'ok' ? `+${log.quantidade}` : 'erro'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 truncate">{log.detalhes}</p>
                  </div>
                  <span className="text-[10px] text-slate-400 whitespace-nowrap flex-shrink-0">{timeAgo(log.timestamp)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
