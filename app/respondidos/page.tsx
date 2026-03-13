'use client';

import { useState, useEffect, useCallback } from 'react';

interface Respondido {
  rowIndex: number;
  spreadsheetId: string;
  firstName: string;
  lastName: string;
  companyName: string;
  email: string;
  category: string;
  threadId: string;
  atendido: string;
  responsavel: string;
}

export default function RespondidosPage() {
  const [respondidos, setRespondidos] = useState<Respondido[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState('');
  const [filterAtendido, setFilterAtendido] = useState<'todos' | 'pendentes' | 'atendidos'>('todos');
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
  const [loadingReply, setLoadingReply] = useState<Record<string, boolean>>({});
  const [toggling, setToggling] = useState<number | null>(null);

  const loadData = useCallback(() => {
    setLoading(true);
    fetch('/api/respondidos', { cache: 'no-store' })
      .then(r => r.json())
      .then(data => {
        if (data.respondidos) setRespondidos(data.respondidos);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const fetchReply = async (r: Respondido) => {
    if (!r.threadId || !r.responsavel) return;
    const key = r.threadId;
    if (replyTexts[key] !== undefined) return;
    setLoadingReply(prev => ({ ...prev, [key]: true }));
    try {
      const res = await fetch(
        `/api/respondidos?threadId=${encodeURIComponent(r.threadId)}&responsavel=${encodeURIComponent(r.responsavel)}&spreadsheetId=${encodeURIComponent(r.spreadsheetId)}`
      );
      const data = await res.json();
      setReplyTexts(prev => ({ ...prev, [key]: data.text || '(sem conteúdo)' }));
    } catch {
      setReplyTexts(prev => ({ ...prev, [key]: '(erro ao carregar)' }));
    } finally {
      setLoadingReply(prev => ({ ...prev, [key]: false }));
    }
  };

  const toggleAtendido = async (r: Respondido) => {
    setToggling(r.rowIndex);
    const newVal = r.atendido !== 'SIM';
    try {
      await fetch('/api/respondidos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowIndex: r.rowIndex, atendido: newVal, spreadsheetId: r.spreadsheetId }),
      });
      setRespondidos(prev => prev.map(x =>
        x.rowIndex === r.rowIndex && x.spreadsheetId === r.spreadsheetId
          ? { ...x, atendido: newVal ? 'SIM' : '' }
          : x
      ));
    } finally {
      setToggling(null);
    }
  };

  const categorias = Array.from(new Set(respondidos.map(r => r.category))).filter(Boolean);

  const filtered = respondidos.filter(r => {
    if (filterCat && r.category !== filterCat) return false;
    if (filterAtendido === 'pendentes' && r.atendido === 'SIM') return false;
    if (filterAtendido === 'atendidos' && r.atendido !== 'SIM') return false;
    return true;
  });

  const pendentes = respondidos.filter(r => r.atendido !== 'SIM').length;
  const atendidos = respondidos.filter(r => r.atendido === 'SIM').length;

  if (loading) return (
    <div className="max-w-5xl mx-auto animate-pulse">
      <div className="h-8 bg-slate-200 rounded w-48 mb-8" />
      <div className="space-y-3">
        {[1,2,3,4].map(i => <div key={i} className="h-24 bg-slate-200 rounded-xl" />)}
      </div>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="font-display text-3xl font-bold text-slate-800">Respondidos</h1>
          <p className="text-slate-500 mt-1 text-sm">
            <span className="text-amber-600 font-medium">{pendentes} pendente(s)</span>
            {atendidos > 0 && <span className="text-slate-400 ml-2">· {atendidos} atendido(s)</span>}
          </p>
        </div>
        <button onClick={loadData} className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50">
          Atualizar
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap mb-6">
        <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1">
          {(['todos', 'pendentes', 'atendidos'] as const).map(f => (
            <button key={f} onClick={() => setFilterAtendido(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${filterAtendido === f ? 'bg-miia-500 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
              {f}
            </button>
          ))}
        </div>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
          className="text-xs border border-slate-200 rounded-xl px-3 py-2 text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-miia-400/50">
          <option value="">Todas as categorias</option>
          {categorias.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
          <div className="text-5xl mb-4">📬</div>
          <p className="text-slate-400">Nenhum respondido {filterAtendido !== 'todos' || filterCat ? 'com esses filtros' : 'ainda'}.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => {
            const nome = [r.firstName, r.lastName].filter(Boolean).join(' ') || r.email;
            const initials = (r.firstName?.[0] || '') + (r.lastName?.[0] || '');
            const replyKey = r.threadId;
            const replyLoaded = replyTexts[replyKey] !== undefined;
            const isAtendido = r.atendido === 'SIM';

            return (
              <div key={r.rowIndex + '-' + r.spreadsheetId}
                className={`bg-white rounded-2xl border transition-all ${isAtendido ? 'border-green-200 opacity-70' : 'border-slate-200'}`}>
                <div className="p-4 flex items-start gap-4">
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm ${isAtendido ? 'bg-green-100 text-green-700' : 'bg-miia-50 text-miia-600'}`}>
                    {initials || nome[0]?.toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-800 text-sm">{nome}</span>
                      {r.companyName && <span className="text-xs text-slate-500">· {r.companyName}</span>}
                      <span className="text-xs bg-miia-50 text-miia-600 px-2 py-0.5 rounded-full">{r.category}</span>
                      {isAtendido && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Atendido</span>}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{r.email}</p>

                    {/* Reply section */}
                    {replyLoaded ? (
                      <div className="mt-3 bg-slate-50 rounded-xl p-3 text-xs text-slate-600 whitespace-pre-wrap max-h-48 overflow-y-auto border border-slate-100">
                        {replyTexts[replyKey]}
                      </div>
                    ) : (
                      <button
                        onClick={() => fetchReply(r)}
                        disabled={loadingReply[replyKey]}
                        className="mt-2 text-xs text-miia-500 hover:text-miia-600 font-medium disabled:opacity-50">
                        {loadingReply[replyKey] ? 'Carregando resposta...' : '▶ Ver resposta'}
                      </button>
                    )}
                  </div>

                  {/* Atendido toggle */}
                  <button
                    onClick={() => toggleAtendido(r)}
                    disabled={toggling === r.rowIndex}
                    className={`flex-shrink-0 w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all ${
                      isAtendido
                        ? 'bg-green-500 border-green-500 text-white'
                        : 'border-slate-300 text-transparent hover:border-green-400'
                    } disabled:opacity-50`}
                    title={isAtendido ? 'Marcar como pendente' : 'Marcar como atendido'}>
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
