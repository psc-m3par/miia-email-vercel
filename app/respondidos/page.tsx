'use client';

import { useState, useEffect, useCallback } from 'react';

interface ThreadMessage {
  id: string;
  from: string;
  fromName: string;
  date: string;
  body: string;
  isMine: boolean;
}

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
  pipeline: string;
  responsavel: string;
  nomeRemetente: string;
}

const PIPELINE_STAGES = [
  { key: 'NOVO',          label: 'Novo',           color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { key: 'NEGOCIACAO',    label: 'Conversando',    color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { key: 'REUNIAO',       label: 'Reunião marcada',color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { key: 'AGUARDANDO_MATERIAIS', label: 'Aguardando materiais', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { key: 'GANHO',         label: 'Ganho',          color: 'bg-green-100 text-green-700 border-green-200' },
  { key: 'PERDIDO',       label: 'Perdido',        color: 'bg-red-100 text-red-600 border-red-200' },
  { key: 'SEM_INTERESSE', label: 'Sem interesse',  color: 'bg-slate-100 text-slate-500 border-slate-200' },
];

function pipelineStage(key: string) {
  return PIPELINE_STAGES.find(s => s.key === key) || PIPELINE_STAGES[0];
}

export default function RespondidosPage() {
  const [respondidos, setRespondidos] = useState<Respondido[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState('');
  const [showClosed, setShowClosed] = useState(false);
  const [threads, setThreads] = useState<Record<string, ThreadMessage[]>>({});
  const [loadingThread, setLoadingThread] = useState<Record<string, boolean>>({});
  const [openThread, setOpenThread] = useState<Record<string, boolean>>({});
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});
  const [sendingReply, setSendingReply] = useState<Record<string, boolean>>({});
  const [replyResult, setReplyResult] = useState<Record<string, { ok: boolean; msg: string }>>({});
  const [movingPipeline, setMovingPipeline] = useState<string | null>(null);
  const [meetModal, setMeetModal] = useState<{ r: Respondido } | null>(null);
  const [meetDate, setMeetDate] = useState('');
  const [meetTime, setMeetTime] = useState('');
  const [meetDur, setMeetDur] = useState(30);
  const [meetLoading, setMeetLoading] = useState(false);
  const [meetResult, setMeetResult] = useState<{ link: string; eventLink: string } | null>(null);
  const [meetError, setMeetError] = useState('');
  const [fwdModal, setFwdModal] = useState<{ r: Respondido } | null>(null);
  const [fwdTo, setFwdTo] = useState('');
  const [fwdNote, setFwdNote] = useState('');
  const [fwdLoading, setFwdLoading] = useState(false);
  const [fwdDone, setFwdDone] = useState(false);
  const [fwdError, setFwdError] = useState('');

  const loadData = useCallback(() => {
    setLoading(true);
    fetch('/api/respondidos', { cache: 'no-store' })
      .then(r => r.json())
      .then(data => { if (data.respondidos) setRespondidos(data.respondidos); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const cardKey = (r: Respondido) => r.rowIndex + '-' + r.spreadsheetId;

  const fetchThread = async (r: Respondido) => {
    if (!r.threadId || !r.responsavel) return;
    if (threads[r.threadId]) return;
    setLoadingThread(prev => ({ ...prev, [r.threadId]: true }));
    try {
      const res = await fetch(
        `/api/respondidos?threadId=${encodeURIComponent(r.threadId)}&responsavel=${encodeURIComponent(r.responsavel)}&spreadsheetId=${encodeURIComponent(r.spreadsheetId)}`
      );
      const data = await res.json();
      setThreads(prev => ({ ...prev, [r.threadId]: data.messages || [] }));
    } catch {
      setThreads(prev => ({ ...prev, [r.threadId]: [] }));
    } finally {
      setLoadingThread(prev => ({ ...prev, [r.threadId]: false }));
    }
  };

  const toggleThread = (r: Respondido) => {
    const k = cardKey(r);
    const willOpen = !openThread[k];
    setOpenThread(prev => ({ ...prev, [k]: willOpen }));
    if (willOpen) fetchThread(r);
  };

  const movePipeline = async (r: Respondido, stage: string) => {
    const k = cardKey(r);
    setMovingPipeline(k + stage);
    try {
      const semInteresse = stage === 'SEM_INTERESSE';
      await fetch('/api/respondidos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowIndex: r.rowIndex, pipeline: semInteresse ? 'PERDIDO' : stage, atendido: semInteresse ? true : undefined, spreadsheetId: r.spreadsheetId }),
      });
      if (semInteresse) {
        setRespondidos(prev => prev.filter(x => cardKey(x) !== k));
      } else {
        setRespondidos(prev => prev.map(x => cardKey(x) === k ? { ...x, pipeline: stage } : x));
      }
    } finally {
      setMovingPipeline(null);
    }
  };

  const sendReplyMsg = async (r: Respondido) => {
    const k = cardKey(r);
    const draft = replyDraft[k]?.trim();
    if (!draft) return;
    setSendingReply(prev => ({ ...prev, [k]: true }));
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
        setThreads(prev => { const n = { ...prev }; delete n[r.threadId]; return n; });
        fetchThread(r);
        if (r.pipeline === 'NOVO') movePipeline({ ...r, pipeline: 'NOVO' }, 'NEGOCIACAO');
      } else {
        setReplyResult(prev => ({ ...prev, [k]: { ok: false, msg: data.error || 'Erro ao enviar' } }));
      }
    } catch (e: any) {
      setReplyResult(prev => ({ ...prev, [k]: { ok: false, msg: e.message } }));
    } finally {
      setSendingReply(prev => ({ ...prev, [k]: false }));
    }
  };

  const scheduleMeet = async () => {
    if (!meetModal || !meetDate || !meetTime) return;
    setMeetLoading(true);
    setMeetError('');
    setMeetResult(null);
    try {
      const { r } = meetModal;
      const nome = [r.firstName, r.lastName].filter(Boolean).join(' ') || r.email;
      const res = await fetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderEmail: r.responsavel,
          spreadsheetId: r.spreadsheetId,
          contactEmail: r.email,
          contactName: nome,
          dateTime: `${meetDate}T${meetTime}:00`,
          durationMin: meetDur,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setMeetResult({ link: data.meetLink, eventLink: data.eventLink });
        if (r.pipeline === 'NOVO' || r.pipeline === 'NEGOCIACAO') {
          movePipeline(r, 'REUNIAO');
        }
      } else {
        setMeetError(data.error || 'Erro ao criar evento');
      }
    } catch (e: any) {
      setMeetError(e.message);
    } finally {
      setMeetLoading(false);
    }
  };

  const sendForward = async () => {
    if (!fwdModal || !fwdTo.trim()) return;
    setFwdLoading(true);
    setFwdError('');
    const { r } = fwdModal;
    const msgs = threads[r.threadId] || [];
    const lastProspectMsg = [...msgs].reverse().find(m => !m.isMine);
    const forwardedBody = lastProspectMsg?.body || '(sem mensagem carregada — abra "Ver conversa" primeiro)';
    const nome = [r.firstName, r.lastName].filter(Boolean).join(' ') || r.email;
    try {
      const res = await fetch('/api/forward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderEmail: r.responsavel,
          spreadsheetId: r.spreadsheetId,
          toEmail: fwdTo.trim(),
          note: fwdNote.trim(),
          contactName: nome,
          contactCompany: r.companyName,
          forwardedBody,
        }),
      });
      const data = await res.json();
      if (data.ok) setFwdDone(true);
      else setFwdError(data.error || 'Erro ao encaminhar');
    } catch (e: any) {
      setFwdError(e.message);
    } finally {
      setFwdLoading(false);
    }
  };

  const categorias = Array.from(new Set(respondidos.map(r => r.category))).filter(Boolean);
  const ativos = respondidos.filter(r => r.pipeline !== 'GANHO' && r.pipeline !== 'PERDIDO');
  const fechados = respondidos.filter(r => r.pipeline === 'GANHO' || r.pipeline === 'PERDIDO');

  const filtered = (showClosed ? respondidos : ativos).filter(r =>
    !filterCat || r.category === filterCat
  );

  if (loading) return (
    <div className="max-w-3xl mx-auto animate-pulse">
      <div className="h-8 bg-slate-200 rounded w-48 mb-8" />
      <div className="space-y-3">
        {[1,2,3].map(i => <div key={i} className="h-32 bg-slate-200 rounded-xl" />)}
      </div>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="font-display text-3xl font-bold text-slate-800">Respondidos</h1>
          <p className="text-slate-500 mt-1 text-sm">
            <span className="text-amber-600 font-medium">{ativos.length} em aberto</span>
            {fechados.length > 0 && <span className="text-slate-400 ml-2">· {fechados.length} fechado(s)</span>}
          </p>
        </div>
        <button onClick={loadData} className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50">
          Atualizar
        </button>
      </div>

      <div className="flex gap-2 flex-wrap mb-5">
        <button onClick={() => setShowClosed(v => !v)}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${showClosed ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
          {showClosed ? 'Só abertos' : 'Mostrar fechados'}
        </button>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
          className="text-xs border border-slate-200 rounded-xl px-3 py-1.5 text-slate-600 bg-white focus:outline-none">
          <option value="">Todas as categorias</option>
          {categorias.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
          <div className="text-5xl mb-4">📬</div>
          <p className="text-slate-400">Nenhuma conversa em aberto{filterCat ? ' nessa categoria' : ''}.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => {
            const k = cardKey(r);
            const nome = [r.firstName, r.lastName].filter(Boolean).join(' ') || r.email;
            const initials = (r.firstName?.[0] || '') + (r.lastName?.[0] || '');
            const stage = pipelineStage(r.pipeline);
            const isClosed = r.pipeline === 'GANHO' || r.pipeline === 'PERDIDO';
            const isOpen = openThread[k];
            const msgs = threads[r.threadId] || [];
            const result = replyResult[k];

            return (
              <div key={k} className={`bg-white rounded-2xl border transition-all ${isClosed ? 'opacity-60 border-slate-100' : 'border-slate-200'}`}>
                <div className="p-4 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center font-bold text-sm bg-miia-50 text-miia-600">
                    {initials || nome[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-800 text-sm">{nome}</span>
                      {r.companyName && <span className="text-xs text-slate-400">· {r.companyName}</span>}
                      <span className="text-xs bg-miia-50 text-miia-600 px-2 py-0.5 rounded-full">{r.category}</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {r.email}{r.responsavel && <span> · via {r.responsavel}</span>}
                    </div>
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {PIPELINE_STAGES.map(s => (
                        <button key={s.key}
                          onClick={() => movePipeline(r, s.key)}
                          disabled={movingPipeline !== null}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all ${
                            r.pipeline === s.key ? s.color + ' shadow-sm' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                          }`}>
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {!isClosed && (
                      <button
                        onClick={() => { setFwdModal({ r }); setFwdTo(''); setFwdNote(''); setFwdDone(false); setFwdError(''); }}
                        className="px-3 py-1.5 text-xs font-medium text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                        ↗ Consultar
                      </button>
                    )}
                    {!isClosed && (
                      <button
                        onClick={() => { setMeetModal({ r }); setMeetResult(null); setMeetError(''); }}
                        className="px-3 py-1.5 text-xs font-medium text-purple-600 border border-purple-200 rounded-xl hover:bg-purple-50 transition-colors">
                        📅 Meet
                      </button>
                    )}
                    <button onClick={() => toggleThread(r)}
                      className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-miia-500 border border-slate-200 rounded-xl hover:border-miia-300 transition-colors">
                      {isOpen ? 'Fechar' : 'Ver conversa'}
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-slate-100">
                    {loadingThread[r.threadId] ? (
                      <div className="p-4 text-center text-xs text-slate-400">Carregando conversa...</div>
                    ) : msgs.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400">Nenhuma mensagem encontrada.</div>
                    ) : (
                      <div className="px-4 py-3 space-y-3 max-h-96 overflow-y-auto">
                        {msgs.map((msg, i) => (
                          <div key={msg.id || i} className={`flex gap-2 ${msg.isMine ? 'flex-row-reverse' : ''}`}>
                            <div className={`w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-[10px] font-bold ${msg.isMine ? 'bg-miia-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
                              {msg.isMine ? 'Eu' : (msg.fromName?.[0] || '?').toUpperCase()}
                            </div>
                            <div className={`max-w-[80%] rounded-xl px-3 py-2 text-xs leading-relaxed ${msg.isMine ? 'bg-miia-500 text-white rounded-tr-sm' : 'bg-slate-50 text-slate-700 border border-slate-100 rounded-tl-sm'}`}>
                              {!msg.isMine && <div className="font-semibold mb-1 text-[10px] text-slate-500">{msg.fromName}</div>}
                              <div className="whitespace-pre-wrap">{msg.body || '(sem conteúdo)'}</div>
                              {msg.date && <div className={`text-[9px] mt-1 ${msg.isMine ? 'text-white/60' : 'text-slate-400'}`}>{new Date(msg.date).toLocaleString('pt-BR')}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {!isClosed && (
                      <div className="px-4 pb-4 pt-2 border-t border-slate-50 space-y-2">
                        {result?.msg && <p className={`text-xs font-medium ${result.ok ? 'text-green-600' : 'text-red-500'}`}>{result.msg}</p>}
                        <div className="flex gap-2">
                          <textarea
                            value={replyDraft[k] || ''}
                            onChange={e => setReplyDraft(prev => ({ ...prev, [k]: e.target.value }))}
                            placeholder={`Responder para ${r.firstName || r.email}...`}
                            rows={3}
                            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendReplyMsg(r); }}
                            className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-miia-400/50 resize-none"
                          />
                          <button
                            onClick={() => sendReplyMsg(r)}
                            disabled={sendingReply[k] || !replyDraft[k]?.trim()}
                            className="px-4 py-2 bg-miia-500 text-white rounded-xl text-xs font-medium hover:bg-miia-600 disabled:opacity-50 self-end">
                            {sendingReply[k] ? '...' : 'Enviar'}
                          </button>
                        </div>
                        <p className="text-[10px] text-slate-300">⌘+Enter para enviar</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {fwdModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setFwdModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-display text-base font-bold text-slate-800 mb-1">Consultar colega</h3>
            <p className="text-xs text-slate-400 mb-4">
              A mensagem do prospect será colada no corpo do email — sem estar na cadeia original.
            </p>
            {fwdDone ? (
              <div className="text-center space-y-3">
                <div className="text-3xl">✅</div>
                <p className="text-sm font-medium text-green-700">Email enviado para {fwdTo}</p>
                <button onClick={() => setFwdModal(null)} className="w-full py-2 text-xs text-slate-400 hover:text-slate-600">Fechar</button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Enviar para</label>
                  <input type="email" value={fwdTo} onChange={e => setFwdTo(e.target.value)}
                    placeholder="email@colega.com"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-miia-400/50" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Sua mensagem (opcional)</label>
                  <textarea value={fwdNote} onChange={e => setFwdNote(e.target.value)}
                    placeholder="Ex: o que você responderia aqui? faz sentido avançar?"
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-miia-400/50 resize-none" />
                </div>
                {!threads[fwdModal.r.threadId] && (
                  <p className="text-[10px] text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                    Dica: abra "Ver conversa" primeiro para incluir a mensagem do prospect.
                  </p>
                )}
                {fwdError && <p className="text-xs text-red-500">{fwdError}</p>}
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setFwdModal(null)}
                    className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50">
                    Cancelar
                  </button>
                  <button onClick={sendForward} disabled={fwdLoading || !fwdTo.trim()}
                    className="flex-1 py-2.5 bg-miia-500 text-white rounded-xl text-sm font-medium hover:bg-miia-600 disabled:opacity-50">
                    {fwdLoading ? 'Enviando...' : 'Enviar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {meetModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setMeetModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-display text-base font-bold text-slate-800 mb-1">Agendar Google Meet</h3>
            <p className="text-xs text-slate-400 mb-4">com {[meetModal.r.firstName, meetModal.r.lastName].filter(Boolean).join(' ') || meetModal.r.email}</p>

            {meetResult ? (
              <div className="space-y-3 text-center">
                <div className="text-3xl">✅</div>
                <p className="text-sm font-medium text-green-700">Reunião criada! Convite enviado para {meetModal.r.email}</p>
                <a href={meetResult.link} target="_blank" rel="noopener noreferrer"
                  className="block w-full py-2.5 bg-green-500 text-white rounded-xl text-sm font-medium hover:bg-green-600 text-center">
                  Entrar no Meet →
                </a>
                {meetResult.eventLink && (
                  <a href={meetResult.eventLink} target="_blank" rel="noopener noreferrer"
                    className="block text-xs text-slate-400 hover:text-slate-600">Ver no Calendar</a>
                )}
                <button onClick={() => setMeetModal(null)} className="block w-full py-2 text-xs text-slate-400 hover:text-slate-600">Fechar</button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Data</label>
                    <input type="date" value={meetDate} onChange={e => setMeetDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-miia-400/50" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Horário</label>
                    <input type="time" value={meetTime} onChange={e => setMeetTime(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-miia-400/50" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Duração</label>
                  <select value={meetDur} onChange={e => setMeetDur(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-miia-400/50 bg-white">
                    <option value={15}>15 min</option>
                    <option value={30}>30 min</option>
                    <option value={45}>45 min</option>
                    <option value={60}>1 hora</option>
                  </select>
                </div>
                {meetError && <p className="text-xs text-red-500">{meetError}</p>}
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setMeetModal(null)}
                    className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50">
                    Cancelar
                  </button>
                  <button onClick={scheduleMeet} disabled={meetLoading || !meetDate || !meetTime}
                    className="flex-1 py-2.5 bg-purple-500 text-white rounded-xl text-sm font-medium hover:bg-purple-600 disabled:opacity-50">
                    {meetLoading ? 'Criando...' : 'Criar Meet'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
