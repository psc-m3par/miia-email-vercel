'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface ThreadMessage { id: string; from: string; fromName: string; date: string; body: string; isMine: boolean; }
interface Respondido {
  rowIndex: number; spreadsheetId: string; firstName: string; lastName: string;
  companyName: string; email: string; category: string; threadId: string;
  atendido: string; pipeline: string; responsavel: string; nomeRemetente: string;
}
interface TeamThread { id: string; colleague: string; snippet: string; date: string; subject: string; }

const PIPELINE_STAGES = [
  { key: 'NOVO', label: 'Novo', color: 'bg-amber-100 text-amber-700' },
  { key: 'NEGOCIACAO', label: 'Conversando', color: 'bg-blue-100 text-blue-700' },
  { key: 'AGUARDANDO_MATERIAIS', label: 'Aguardando materiais', color: 'bg-orange-100 text-orange-700' },
  { key: 'REUNIAO', label: 'Reunião marcada', color: 'bg-purple-100 text-purple-700' },
  { key: 'GANHO', label: 'Ganho', color: 'bg-green-100 text-green-700' },
  { key: 'PERDIDO', label: 'Perdido', color: 'bg-red-100 text-red-600' },
  { key: 'SEM_INTERESSE', label: 'Sem interesse', color: 'bg-slate-100 text-slate-500' },
];

export default function ChatsPage() {
  const [me, setMe] = useState<string>('');
  const [tab, setTab] = useState<'prospects' | 'equipe'>('prospects');
  const [respondidos, setRespondidos] = useState<Respondido[]>([]);
  const [teamList, setTeamList] = useState<TeamThread[]>([]);
  const [loadingTeamList, setLoadingTeamList] = useState(false);
  const [selectedProspect, setSelectedProspect] = useState<Respondido | null>(null);
  const [selectedTeamThread, setSelectedTeamThread] = useState<TeamThread | null>(null);
  const [gmailThread, setGmailThread] = useState<ThreadMessage[]>([]);
  const [teamMessages, setTeamMessages] = useState<ThreadMessage[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [loadingTeamThread, setLoadingTeamThread] = useState(false);
  const [replyDraft, setReplyDraft] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [replyMsg, setReplyMsg] = useState('');
  const [teamReplyDraft, setTeamReplyDraft] = useState('');
  const [sendingTeamReply, setSendingTeamReply] = useState(false);
  const [teamReplyMsg, setTeamReplyMsg] = useState('');
  const [movingPipeline, setMovingPipeline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [consultarModal, setConsultarModal] = useState(false);
  const [consultarTo, setConsultarTo] = useState('');
  const [consultarNote, setConsultarNote] = useState('');
  const [consultarLoading, setConsultarLoading] = useState(false);
  const [consultarDone, setConsultarDone] = useState('');
  const [newConvModal, setNewConvModal] = useState(false);
  const [newConvTo, setNewConvTo] = useState('');
  const [newConvBody, setNewConvBody] = useState('');
  const [newConvSending, setNewConvSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadProspects = useCallback(async () => {
    const [sessionRes, respRes] = await Promise.all([
      fetch('/api/session').then(r => r.json()),
      fetch('/api/respondidos', { cache: 'no-store' }).then(r => r.json()),
    ]);
    const email = sessionRes.user || '';
    setMe(email);
    const allResp: Respondido[] = respRes.respondidos || [];
    setRespondidos(allResp.filter((r: Respondido) => r.responsavel === email));
    setLoading(false);
  }, []);

  const loadTeamList = useCallback(async () => {
    setLoadingTeamList(true);
    try {
      const res = await fetch('/api/team-chat', { cache: 'no-store' });
      const data = await res.json();
      setTeamList(data.threads || []);
    } finally { setLoadingTeamList(false); }
  }, []);

  useEffect(() => { loadProspects(); }, [loadProspects]);
  useEffect(() => { if (tab === 'equipe') loadTeamList(); }, [tab, loadTeamList]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [gmailThread, teamMessages]);

  const selectProspect = async (r: Respondido) => {
    setSelectedProspect(r);
    setSelectedTeamThread(null);
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

  const selectTeamThread = async (item: TeamThread) => {
    setSelectedTeamThread(item);
    setSelectedProspect(null);
    setTeamMessages([]);
    setTeamReplyDraft('');
    setTeamReplyMsg('');
    setLoadingTeamThread(true);
    try {
      const res = await fetch(`/api/team-chat?threadId=${encodeURIComponent(item.id)}`);
      const data = await res.json();
      setTeamMessages(data.messages || []);
    } finally { setLoadingTeamThread(false); }
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
    const semInteresse = stage === 'SEM_INTERESSE';
    await fetch('/api/respondidos', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rowIndex: r.rowIndex, pipeline: semInteresse ? 'PERDIDO' : stage, atendido: semInteresse ? true : undefined, spreadsheetId: r.spreadsheetId }),
    });
    if (semInteresse) {
      setRespondidos(prev => prev.filter(x => !(x.rowIndex === r.rowIndex && x.spreadsheetId === r.spreadsheetId)));
      setSelectedProspect(null);
    } else {
      setRespondidos(prev => prev.map(x => x.rowIndex === r.rowIndex && x.spreadsheetId === r.spreadsheetId ? { ...x, pipeline: stage } : x));
      if (selectedProspect?.rowIndex === r.rowIndex) setSelectedProspect(prev => prev ? { ...prev, pipeline: stage } : prev);
    }
    setMovingPipeline(false);
  };

  const sendTeamReply = async () => {
    if (!selectedTeamThread || !teamReplyDraft.trim()) return;
    setSendingTeamReply(true);
    setTeamReplyMsg('');
    try {
      const lastMsg = teamMessages[teamMessages.length - 1];
      const res = await fetch('/api/team-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: selectedTeamThread.colleague,
          subject: `Re: ${selectedTeamThread.subject}`,
          body: teamReplyDraft.trim(),
          threadId: selectedTeamThread.id,
          lastMessageId: lastMsg?.id,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setTeamReplyMsg('Enviado!');
        setTeamReplyDraft('');
        await selectTeamThread(selectedTeamThread);
      } else setTeamReplyMsg(data.error || 'Erro');
    } finally { setSendingTeamReply(false); }
  };

  const sendConsultar = async () => {
    if (!selectedProspect || !consultarTo.trim()) return;
    setConsultarLoading(true);
    const nome = [selectedProspect.firstName, selectedProspect.lastName].filter(Boolean).join(' ') || selectedProspect.email;
    const lastMsg = [...gmailThread].reverse().find(m => !m.isMine);
    const prospectBody = lastMsg?.body?.slice(0, 800) || '(sem mensagem carregada)';
    const note = consultarNote.trim();
    const body = note
      ? `${note}\n\n---\nÚltima mensagem de ${nome} (${selectedProspect.email}):\n\n"${prospectBody}"`
      : `Consulta sobre ${nome} (${selectedProspect.email}):\n\n"${prospectBody}"`;
    try {
      const res = await fetch('/api/team-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: consultarTo.trim(), subject: `Consulta: ${nome}`, body }),
      });
      const data = await res.json();
      if (data.ok) {
        setConsultarDone('Enviado!');
        await loadTeamList();
        setTimeout(() => { setConsultarModal(false); setConsultarTo(''); setConsultarNote(''); setConsultarDone(''); setTab('equipe'); }, 1500);
      } else setConsultarDone('Erro: ' + (data.error || 'falha'));
    } finally { setConsultarLoading(false); }
  };

  const sendNewConv = async () => {
    if (!newConvTo.trim() || !newConvBody.trim()) return;
    setNewConvSending(true);
    try {
      const res = await fetch('/api/team-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: newConvTo.trim(), subject: 'Mensagem MIIA', body: newConvBody.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        setNewConvModal(false);
        setNewConvTo('');
        setNewConvBody('');
        await loadTeamList();
      }
    } finally { setNewConvSending(false); }
  };

  const ativos = respondidos.filter(r => r.pipeline !== 'GANHO' && r.pipeline !== 'PERDIDO');
  const fechados = respondidos.filter(r => r.pipeline === 'GANHO' || r.pipeline === 'PERDIDO');

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Carregando...</div>;

  return (
    <>
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
              className={`flex-1 py-2.5 text-xs font-medium transition-colors ${tab === 'equipe' ? 'text-miia-500 border-b-2 border-miia-500' : 'text-slate-400 hover:text-slate-600'}`}>
              Equipe
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
                <div className="px-4 py-2 flex items-center justify-between border-b border-slate-50">
                  <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Conversas internas</span>
                  <button onClick={() => setNewConvModal(true)} className="text-[10px] text-miia-500 font-medium hover:underline">+ Nova</button>
                </div>
                {loadingTeamList && <div className="p-4 text-center text-xs text-slate-400">Carregando...</div>}
                {!loadingTeamList && teamList.map(t => {
                  const isSelected = selectedTeamThread?.id === t.id;
                  return (
                    <button key={t.id} onClick={() => selectTeamThread(t)}
                      className={`w-full text-left px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors ${isSelected ? 'bg-violet-50 border-violet-100' : ''}`}>
                      <div className="flex items-start gap-2">
                        <div className="w-8 h-8 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                          {(t.colleague[0] || '?').toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-sm text-slate-700 truncate">{t.colleague}</div>
                          <div className="text-[10px] text-slate-500 truncate font-medium">{t.subject}</div>
                          <div className="text-[10px] text-slate-400 truncate mt-0.5">{t.snippet}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
                {!loadingTeamList && teamList.length === 0 && (
                  <div className="p-8 text-center text-slate-400 text-xs">Nenhuma conversa interna ainda</div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right panel */}
        <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden">
          {!selectedProspect && !selectedTeamThread && (
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
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  <button onClick={() => { setConsultarModal(true); setConsultarDone(''); }}
                    className="px-3 py-1 rounded-xl text-[10px] font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">
                    ↗ Consultar
                  </button>
                  <div className="flex gap-1 flex-wrap">
                    {PIPELINE_STAGES.map(s => (
                      <button key={s.key} onClick={() => movePipeline(selectedProspect, s.key)} disabled={movingPipeline}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all ${selectedProspect.pipeline === s.key ? s.color + ' border-current shadow-sm' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'}`}>
                        {s.label}
                      </button>
                    ))}
                  </div>
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
          {selectedTeamThread && (
            <>
              <div className="bg-white border-b border-slate-200 px-6 py-3 flex-shrink-0">
                <div className="font-semibold text-slate-800 text-sm">{selectedTeamThread.colleague}</div>
                <div className="text-xs text-slate-400">{selectedTeamThread.subject}</div>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                {loadingTeamThread && <div className="text-center text-xs text-slate-400 py-8">Carregando conversa...</div>}
                {!loadingTeamThread && teamMessages.length === 0 && <div className="text-center text-xs text-slate-400 py-8">Nenhuma mensagem</div>}
                {teamMessages.map((msg, i) => (
                  <div key={msg.id || i} className={`flex gap-2 ${msg.isMine ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-[10px] font-bold ${msg.isMine ? 'bg-violet-500 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
                      {msg.isMine ? 'Eu' : (msg.fromName?.[0] || '?').toUpperCase()}
                    </div>
                    <div className={`max-w-[75%] rounded-xl px-3 py-2 text-xs leading-relaxed ${msg.isMine ? 'bg-violet-500 text-white rounded-tr-sm' : 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm'}`}>
                      {!msg.isMine && <div className="font-semibold mb-1 text-[10px] text-slate-500">{msg.fromName}</div>}
                      <div className="whitespace-pre-wrap">{msg.body || '(sem conteúdo)'}</div>
                      {msg.date && <div className={`text-[9px] mt-1 ${msg.isMine ? 'text-white/60' : 'text-slate-400'}`}>{new Date(msg.date).toLocaleString('pt-BR')}</div>}
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              <div className="bg-white border-t border-slate-200 px-6 py-3 flex-shrink-0 space-y-2">
                {teamReplyMsg && <p className={`text-xs font-medium ${teamReplyMsg === 'Enviado!' ? 'text-green-600' : 'text-red-500'}`}>{teamReplyMsg}</p>}
                <div className="flex gap-2 items-end">
                  <textarea value={teamReplyDraft} onChange={e => setTeamReplyDraft(e.target.value)} placeholder={`Responder para ${selectedTeamThread.colleague}...`} rows={2}
                    onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendTeamReply(); }}
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400/50 resize-none" />
                  <button onClick={sendTeamReply} disabled={sendingTeamReply || !teamReplyDraft.trim()}
                    className="px-4 py-2 bg-violet-500 text-white rounded-xl text-xs font-medium hover:bg-violet-600 disabled:opacity-50 self-end">
                    {sendingTeamReply ? '...' : 'Enviar'}
                  </button>
                </div>
                <p className="text-[10px] text-slate-300">⌘+Enter para enviar</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Consultar modal */}
      {consultarModal && selectedProspect && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-slate-800 mb-1">Consultar colega</h3>
            <p className="text-xs text-slate-400 mb-4">
              Envia um email para o colega com a última mensagem de <strong>{[selectedProspect.firstName, selectedProspect.lastName].filter(Boolean).join(' ') || selectedProspect.email}</strong>
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Para (email do colega)</label>
                <input type="email" value={consultarTo} onChange={e => setConsultarTo(e.target.value)}
                  placeholder="jal@miia.tech" autoFocus
                  className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-miia-400/50" />
              </div>
              <div>
                <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Nota (opcional)</label>
                <textarea value={consultarNote} onChange={e => setConsultarNote(e.target.value)}
                  placeholder="O que você acha desse prospect?" rows={2}
                  className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-miia-400/50 resize-none" />
              </div>
            </div>
            {consultarDone && <p className={`text-xs font-medium mt-3 ${consultarDone.startsWith('Erro') ? 'text-red-500' : 'text-green-600'}`}>{consultarDone}</p>}
            <div className="flex gap-2 mt-4">
              <button onClick={() => setConsultarModal(false)}
                className="flex-1 px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50">
                Cancelar
              </button>
              <button onClick={sendConsultar} disabled={consultarLoading || !consultarTo.trim()}
                className="flex-1 px-4 py-2 bg-miia-500 text-white rounded-xl text-sm font-medium hover:bg-miia-600 disabled:opacity-50">
                {consultarLoading ? '...' : 'Enviar email'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nova conversa modal */}
      {newConvModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-slate-800 mb-4">Nova mensagem interna</h3>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Para</label>
                <input type="email" value={newConvTo} onChange={e => setNewConvTo(e.target.value)}
                  placeholder="colega@miia.tech" autoFocus
                  className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-miia-400/50" />
              </div>
              <div>
                <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">Mensagem</label>
                <textarea value={newConvBody} onChange={e => setNewConvBody(e.target.value)} rows={3}
                  className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-miia-400/50 resize-none" />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setNewConvModal(false)}
                className="flex-1 px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50">
                Cancelar
              </button>
              <button onClick={sendNewConv} disabled={newConvSending || !newConvTo.trim() || !newConvBody.trim()}
                className="flex-1 px-4 py-2 bg-violet-500 text-white rounded-xl text-sm font-medium hover:bg-violet-600 disabled:opacity-50">
                {newConvSending ? '...' : 'Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
