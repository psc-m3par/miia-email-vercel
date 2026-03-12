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

function timeAgo(tsStr: string): string {
  // pt-BR format: "dd/mm/yyyy, HH:MM:SS"
  try {
    const [datePart, timePart] = tsStr.split(', ');
    const [d, m, y] = datePart.split('/');
    const iso = `${y}-${m}-${d}T${timePart}`;
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
  const [stats, setStats] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState('');
  const [filterRotina, setFilterRotina] = useState<string>('');
  const [filterCat, setFilterCat] = useState<string>('');

  const loadData = useCallback(() => {
    fetch('/api/monitor', { cache: 'no-store' })
      .then(r => r.json())
      .then(data => {
        if (data.logs) setLogs(data.logs);
        if (data.painel) setPainel(data.painel);
        if (data.stats) setStats(data.stats);
        setLastUpdate(new Date().toLocaleTimeString('pt-BR'));
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  const categorias = Array.from(new Set(logs.map(l => l.categoria))).filter(Boolean);

  const filteredLogs = logs.filter(l =>
    (!filterRotina || l.rotina === filterRotina) &&
    (!filterCat || l.categoria === filterCat)
  );

  // Last activity per rotina per category
  const lastPerRotina: Record<string, LogEntry> = {};
  for (const log of [...logs].reverse()) {
    const key = log.rotina + '||' + log.categoria;
    if (!lastPerRotina[key]) lastPerRotina[key] = log;
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
        <button onClick={loadData} className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50">
          Atualizar
        </button>
      </div>

      {/* Cards de status por rotina */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {ROTINAS.map(rotina => {
          const rotinaLogs = logs.filter(l => l.rotina === rotina);
          const last = rotinaLogs[0];
          const totalHoje = rotinaLogs
            .filter(l => l.timestamp.startsWith(new Date().toLocaleDateString('pt-BR')))
            .reduce((s, l) => s + l.quantidade, 0);
          const erros = rotinaLogs.filter(l => l.status === 'erro').length;
          const c = ROTINA_COLORS[rotina] || { bg: 'bg-slate-50', text: 'text-slate-700', dot: 'bg-slate-400' };

          return (
            <div key={rotina} className={`rounded-xl border p-4 ${c.bg} border-slate-200`}>
              <div className="flex items-center gap-2 mb-3">
                <span className={`w-2 h-2 rounded-full ${last ? c.dot : 'bg-slate-300'}`} />
                <span className={`text-sm font-semibold ${c.text}`}>{rotina}</span>
              </div>
              <div className="text-2xl font-bold font-display text-slate-800 mb-1">{totalHoje}</div>
              <div className="text-[10px] text-slate-500 mb-2">hoje</div>
              {last ? (
                <div className="text-[10px] text-slate-500">
                  Ultimo: <strong>{timeAgo(last.timestamp)}</strong>
                  {erros > 0 && <span className="ml-2 text-red-500">{erros} erro(s)</span>}
                </div>
              ) : (
                <div className="text-[10px] text-slate-400">Sem atividade registrada</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Status por categoria */}
      {painel.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
          <h2 className="font-display text-base font-bold text-slate-800 mb-4">Status por Categoria</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2 px-3 text-slate-500 font-medium">Categoria</th>
                  <th className="text-center py-2 px-3 text-slate-500 font-medium">Estado</th>
                  <th className="text-center py-2 px-3 text-blue-600 font-medium">Email 1</th>
                  <th className="text-center py-2 px-3 text-indigo-600 font-medium">FUP1</th>
                  <th className="text-center py-2 px-3 text-purple-600 font-medium">FUP2</th>
                  <th className="text-center py-2 px-3 text-green-600 font-medium">Replies</th>
                </tr>
              </thead>
              <tbody>
                {painel.map((cat: any) => {
                  const s = stats[cat.category] || {};
                  const lastEmail = lastPerRotina['Email 1||' + cat.category];
                  const lastFup1 = lastPerRotina['FUP1||' + cat.category];
                  const lastFup2 = lastPerRotina['FUP2||' + cat.category];
                  const lastReply = lastPerRotina['Check Replies||' + cat.category];
                  return (
                    <tr key={cat.category} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 font-medium text-slate-700">{cat.category}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${cat.ativo ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                          {cat.ativo ? 'Ativo' : 'Pausado'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {lastEmail ? (
                          <div>
                            <div className={`font-bold ${lastEmail.status === 'ok' ? 'text-blue-600' : 'text-red-500'}`}>{lastEmail.quantidade}</div>
                            <div className="text-slate-400">{timeAgo(lastEmail.timestamp)}</div>
                          </div>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {lastFup1 ? (
                          <div>
                            <div className="font-bold text-indigo-600">{lastFup1.quantidade}</div>
                            <div className="text-slate-400">{timeAgo(lastFup1.timestamp)}</div>
                          </div>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {lastFup2 ? (
                          <div>
                            <div className="font-bold text-purple-600">{lastFup2.quantidade}</div>
                            <div className="text-slate-400">{timeAgo(lastFup2.timestamp)}</div>
                          </div>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {lastReply ? (
                          <div>
                            <div className="font-bold text-green-600">{lastReply.quantidade}</div>
                            <div className="text-slate-400">{timeAgo(lastReply.timestamp)}</div>
                          </div>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
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
