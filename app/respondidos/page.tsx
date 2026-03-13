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
  nomeRemetente: string;
}

export default function RespondidosPage() {
  const [respondidos, setRespondidos] = useState<Respondido[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState('');
  const [filterAtendido, setFilterAtendido] = useState<'pendentes' | 'atendidos' | 'todos'>('pendentes');
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
  const [loadingReply, setLoadingReply] = useState<Record<string, boolean>>({});
  const [toggling, setToggling] = useState<string | null>(null);
  const [replyOpen, setReplyOpen] = useState<Record<string, boolean>>({});
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});
  const [sendingReply, setSendingReply] = useState<Record<string, boolean>>({});
  const [replyResult, setReplyResult] = useState<Record<string, { ok: boolean; msg: string }>>({});

  const loadData = useCallback(() => {
    setLoading(true);
    fetch('/api/respondidos', { cache: 'no-store' })
      .then(r => r.json())
      .then(data => { if (data.respondidos) setRespondidos(data.respondidos); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const cardKey = (r: Respondido) => r.rowIndex + '-' + r.spreadsheetId;

  const fetchReply = async (r: Respondido) => {
    if (!r.threadId || !r.responsavel) return;
    if (replyTexts[r.threadId] !== undefined) return;
    setLoadingReply(prev => ({ ...prev, [r.threadId]: true }));
    try {
      const res = await fetch(
        `/api/respondidos?threadId=${encodeURIComponent(r.threadId)}&responsavel=${encodeURIComponent(r.responsavel)}&spreadsheetId=${encodeURIComponent(r.spreadsheetId)}`
      );
      const data = await res.json();
      setReplyTexts(prev => ({ ...prev, [r.threadId]: data.text || '(sem conteúdo)' }));
    } catch {
      setReplyTexts(prev => ({ ...prev, [r.threadId]: '(erro ao carregar)' }));
    } finally {
      setLoadingReply(prev => ({ ...prev, [r.threadId]: false }));
    }
  };

  const toggleAtendido = async (r: Respondido) => {
    const k = cardKey(r);
    setToggling(k);
    const newVal = r.atendido !== 'SIM';
    try {
      await fetch('/api/respondidos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowIndex: r.rowIndex, atendido: newVal, spreadsheetId: r.spreadsheetId }),
      });
      setRespondidos(prev => prev.map(x =>
        cardKey(x) === k ? { ...x, atendido: newVal ? 'SIM' : '' } : x
      ));
    } finally {
      setToggling(null);
    }
  };

  const sendReplyMsg = async (r: Respondido) => {
    const k = cardKey(r);
    const draft = replyDraft[k]?.trim();
    if (!draft) return;
    setSendingReply(prev => ({ ...prev, [k]: true }));
    setReplyResult(prev => ({ ...prev, [k]: { ok: true, msg: '' } }));
    try {
      const res = await fetch('/api/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderEmail: r.responsavel,
          senderName: r.nomeRemetente,
          to: r.email,
          threadId: r.threadId,
          body: draft,
          spreadsheetId: r.spreadsheetId,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setReplyResult(prev => ({ ...prev, [k]: { ok: true, msg: 'Enviado!' } }));
        setReplyDraft(prev => ({ ...prev, [k]: '' }));
        setReplyOpen(prev => ({ ...prev, [k]: false }));
        // Auto-mark as atendido
        if (r.atendido !== 'SIM') toggleAtendido(r);
      } else {
        setReplyResult(prev => ({ ...prev, [k]: { ok: false, msg: data.error || 'Erro ao enviar' } }));
      }
    } catch (e: any) {
      setReplyResult(prev => ({ ...prev, [k]: { ok: false, msg: e.message } }));
    } finally {
      setSendingReply(prev => ({ ...prev, [k]: false }));
    }
  };

  const categorias = Array.from(new Set(respondidos.map(r => r.category))).filter(Boolean);
  const pendentes = respondidos.filter(r => r.atendido !== 'SIM').length;
  const atendidosCount = respondidos.filter(r => r.atendido === 'SIM').length;

  const filtered = respondidos.filter(r => {
    if (filterCat && r.category !== filterCat) return false;
    if (filterAtendido === 'pendentes' && r.atendido === 'SIM') return false;
    if (filterAtendido === 'atendidos' && r.atendido !== 'SIM') return false;
    return true;
  });

  if (loading) return (
    <div className="max-w-5xl mx-auto animate-pulse">
      <div className="h-8 bg-slate-200 rounded w-48 mb-8" />
      <div className="space-y-3">
        {[1,2,3,4].map(i => <div key={i} className="h-28 bg-slate-200 rounded-xl" />)}
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
            {atendidosCount > 0 && <span className="text-slate-400 ml-2">· {atendidosCount} atendido(s)</span>}
          </p>
        </div>
        <button onClick={loadData} className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50">
          Atualizar
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap mb-6">
        <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1">
          {(['pendentes', 'todos', 'atendidos'] as const).map(f => (
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
          <p className="text-slate-400">
            {filterAtendido === 'pendentes' && pendentes === 0
              ? 'Todos os respondidos já foram atendidos.'
              : `Nenhum respondido ${filterAtendido !== 'todos' || filterCat ? 'com esses filtros' : 'ainda'}.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => {
            const k = cardKey(r);
            const nome = [r.firstName, r.lastName].filter(Boolean).join(' ') || r.email;
            const initials = (r.firstName?.[0] || '') + (r.lastName?.[0] || '');
            const isAtendido = r.atendido === 'SIM';
            const replyLoaded = replyTexts[r.threadId] !== undefined;
            const isReplyOpen = replyOpen[k];
            const result = replyResult[k];

            return (
              <div key={k} className={`bg-white rounded-2xl border transition-all ${isAtendido ? 'border-green-200 opacity-70' : 'border-slate-200'}`}>
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
                    <div className="flex items-center gap-3 mt-0.5">
                      <p className="text-xs text-slate-400">{r.email}</p>
                      {r.responsavel && (
                        <p className="text-xs text-slate-300">via <span className="text-slate-400">{r.responsavel}</span></p>
                      )}
                    </div>

                    {/* Received reply */}
                    {replyLoaded ? (
                      <div className="mt-3 bg-slate-50 rounded-xl p-3 text-xs text-slate-600 whitespace-pre-wrap max-h-40 overflow-y-auto border border-slate-100">
                        {replyTexts[r.threadId]}
                      </div>
                    ) : (
                      <button onClick={() => fetchReply(r)} disabled={loadingReply[r.threadId]}
                        className="mt-2 text-xs text-miia-500 hover:text-miia-600 font-medium disabled:opacity-50">
                        {loadingReply[r.threadId] ? 'Carregando...' : '▶ Ver resposta recebida'}
                      </button>
                    )}

                    {/* Reply result */}
                    {result?.msg && (
                      <p className={`mt-2 text-xs font-medium ${result.ok ? 'text-green-600' : 'text-red-500'}`}>{result.msg}</p>
                    )}

                    {/* Reply compose */}
                    {isReplyOpen && (
                      <div className="mt-3 space-y-2">
                        <textarea
                          value={replyDraft[k] || ''}
                          onChange={e => setReplyDraft(prev => ({ ...prev, [k]: e.target.value }))}
                          placeholder={`Responder para ${nome}...`}
                          rows={4}
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-miia-400/50 resize-none"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => sendReplyMsg(r)}
                            disabled={sendingReply[k] || !replyDraft[k]?.trim()}
                            className="px-4 py-2 bg-miia-500 text-white rounded-xl text-xs font-medium hover:bg-miia-600 disabled:opacity-50">
                            {sendingReply[k] ? 'Enviando...' : 'Enviar resposta'}
                          </button>
                          <button onClick={() => setReplyOpen(prev => ({ ...prev, [k]: false }))}
                            className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-medium hover:bg-slate-50">
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Action buttons */}
                    {!isReplyOpen && (
                      <button
                        onClick={() => setReplyOpen(prev => ({ ...prev, [k]: true }))}
                        className="mt-2 text-xs text-slate-500 hover:text-miia-500 font-medium">
                        ✉ Responder
                      </button>
                    )}
                  </div>

                  {/* Atendido toggle */}
                  <button
                    onClick={() => toggleAtendido(r)}
                    disabled={toggling === k}
                    className={`flex-shrink-0 w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all ${
                      isAtendido ? 'bg-green-500 border-green-500 text-white' : 'border-slate-300 text-transparent hover:border-green-400'
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
