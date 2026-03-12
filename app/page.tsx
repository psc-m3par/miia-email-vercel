'use client';

import { useState, useEffect, useCallback } from 'react';

interface Stats {
  total: number; pendentes: number; email1: number; fup1: number; fup2: number;
  respondidos: number; erros: number; semThread: number;
  hojeEmail1: number; hojeFup1: number; hojeFup2: number;
}

interface Contact {
  firstName: string; lastName: string; companyName: string; email: string;
  category: string; email1Enviado: string; fup1Enviado: string; fup2Enviado: string;
}

interface LogEntry {
  timestamp: string; rotina: string; categoria: string;
  quantidade: number; status: string; detalhes: string;
}

interface DashboardData {
  painel: any[];
  stats: Record<string, Stats>;
  totalGeral: Stats;
  totalContatos: number;
}

function getEstado(s: Stats, ativo: boolean): { label: string; color: string } {
  if (!ativo) return { label: 'Pausado', color: 'bg-slate-100 text-slate-500' };
  if (s.total === 0) return { label: 'Sem base', color: 'bg-slate-100 text-slate-400' };
  if (s.pendentes > 0) return { label: 'Enviando Email 1', color: 'bg-blue-100 text-blue-700' };
  const semFup1 = s.email1 - s.respondidos - s.fup1;
  if (semFup1 > 0) return { label: 'Aguardando FUP1', color: 'bg-indigo-100 text-indigo-700' };
  if (s.fup1 > 0 && s.fup2 < s.fup1) return { label: 'Aguardando FUP2', color: 'bg-purple-100 text-purple-700' };
  if (s.email1 > 0) return { label: 'Ciclo completo', color: 'bg-green-100 text-green-700' };
  return { label: 'Pronto', color: 'bg-slate-100 text-slate-500' };
}

function getTimingInfo(ultimoEnvio: string, pendentes: number): { ultimoLabel: string; proximoLabel: string; recente: boolean } {
  if (!ultimoEnvio) return { ultimoLabel: '', proximoLabel: pendentes > 0 ? 'Pronto para enviar' : '', recente: false };
  const minAgo = Math.floor((Date.now() - new Date(ultimoEnvio).getTime()) / 60000);
  const recente = minAgo < 4;
  const ultimoLabel = minAgo < 1 ? 'há menos de 1 min' : `há ${minAgo} min`;
  const minRestantes = 55 - minAgo;
  let proximoLabel = '';
  if (pendentes > 0) {
    proximoLabel = minRestantes > 0 ? `próximo em ${minRestantes} min` : 'pronto para enviar';
  }
  return { ultimoLabel, proximoLabel, recente };
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdate, setLastUpdate] = useState('');
  const [pausingAll, setPausingAll] = useState(false);

  const loadData = useCallback(() => {
    Promise.all([
      fetch('/api/dashboard', { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/sheets?type=contacts', { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/monitor', { cache: 'no-store' }).then(r => r.json()),
    ]).then(([dashData, contactsData, monitorData]) => {
      if (dashData.error) setError(dashData.error);
      else setData(dashData);
      if (contactsData.contacts) setContacts(contactsData.contacts);
      if (monitorData.logs) setLogs(monitorData.logs);
      setLastUpdate(new Date().toLocaleTimeString('pt-BR'));
    }).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);

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

  const handlePausarTudo = async () => {
    if (!data) return;
    setPausingAll(true);
    const ativas = data.painel.filter((p: any) => p.ativo);
    for (const cat of ativas) {
      await fetch('/api/sheets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'painel', rowIndex: cat.rowIndex,
          values: [cat.category, cat.responsavel, cat.nomeRemetente, cat.emailsHora, cat.diasFup1, cat.diasFup2, 'NAO', cat.cc],
        }),
      }).catch(() => {});
    }
    setPausingAll(false);
    loadData();
  };

  const handleRetomarTudo = async () => {
    if (!data) return;
    setPausingAll(true);
    const pausadas = data.painel.filter((p: any) => !p.ativo);
    for (const cat of pausadas) {
      await fetch('/api/sheets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'painel', rowIndex: cat.rowIndex,
          values: [cat.category, cat.responsavel, cat.nomeRemetente, cat.emailsHora, cat.diasFup1, cat.diasFup2, 'SIM', cat.cc],
        }),
      }).catch(() => {});
    }
    setPausingAll(false);
    loadData();
  };

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState error={error} onRetry={loadData} />;
  if (!data) return null;

  const { totalGeral, stats, painel } = data;

  const algumaAtiva = painel.some((p: any) => p.ativo);
  const algumaPausada = painel.some((p: any) => !p.ativo);
  const todasAtivas = !algumaPausada;

  const recentlySent = contacts
    .filter(c => c.email1Enviado && c.email1Enviado.startsWith('OK'))
    .sort((a, b) => b.email1Enviado.localeCompare(a.email1Enviado))
    .slice(0, 10);

  const alerts: string[] = [];
  for (const cat in stats) {
    const s = stats[cat];
    if (s.semThread > 0) alerts.push(s.semThread + ' contatos de "' + cat + '" sem Thread ID (FUPs bloqueados)');
    if (s.pendentes > 0 && s.pendentes <= 5) alerts.push('Base de "' + cat + '" quase vazia: ' + s.pendentes + ' pendentes');
    if (s.pendentes === 0 && s.total > 0 && s.email1 === s.total) alerts.push('Base de "' + cat + '" esgotada');
    if (s.erros > 0) alerts.push(s.erros + ' erros em "' + cat + '"');
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6 flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-slate-400 text-xs mt-1">Atualiza automaticamente a cada 30s | Ultima: {lastUpdate}</p>
        </div>
        <div className="flex items-center gap-2">
          {algumaAtiva && (
            <button
              onClick={handlePausarTudo}
              disabled={pausingAll}
              className="px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 disabled:opacity-50 flex items-center gap-2">
              {pausingAll ? '...' : (
                <><span className="w-2 h-2 bg-white rounded-full inline-block" /> Pausar Tudo</>
              )}
            </button>
          )}
          {!todasAtivas && (
            <button
              onClick={handleRetomarTudo}
              disabled={pausingAll}
              className="px-4 py-2 bg-green-500 text-white rounded-xl text-sm font-medium hover:bg-green-600 disabled:opacity-50 flex items-center gap-2">
              {pausingAll ? '...' : (
                <><span>▶</span> Retomar Tudo</>
              )}
            </button>
          )}
          <button onClick={loadData} className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50">
            Atualizar
          </button>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6">
          <h3 className="text-sm font-semibold text-amber-800 mb-2">Alertas</h3>
          {alerts.map((a, i) => (
            <p key={i} className="text-xs text-amber-700 mb-1">⚠ {a}</p>
          ))}
        </div>
      )}

      <div className="bg-gradient-to-br from-miia-500 to-miia-700 rounded-2xl p-6 mb-6 text-white shadow-xl shadow-miia-500/20">
        <h2 className="text-sm font-medium text-white/70 mb-4">ATIVIDADE DE HOJE</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <BigMetric label="Emails enviados" value={totalGeral.hojeEmail1} />
          <BigMetric label="FUP1 enviados" value={totalGeral.hojeFup1} />
          <BigMetric label="FUP2 enviados" value={totalGeral.hojeFup2} />
          <BigMetric label="Respondidos" value={totalGeral.respondidos} accent="green" />
          <BigMetric label="Pendentes" value={totalGeral.pendentes} accent="amber" />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
        <StatBox label="Total na base" value={totalGeral.total} color="slate" />
        <StatBox label="Email 1 enviado" value={totalGeral.email1} color="blue" />
        <StatBox label="FUP1 enviado" value={totalGeral.fup1} color="indigo" />
        <StatBox label="FUP2 enviado" value={totalGeral.fup2} color="purple" />
        <StatBox label="Respondidos" value={totalGeral.respondidos} color="green" />
        <StatBox label="Erros" value={totalGeral.erros} color="red" />
      </div>

      <MonitorTable painel={painel} stats={stats} logs={logs} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-800 mb-3">Rotinas por Categoria</h2>
          <div className="space-y-3">
            {Object.entries(stats).map(([cat, s]) => {
              const painelCat = painel.find((p: any) => p.category === cat);
              const progresso = s.total > 0 ? Math.round((s.email1 / s.total) * 100) : 0;
              const taxaRespEmail1 = s.email1 > 0 ? Math.round((s.respondidos / s.email1) * 100) : 0;
              const taxaRespFup1 = s.fup1 > 0 ? Math.round((s.respondidos / s.fup1) * 100) : 0;
              const taxaRespFup2 = s.fup2 > 0 ? Math.round((s.respondidos / s.fup2) * 100) : 0;
              const emailsPerResp = s.respondidos > 0 ? Math.round(s.email1 / s.respondidos) : 0;
              const estado = getEstado(s, painelCat?.ativo ?? false);
              const { ultimoLabel, proximoLabel, recente } = getTimingInfo(painelCat?.ultimoEnvio || '', s.pendentes);

              return (
                <div key={cat} className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {recente && (
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                        </span>
                      )}
                      <h3 className="font-semibold text-slate-700 text-sm">{cat}</h3>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${estado.color}`}>
                        {estado.label}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400">{s.total} contatos</span>
                  </div>

                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-3">
                    <div className="h-full bg-gradient-to-r from-miia-400 to-miia-600 rounded-full transition-all" style={{ width: progresso + '%' }} />
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-center mb-2">
                    <MiniStat label="Pendentes" value={s.pendentes} color="text-amber-600" />
                    <MiniStat label="Enviados" value={s.email1} color="text-blue-600" />
                    <MiniStat label="FUP1" value={s.fup1} color="text-indigo-600" />
                    <MiniStat label="FUP2" value={s.fup2} color="text-purple-600" />
                  </div>

                  {(ultimoLabel || proximoLabel) && (
                    <div className="bg-slate-50 rounded-lg px-3 py-2 mb-2 flex items-center justify-between flex-wrap gap-1">
                      {ultimoLabel && (
                        <span className="text-[10px] text-slate-500">
                          Ultimo envio: <strong className="text-slate-700">{ultimoLabel}</strong>
                        </span>
                      )}
                      {proximoLabel && (
                        <span className={`text-[10px] font-medium ${proximoLabel.startsWith('pronto') ? 'text-green-600' : 'text-slate-500'}`}>
                          {proximoLabel.startsWith('pronto') ? '✓ ' : ''}{proximoLabel}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="border-t border-slate-100 pt-2 mt-1">
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>Taxa resp. Email1: <strong className="text-slate-700">{taxaRespEmail1}%</strong></span>
                      <span>FUP1: <strong className="text-slate-700">{taxaRespFup1}%</strong></span>
                      <span>FUP2: <strong className="text-slate-700">{taxaRespFup2}%</strong></span>
                      {emailsPerResp > 0 && (
                        <span>Emails/resp: <strong className="text-miia-500">{emailsPerResp}</strong></span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <h2 className="font-display text-lg font-bold text-slate-800 mb-3">Ultimos Emails Enviados</h2>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {recentlySent.length > 0 ? (
              <div className="divide-y divide-slate-50">
                {recentlySent.map((c, i) => {
                  const time = c.email1Enviado.replace('OK ', '');
                  let status = 'Email 1';
                  let statusColor = 'bg-blue-100 text-blue-700';
                  if (c.fup2Enviado === 'RESPONDIDO') { status = 'Respondido'; statusColor = 'bg-green-100 text-green-700'; }
                  else if (c.fup2Enviado && c.fup2Enviado.startsWith('OK')) { status = 'FUP2'; statusColor = 'bg-purple-100 text-purple-700'; }
                  else if (c.fup1Enviado && c.fup1Enviado.startsWith('OK')) { status = 'FUP1'; statusColor = 'bg-indigo-100 text-indigo-700'; }

                  return (
                    <div key={i} className="px-4 py-3 flex items-center justify-between hover:bg-slate-50/50">
                      <div>
                        <p className="text-sm font-medium text-slate-700">{c.firstName} {c.lastName}</p>
                        <p className="text-xs text-slate-400">{c.companyName} - {c.email}</p>
                      </div>
                      <div className="text-right">
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusColor}`}>{status}</span>
                        <p className="text-[10px] text-slate-400 mt-1">{time}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400 text-sm">Nenhum email enviado ainda</div>
            )}
          </div>

          {totalGeral.respondidos > 0 && totalGeral.email1 > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 mt-3">
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Eficiencia Geral</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center bg-slate-50 rounded-lg p-3">
                  <div className="text-2xl font-bold text-miia-500 font-display">{Math.round((totalGeral.respondidos / totalGeral.email1) * 100)}%</div>
                  <div className="text-[10px] text-slate-400">Taxa de resposta</div>
                </div>
                <div className="text-center bg-slate-50 rounded-lg p-3">
                  <div className="text-2xl font-bold text-miia-500 font-display">{Math.round(totalGeral.email1 / totalGeral.respondidos)}</div>
                  <div className="text-[10px] text-slate-400">Emails por resposta</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function parseLogTs(ts: string): Date | null {
  try {
    const [datePart, timePart] = ts.split(', ');
    const [d, m, y] = datePart.split('/');
    return new Date(`${y}-${m}-${d}T${timePart}`);
  } catch { return null; }
}

function relativeTime(ts: string): string {
  const d = parseLogTs(ts);
  if (!d) return ts;
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return `há ${diff}s`;
  if (diff < 3600) return `há ${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
  return `há ${Math.floor(diff / 86400)}d`;
}

type HealthStatus = { label: string; color: string; dot: string };

function getHealth(rotina: string, s: any, ativo: boolean, lastLog?: LogEntry): HealthStatus {
  if (!ativo) return { label: 'Pausado', color: 'text-slate-500', dot: 'bg-slate-300' };

  if (rotina === 'Email 1') {
    if (!s || s.total === 0) return { label: 'Sem base', color: 'text-slate-400', dot: 'bg-slate-200' };
    if (s.pendentes === 0) return { label: 'Concluído', color: 'text-green-600', dot: 'bg-green-400' };
    if (s.erros > 0 && s.email1 === 0) return { label: 'Com erros', color: 'text-red-600', dot: 'bg-red-500' };
    if (lastLog) return { label: 'Normal', color: 'text-green-600', dot: 'bg-green-500' };
    return { label: 'Aguardando', color: 'text-amber-600', dot: 'bg-amber-400' };
  }
  if (rotina === 'FUP1') {
    if (!s || s.email1 === 0) return { label: 'N/A', color: 'text-slate-400', dot: 'bg-slate-200' };
    const semFup1 = s.email1 - s.respondidos - s.fup1;
    if (semFup1 <= 0) return { label: 'Concluído', color: 'text-green-600', dot: 'bg-green-400' };
    if (lastLog) return { label: 'Normal', color: 'text-green-600', dot: 'bg-green-500' };
    return { label: 'Aguardando prazo', color: 'text-amber-600', dot: 'bg-amber-400' };
  }
  if (rotina === 'FUP2') {
    if (!s || s.fup1 === 0) return { label: 'N/A', color: 'text-slate-400', dot: 'bg-slate-200' };
    if (s.fup2 >= s.fup1) return { label: 'Concluído', color: 'text-green-600', dot: 'bg-green-400' };
    if (lastLog) return { label: 'Normal', color: 'text-green-600', dot: 'bg-green-500' };
    return { label: 'Aguardando prazo', color: 'text-amber-600', dot: 'bg-amber-400' };
  }
  if (rotina === 'Check Replies') {
    if (!s || s.email1 === 0) return { label: 'N/A', color: 'text-slate-400', dot: 'bg-slate-200' };
    return { label: 'Rodando', color: 'text-blue-600', dot: 'bg-blue-400' };
  }
  return { label: '—', color: 'text-slate-400', dot: 'bg-slate-200' };
}

function MonitorTable({ painel, stats, logs }: { painel: any[]; stats: Record<string, any>; logs: LogEntry[] }) {
  const ROTINAS = ['Email 1', 'FUP1', 'FUP2', 'Check Replies'];

  // Index last log per rotina+categoria
  const lastLog: Record<string, LogEntry> = {};
  for (const log of [...logs].reverse()) {
    const key = log.rotina + '||' + log.categoria;
    if (!lastLog[key]) lastLog[key] = log;
  }

  const rows: { rotina: string; cat: any; s: any; last?: LogEntry; health: HealthStatus }[] = [];
  for (const rotina of ROTINAS) {
    for (const cat of painel) {
      const s = stats[cat.category] || {};
      const last = lastLog[rotina + '||' + cat.category];
      const health = getHealth(rotina, s, cat.ativo, last);
      rows.push({ rotina, cat, s, last, health });
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-6">
      <div className="px-5 py-4 border-b border-slate-100">
        <h2 className="font-display text-base font-bold text-slate-800">Monitoramento de Rotinas</h2>
        <p className="text-[11px] text-slate-400 mt-0.5">Estado em tempo real de cada rotina por categoria</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Rotina</th>
              <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Categoria</th>
              <th className="text-center px-4 py-2.5 text-slate-500 font-medium">Status</th>
              <th className="text-center px-4 py-2.5 text-slate-500 font-medium">Funcionamento</th>
              <th className="text-center px-4 py-2.5 text-slate-500 font-medium">Última execução</th>
              <th className="text-center px-4 py-2.5 text-slate-500 font-medium">Qtd</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50">
                <td className="px-4 py-2.5">
                  <span className={`font-semibold ${
                    row.rotina === 'Email 1' ? 'text-blue-600' :
                    row.rotina === 'FUP1' ? 'text-indigo-600' :
                    row.rotina === 'FUP2' ? 'text-purple-600' : 'text-green-600'
                  }`}>{row.rotina}</span>
                </td>
                <td className="px-4 py-2.5 font-medium text-slate-700">{row.cat.category}</td>
                <td className="px-4 py-2.5 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${row.cat.ativo ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    {row.cat.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${row.health.dot}`} />
                    <span className={`font-medium ${row.health.color}`}>{row.health.label}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-center text-slate-500">
                  {row.last ? relativeTime(row.last.timestamp) : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-4 py-2.5 text-center font-bold text-slate-600">
                  {row.last ? row.last.quantidade : <span className="text-slate-300 font-normal">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BigMetric({ label, value, accent }: { label: string; value: number; accent?: string }) {
  const colorMap: Record<string, string> = { green: 'text-green-300', amber: 'text-amber-300' };
  return (
    <div className="text-center">
      <div className={`text-3xl font-bold font-display ${accent ? colorMap[accent] : 'text-white'}`}>{value}</div>
      <div className="text-xs mt-1 text-white/60">{label}</div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    slate: 'bg-slate-50 text-slate-700 border-slate-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    red: 'bg-red-50 text-red-700 border-red-200',
  };
  return (
    <div className={`rounded-xl border p-3 text-center ${colors[color]}`}>
      <div className="text-xl font-bold font-display">{value}</div>
      <div className="text-[10px] mt-0.5 opacity-70">{label}</div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-slate-50 rounded-lg py-1.5">
      <div className={`text-sm font-bold font-display ${color}`}>{value}</div>
      <div className="text-[10px] text-slate-400">{label}</div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="max-w-7xl mx-auto animate-pulse">
      <div className="h-8 bg-slate-200 rounded w-48 mb-6" />
      <div className="h-36 bg-slate-200 rounded-2xl mb-6" />
      <div className="grid grid-cols-6 gap-3 mb-6">
        {[1,2,3,4,5,6].map(i => <div key={i} className="h-16 bg-slate-200 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div className="h-80 bg-slate-200 rounded-xl" />
        <div className="h-80 bg-slate-200 rounded-xl" />
      </div>
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="max-w-xl mx-auto mt-20 text-center">
      <div className="text-6xl mb-4">⚠️</div>
      <h2 className="font-display text-xl font-bold text-slate-800 mb-2">Erro ao carregar</h2>
      <p className="text-slate-500 mb-4">{error}</p>
      <button onClick={onRetry} className="px-6 py-2.5 bg-miia-500 text-white rounded-xl font-medium hover:bg-miia-600">
        Tentar novamente
      </button>
    </div>
  );
}
