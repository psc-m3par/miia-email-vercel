'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface ThreadMessage { id: string; from: string; fromName: string; date: string; body: string; isMine: boolean; }
interface Respondido {
  rowIndex: number; spreadsheetId: string; firstName: string; lastName: string;
  companyName: string; email: string; category: string; threadId: string;
  atendido: string; pipeline: string; responsavel: string; nomeRemetente: string;
}
interface InternalMessage { id: string; de: string; para: string; mensagem: string; timestamp: string; lido: string; prospectRef: string; }
interface TeamThread { colleague: string; messages: InternalMessage[]; unread: number; }

const PIPELINE_STAGES = [
  { key: 'NOVO', label: 'Novo', color: 'bg-amber-100 text-amber-700' },
  { key: 'NEGOCIACAO', label: 'Em negociação', color: 'bg-blue-100 text-blue-700' },
  { key: 'REUNIAO', label: 'Reunião marcada', color: 'bg-purple-100 text-purple-700' },
  { key: 'GANHO', label: 'Ganho', color: 'bg-green-100 text-green-700' },
  { key: 'PERDIDO', label: 'Perdido', color: 'bg-red-100 text-red-600' },
];

export default function ChatsPage() {
  const [me, setMe] = useState<string>('');
  const [tab, setTab] = useState<'prospects' | 'equipe'>('prospects');
  const [respondidos, setRespondidos] = useState<Respondido[]>([]);
  const [teamThreads, setTeamThreads] = useState<TeamThread[]>([]);
  const [selectedProspect, setSelectedProspect] = useState<Respondido | null>(null);
  const [selectedColleague, setSelectedColleague] = useState<string | null>(null);
  const [gmailThread, setGmailThread] = useState<ThreadMessage[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [replyDraft, setReplyDraft] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [replyMsg, setReplyMsg] = useState('');
  const [internalDraft, setInternalDraft] = useState('');
  const [sendingInternal, setSendingInternal] = useState(false);
  const [movingPipeline, setMovingPipeline] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadData = useCallback(async () => {
    const [sessionRes, respRes, chatRes] = await Promise.all([
      fetch('/api/session').then(r => r.json()),
      fetch('/api/respondidos', { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/internal-chat', { cache: 'no-store' }).then(r => r.json()),
    ]);

    const email = sessionRes.user || '';
    setMe(email);

    const allResp: Respondido[] = respRes.respondidos || [];
    setRespondidos(allResp.filter((r: Respondido) => r.responsavel === email));

    const msgs: InternalMessage[] = chatRes.messages || [];
    const byColleague: Record<string, InternalMessage[]> = {};
    for (const m of msgs) {
      const other = m.de === email ? m.para : m.de;
      if (!byColleague[other]) byColleague[other] = [];
      byColleague[other].push(m);
    }
    const threads: TeamThread[] = Object.entries(byColleague).map(([colleague, messages]) => ({
      colleague,
      messages: messages.sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
      unread: messages.filter(m => m.para === email && m.lido === 'NAO').length,
    }));
    setTeamThreads(threads.sort((a, b) => {
      const lastA = a.messages[a.messages.length - 1]?.timestamp || '';
      const lastB = b.messages[b.messages.length - 1]?.timestamp || '';
      return lastB.localeCompare(lastA);
    }));
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [gmailThread, selectedColleague, teamThreads]);

  const selectProspect = async (r: Respondido) => {
    setSelectedProspect(r);
    setSelectedColleague(null);
    setGmailThread([]);
    setReplyDraft('');
    setReplyMsg('');
    if (!r.threadId || !r.responsavel) return;
    setLoadingThread(true);
    try {
      const res = await fetch(`/api/respondidos?threadId=${encodeURIComponent(r.threadId)}&responsavel=${encodeURIComponent(r.responsavel)}&spreadsheetId=${encodeURIComponent(r.spreadsheetId)}`);
      const data = await res.json();
      setGmailThread(data.messages || []);
    } finally { setLoadingThread(false); }
  };

  const selectColleague = async (colleague: string) => {
    setSelectedColleague(colleague);
    setSelectedProspect(null);
    setInternalDraft('');
    await fetch('/api/internal-chat', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fromEmail: colleague }) });
    setTeamThreads(prev => prev.map(t => t.colleague === colleague ? { ...t, unread: 0 } : t));
    await loadData();
  };

  const sendReply = async () => {
    if (!selectedProspect || !replyDraft.trim()) return;
    setSendingReply(true);
    setReplyMsg('');
    try {
      const r = selectedProspect;
      const lastMsg = [...gmailThread].reverse().find(m => !m.isMine);
      const res = await fetch('/api/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderEmail: r.responsavel, senderName: r.nomeRemetente, to: r.email, threadId: r.threadId, body: replyDraft.trim(), spreadsheetId: r.spreadsheetId, originalMessageId: lastMsg?.id }),
      });
      const data = await res.json();
      if (data.ok) {
        setReplyMsg('Enviado!');
        setReplyDraft('');
        await selectProspect(r);
        if (r.pipeline === 'NOVO') movePipeline(r, 'NEGOCIACAO');
      } else setReplyMsg(data.error || 'Erro');
    } finally { setSendingReply(false); }
  };

  const movePipeline = async (r: Respondido, stage: string) => {
    setMovingPipeline(true);
    await fetch('/api/respondidos', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rowIndex: r.rowIndex, pipeline: stage, spreadsheetId: r.spreadsheetId }) });
    setRespondidos(prev => prev.map(x => x.rowIndex === r.rowIndex && x.spreadsheetId === r.spreadsheetId ? { ...x, pipeline: stage } : x));
    if (selectedProspect?.rowIndex === r.rowIndex) setSelectedProspect(prev => prev ? { ...prev, pipeline: stage } : prev);
    setMovingPipeline(false);
  };

  const sendInternal = async () => {
    if (!selectedColleague || !internalDraft.trim()) return;
    setSendingInternal(true);
    try {
      await fetch('/api/internal-chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ para: selectedColleague, mensagem: internalDraft.trim() }) });
      setInternalDraft('');
      await loadData();
    } finally { setSendingInternal(false); }
  };

  const selectedTeam = selectedColleague ? teamThreads.find(t => t.colleague === selectedColleague) : null;
  const ativos = respondidos.filter(r => r.pipeline !== 'GANHO' && r.pipeline !== 'PERDIDO');
  const fechados = respondidos.filter(r => r.pipeline === 'GANHO' || r.pipeline === 'PERDIDO');
  const totalUnread = teamThreads.reduce((s, t) => s + t.unread, 0);

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Carregando...</div>;

  return (
    <div className="flex h-[calc(100vh-2rem)] -mt-8 -mx-8">
      {/* Left panel */}
      <div className="w-72 flex-shrink-0 border-r border-slate-200 bg-white flex flex-col">
        <div className="px-4 pt-6 pb-3 border-b border-slate-100">
          <h1 className="font-display text-xl font-bold text-slate-800">Chats</h1>
          <p className="text-xs text-slate-400 mt-0.5">{me}</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100">
          <button onClick={() => setTab('prospects')}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${tab === 'prospects' ? 'text-miia-500 border-b-2 border-miia-500' : 'text-slate-400 hover:text-slate-600'}`}>
            Prospects ({ativos.length})
          </button>
          <button onClick={() => setTab('equipe')}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors relative ${tab === 'equipe' ? 'text-miia-500 border-b-2 border-miia-500' : 'text-slate-400 hover:text-slate-600'}`}>
            Equipe
            {totalUnread > 0 && <span className="absolute top-1.5 right-3 w-4 h-4 bg-miia-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{totalUnread}</span>}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {tab === 'prospects' && (
            <>
              {ativos.map(r => {
                const nome = [r.firstName, r.lastName].filter(Boolean).join(' ') || r.email;
                const stage = PIPELINE_STAGES.find(s => s.key === r.pipeline) || PIPELINE_STAGES[0];
                const isSelected = selectedProspect?.rowIndex === r.rowIndex && selectedProspect?.spreadsheetId === r.spreadsheetId;
                return (
                  <button key={r.rowIndex + r.spreadsheetId} onClick={() => selectProspect(r)}
                    className={`w-full text-left px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors ${isSelected ? 'bg-miia-50 border-miia-100' : ''}`}>
                    <div className="flex items-start gap-2">
                      <div className="w-8 h-8 rounded-xl bg-miia-100 text-miia-600 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                        {(r.firstName?.[0] || r.email[0]).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm text-slate-700 truncate">{nome}</div>
                        <div className="text-[10px] text-slate-400 truncate">{r.companyName || r.email}</div>
                        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full mt-1 inline-block ${stage.color}`}>{stage.label}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
              {fechados.length > 0 && (
                <div className="px-4 py-2 text-[10px] text-slate-400 font-medium bg-slate-50">FECHADOS ({fechados.length})</div>
              )}
              {fechados.map(r => {
                const nome = [r.firstName, r.lastName].filter(Boolean).join(' ') || r.email;
                const stage = PIPELINE_STAGES.find(s => s.key === r.pipeline) || PIPELINE_STAGES[0];
                const isSelected = selectedProspect?.rowIndex === r.rowIndex;
                return (
                  <button key={r.rowIndex + r.spreadsheetId} onClick={() => selectProspect(r)}
                    className={`w-full text-left px-4 py-3 border-b border-slate-50 hover:bg-slate-50 opacity-50 transition-colors ${isSelected ? 'opacity-100 bg-miia-50' : ''}`}>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {(r.firstName?.[0] || r.email[0]).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-xs text-slate-600 truncate">{nome}</div>
                        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${stage.color}`}>{stage.label}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
              {respondidos.length === 0 && (
                <div className="p-8 text-center text-slate-400 text-xs">Nenhuma conversa ainda</div>
              )}
            </>
          )}

          {tab === 'equipe' && (
            <>
              {teamThreads.map(t => {
                const last = t.messages[t.messages.length - 1];
                const isSelected = selectedColleague === t.colleague;
                return (
                  <button key={t.colleague} onClick={() => selectColleague(t.colleague)}
                    className={`w-full text-left px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors ${isSelected ? 'bg-miia-50 border-miia-100' : ''}`}>
                    <div className="flex items-start gap-2">
                      <div className="w-8 h-8 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                        {t.colleague[0].toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm text-slate-700 truncate">{t.colleague}</span>
                          {t.unread > 0 && <span className="w-4 h-4 bg-miia-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center flex-shrink-0">{t.unread}</span>}
                        </div>
                        {last && <p className="text-[10px] text-slate-400 truncate mt-0.5">{last.de === me ? 'Você: ' : ''}{last.mensagem.slice(0, 50)}</p>}
                      </div>
                    </div>
                  </button>
                );
              })}
              {teamThreads.length === 0 && (
                <div className="p-8 text-center text-slate-400 text-xs">Nenhuma conversa com o time ainda</div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden">
        {!selectedProspect && !selectedColleague && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl mb-3">💬</div>
              <p className="text-slate-400 text-sm">Selecione uma conversa</p>
            </div>
          </div>
        )}

        {/* Prospect conversation */}
        {selectedProspect && (
          <>
            <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
              <div>
                <span className="font-semibold text-slate-800 text-sm">{[selectedProspect.firstName, selectedProspect.lastName].filter(Boolean).join(' ') || selectedProspect.email}</span>
                {selectedProspect.companyName && <span className="text-slate-400 text-xs ml-2">· {selectedProspect.companyName}</span>}
                <div className="text-xs text-slate-400 mt-0.5">{selectedProspect.email} · via {selectedProspect.responsavel}</div>
              </div>
              <div className="flex gap-1 flex-wrap justify-end">
                {PIPELINE_STAGES.map(s => (
                  <button key={s.key} onClick={() => movePipeline(selectedProspect, s.key)} disabled={movingPipeline}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all ${selectedProspect.pipeline === s.key ? s.color + ' border-current shadow-sm' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'}`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {loadingThread && <div className="text-center text-xs text-slate-400 py-8">Carregando conversa...</div>}
              {!loadingThread && gmailThread.length === 0 && <div className="text-center text-xs text-slate-400 py-8">Nenhuma mensagem</div>}
              {gmailThread.map((msg, i) => (
                <div key={msg.id || i} className={`flex gap-2 ${msg.isMine ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-[10px] font-bold ${msg.isMine ? 'bg-miia-500 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
                    {msg.isMine ? 'Eu' : (msg.fromName?.[0] || '?').toUpperCase()}
                  </div>
                  <div className={`max-w-[75%] rounded-xl px-3 py-2 text-xs leading-relaxed ${msg.isMine ? 'bg-miia-500 text-white rounded-tr-sm' : 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm'}`}>
                    {!msg.isMine && <div className="font-semibold mb-1 text-[10px] text-slate-500">{msg.fromName}</div>}
                    <div className="whitespace-pre-wrap">{msg.body || '(sem conteúdo)'}</div>
                    {msg.date && <div className={`text-[9px] mt-1 ${msg.isMine ? 'text-white/60' : 'text-slate-400'}`}>{new Date(msg.date).toLocaleString('pt-BR')}</div>}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {selectedProspect.pipeline !== 'GANHO' && selectedProspect.pipeline !== 'PERDIDO' && (
              <div className="bg-white border-t border-slate-200 px-6 py-3 flex-shrink-0 space-y-2">
                {replyMsg && <p className={`text-xs font-medium ${replyMsg === 'Enviado!' ? 'text-green-600' : 'text-red-500'}`}>{replyMsg}</p>}
                <div className="flex gap-2 items-end">
                  <textarea value={replyDraft} onChange={e => setReplyDraft(e.target.value)} placeholder={`Responder para ${selectedProspect.firstName || selectedProspect.email}...`} rows={2}
                    onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendReply(); }}
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-miia-400/50 resize-none" />
                  <button onClick={sendReply} disabled={sendingReply || !replyDraft.trim()}
                    className="px-4 py-2 bg-miia-500 text-white rounded-xl text-xs font-medium hover:bg-miia-600 disabled:opacity-50 self-end">
                    {sendingReply ? '...' : 'Enviar'}
                  </button>
                </div>
                <p className="text-[10px] text-slate-300">⌘+Enter para enviar</p>
              </div>
            )}
          </>
        )}

        {/* Team conversation */}
        {selectedColleague && selectedTeam && (
          <>
            <div className="bg-white border-b border-slate-200 px-6 py-3 flex-shrink-0">
              <div className="font-semibold text-slate-800 text-sm">{selectedColleague}</div>
              <div className="text-xs text-slate-400">Conversa interna</div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {selectedTeam.messages.map((msg, i) => {
                const isMine = msg.de === me;
                return (
                  <div key={msg.id || i} className={`flex gap-2 ${isMine ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-[10px] font-bold ${isMine ? 'bg-violet-500 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
                      {isMine ? 'Eu' : msg.de[0].toUpperCase()}
                    </div>
                    <div className={`max-w-[75%] rounded-xl px-3 py-2 text-xs leading-relaxed ${isMine ? 'bg-violet-500 text-white rounded-tr-sm' : 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm'}`}>
                      {msg.prospectRef && <div className={`text-[9px] mb-1.5 px-2 py-1 rounded-lg ${isMine ? 'bg-white/20' : 'bg-slate-50'}`}>📧 {msg.prospectRef}</div>}
                      <div className="whitespace-pre-wrap">{msg.mensagem}</div>
                      <div className={`text-[9px] mt-1 ${isMine ? 'text-white/60' : 'text-slate-400'}`}>{new Date(msg.timestamp).toLocaleString('pt-BR')}</div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            <div className="bg-white border-t border-slate-200 px-6 py-3 flex-shrink-0 space-y-2">
              <div className="flex gap-2 items-end">
                <textarea value={internalDraft} onChange={e => setInternalDraft(e.target.value)} placeholder={`Mensagem para ${selectedColleague}...`} rows={2}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendInternal(); }}
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400/50 resize-none" />
                <button onClick={sendInternal} disabled={sendingInternal || !internalDraft.trim()}
                  className="px-4 py-2 bg-violet-500 text-white rounded-xl text-xs font-medium hover:bg-violet-600 disabled:opacity-50 self-end">
                  {sendingInternal ? '...' : 'Enviar'}
                </button>
              </div>
              <p className="text-[10px] text-slate-300">⌘+Enter para enviar</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
