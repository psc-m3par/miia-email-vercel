'use client';

import { useState, useEffect, useCallback } from 'react';

interface Comentario {
  autor: string;
  texto: string;
  timestamp: string;
}

interface Tese {
  id: string;
  rowIndex: number;
  tese: string;
  template: string;
  potenciaisClientes: string;
  status: 'NOVA' | 'APROVACAO' | 'APROVADA';
  criadoPor: string;
  nomeRemetente: string;
  aprovador: string;
  threadId: string;
  comentarios: Comentario[];
  dataCriacao: string;
  categoria: string;
}

interface TokenAccount {
  email: string;
  status: 'ativo' | 'expirado';
}

interface SessionUser {
  user: string;
}

const COLUMNS = [
  {
    key: 'NOVA' as const,
    label: 'Nova Tese',
    color: 'border-t-amber-400',
    badgeBg: 'bg-amber-100 text-amber-700',
    countColor: 'text-amber-600',
    emptyText: 'Nenhuma tese nova',
  },
  {
    key: 'APROVACAO' as const,
    label: 'Aprovação',
    color: 'border-t-blue-400',
    badgeBg: 'bg-blue-100 text-blue-700',
    countColor: 'text-blue-600',
    emptyText: 'Nenhuma aguardando',
  },
  {
    key: 'APROVADA' as const,
    label: 'Aprovada',
    color: 'border-t-green-400',
    badgeBg: 'bg-green-100 text-green-700',
    countColor: 'text-green-600',
    emptyText: 'Nenhuma aprovada',
  },
];

function formatDate(iso: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  } catch { return iso; }
}

function formatDateTime(iso: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

export default function TesesPage() {
  const [teses, setTeses] = useState<Tese[]>([]);
  const [loading, setLoading] = useState(true);
  const [tokens, setTokens] = useState<TokenAccount[]>([]);
  const [currentUser, setCurrentUser] = useState<string>('');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTese, setSelectedTese] = useState<Tese | null>(null);

  // Create form
  const [createForm, setCreateForm] = useState({
    tese: '',
    template: '',
    potenciaisClientes: '',
    nomeRemetente: '',
    aprovador: '',
    categoria: '',
  });
  const [creating, setCreating] = useState(false);

  // Detail modal actions
  const [sendingAprovacao, setSendingAprovacao] = useState(false);
  const [aprovacaoAprovador, setAprovacaoAprovador] = useState('');
  const [aprovacaoSender, setAprovacaoSender] = useState('');
  const [comentarioText, setComentarioText] = useState('');
  const [addingComment, setAddingComment] = useState(false);
  const [approving, setApproving] = useState(false);
  const [categoriaInput, setCategoriaInput] = useState('');
  const [reenviando, setReenviando] = useState(false);
  const [reenvioSender, setReenvioSender] = useState('');
  const [actionError, setActionError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [tesRes, tokRes, sesRes] = await Promise.all([
        fetch('/api/teses', { cache: 'no-store' }),
        fetch('/api/tokens', { cache: 'no-store' }),
        fetch('/api/session', { cache: 'no-store' }),
      ]);
      const [tesData, tokData, sesData] = await Promise.all([
        tesRes.json(),
        tokRes.json(),
        sesRes.json(),
      ]);
      setTeses(Array.isArray(tesData) ? tesData : []);
      setTokens(Array.isArray(tokData) ? tokData.filter((t: TokenAccount) => t.status === 'ativo') : []);
      setCurrentUser((sesData as SessionUser).user || '');
    } catch {
      setTeses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-set sender from tokens when they load
  useEffect(() => {
    if (tokens.length > 0) {
      if (!aprovacaoSender) setAprovacaoSender(tokens[0].email);
      if (!reenvioSender) setReenvioSender(tokens[0].email);
    }
  }, [tokens]);

  const createTese = async () => {
    if (!createForm.tese.trim()) { alert('Tese é obrigatória'); return; }
    if (!createForm.categoria.trim()) { alert('Categoria é obrigatória'); return; }
    setCreating(true);
    try {
      const res = await fetch('/api/teses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...createForm, criadoPor: currentUser }),
      });
      const data = await res.json();
      if (data.ok) {
        setShowCreateModal(false);
        setCreateForm({ tese: '', template: '', potenciaisClientes: '', nomeRemetente: '', aprovador: '', categoria: '' });
        await loadData();
      } else {
        alert('Erro: ' + (data.error || 'desconhecido'));
      }
    } catch (e: any) {
      alert('Erro: ' + e.message);
    } finally {
      setCreating(false);
    }
  };

  const enviarAprovacao = async () => {
    if (!selectedTese) return;
    if (!aprovacaoAprovador) { setActionError('Selecione um aprovador'); return; }
    if (!aprovacaoSender) { setActionError('Selecione uma conta de envio'); return; }
    setSendingAprovacao(true);
    setActionError('');
    try {
      const res = await fetch('/api/teses', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rowIndex: selectedTese.rowIndex,
          action: 'enviar-aprovacao',
          aprovador: aprovacaoAprovador,
          senderEmail: aprovacaoSender,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        await loadData();
        setSelectedTese(prev => prev ? { ...prev, status: 'APROVACAO', aprovador: aprovacaoAprovador, threadId: data.threadId || prev.threadId } : null);
      } else {
        setActionError(data.error || 'Erro desconhecido');
      }
    } catch (e: any) {
      setActionError(e.message);
    } finally {
      setSendingAprovacao(false);
    }
  };

  const aprovarTese = async () => {
    if (!selectedTese) return;
    if (!categoriaInput.trim()) { setActionError('Informe o nome da categoria'); return; }
    setApproving(true);
    setActionError('');
    try {
      const res = await fetch('/api/teses', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rowIndex: selectedTese.rowIndex,
          action: 'aprovar',
          categoria: categoriaInput.trim(),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        await loadData();
        setSelectedTese(prev => prev ? { ...prev, status: 'APROVADA', categoria: categoriaInput.trim() } : null);
        setCategoriaInput('');
      } else {
        setActionError(data.error || 'Erro desconhecido');
      }
    } catch (e: any) {
      setActionError(e.message);
    } finally {
      setApproving(false);
    }
  };

  const deleteTese = async (t: Tese) => {
    if (!confirm(`Deletar tese "${t.tese.slice(0, 50)}..."?`)) return;
    try {
      await fetch(`/api/teses?rowIndex=${t.rowIndex}`, {
        method: 'DELETE',
      });
      setSelectedTese(null);
      await loadData();
    } catch (e: any) {
      alert('Erro: ' + e.message);
    }
  };

  const addComentario = async () => {
    if (!selectedTese || !comentarioText.trim()) return;
    setAddingComment(true);
    setActionError('');
    try {
      const res = await fetch('/api/teses', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rowIndex: selectedTese.rowIndex,
          action: 'comentar',
          autor: currentUser || 'Usuário',
          texto: comentarioText.trim(),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        const novoComentario = data.comentario as Comentario;
        setSelectedTese(prev => prev ? { ...prev, comentarios: [...(prev.comentarios || []), novoComentario] } : null);
        setTeses(prev => prev.map(t => t.rowIndex === selectedTese.rowIndex
          ? { ...t, comentarios: [...(t.comentarios || []), novoComentario] }
          : t
        ));
        setComentarioText('');
      } else {
        setActionError(data.error || 'Erro desconhecido');
      }
    } catch (e: any) {
      setActionError(e.message);
    } finally {
      setAddingComment(false);
    }
  };

  const reenviarTese = async () => {
    if (!selectedTese) return;
    if (!reenvioSender) { setActionError('Selecione uma conta de envio'); return; }
    setReenviando(true);
    setActionError('');
    try {
      const res = await fetch('/api/teses', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rowIndex: selectedTese.rowIndex,
          action: 'reenviar',
          senderEmail: reenvioSender,
          aprovador: selectedTese.aprovador,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        await loadData();
        setSelectedTese(prev => prev ? { ...prev, status: 'APROVACAO' } : null);
      } else {
        setActionError(data.error || 'Erro desconhecido');
      }
    } catch (e: any) {
      setActionError(e.message);
    } finally {
      setReenviando(false);
    }
  };

  const openDetail = (t: Tese) => {
    setSelectedTese(t);
    setActionError('');
    setComentarioText('');
    setCategoriaInput(t.categoria || '');
    setAprovacaoAprovador(t.aprovador || (tokens[0]?.email || ''));
    if (!aprovacaoSender && tokens.length > 0) setAprovacaoSender(tokens[0].email);
    if (!reenvioSender && tokens.length > 0) setReenvioSender(tokens[0].email);
  };

  const byStatus = (status: Tese['status']) => teses.filter(t => t.status === status);

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-slate-200 rounded w-48 mb-8" />
        <div className="flex gap-4">
          {[1, 2, 3].map(i => <div key={i} className="flex-1 h-64 bg-slate-200 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full">
      {/* Header */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="font-display text-3xl font-bold text-slate-800">Novas Teses</h1>
          <p className="text-slate-400 text-sm mt-1">
            {teses.length} tese{teses.length !== 1 ? 's' : ''} · {byStatus('APROVADA').length} aprovada{byStatus('APROVADA').length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadData} className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50">
            Atualizar
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-miia-500 text-white rounded-xl text-sm font-medium hover:bg-miia-600"
          >
            + Nova Tese
          </button>
        </div>
      </div>

      {/* Kanban board */}
      <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: '60vh' }}>
        {COLUMNS.map(col => {
          const colTeses = byStatus(col.key);
          return (
            <div
              key={col.key}
              className={`flex-shrink-0 w-72 bg-slate-50 rounded-xl border-t-4 ${col.color} border border-slate-200 flex flex-col`}
            >
              {/* Column header */}
              <div className="px-3 py-3 flex items-center justify-between border-b border-slate-200">
                <span className="text-xs font-semibold text-slate-700">{col.label}</span>
                <span className={`text-xs font-bold ${col.countColor}`}>{colTeses.length}</span>
              </div>

              {/* Cards */}
              <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                {colTeses.length === 0 && (
                  <div className="text-center py-10 text-xs text-slate-300">{col.emptyText}</div>
                )}
                {colTeses.map(t => (
                  <button
                    key={t.id}
                    onClick={() => openDetail(t)}
                    className="w-full text-left bg-white rounded-xl border border-slate-200 p-3 shadow-sm hover:shadow-md transition-shadow focus:outline-none focus:ring-2 focus:ring-miia-400/40"
                  >
                    {/* Tese preview */}
                    <p className="text-xs font-semibold text-slate-800 line-clamp-2 mb-2">
                      {t.tese}
                    </p>

                    <div className="space-y-1">
                      {/* Creator */}
                      {t.criadoPor && (
                        <div className="flex items-center gap-1">
                          <div className="w-4 h-4 rounded-full bg-miia-50 flex items-center justify-center flex-shrink-0">
                            <span className="text-[8px] font-bold text-miia-600">{t.criadoPor[0]?.toUpperCase()}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 truncate">{t.criadoPor}</span>
                        </div>
                      )}

                      {/* Approver */}
                      {t.aprovador && (
                        <div className="flex items-center gap-1">
                          <svg className="w-3 h-3 text-slate-300 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                            <polyline points="22 4 12 14.01 9 11.01" />
                          </svg>
                          <span className="text-[10px] text-slate-400 truncate">{t.aprovador}</span>
                        </div>
                      )}

                      {/* Categoria */}
                      {t.categoria && (
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded-full font-medium">{t.categoria}</span>
                        </div>
                      )}

                      {/* Footer: comments + date */}
                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-1">
                          <svg className="w-3 h-3 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                          </svg>
                          <span className="text-[10px] text-slate-400">{(t.comentarios || []).length}</span>
                        </div>
                        <span className="text-[10px] text-slate-300">{formatDate(t.dataCriacao)}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── Create Modal ─────────────────────────────────────────────────────── */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-display text-lg font-bold text-slate-800">Nova Tese</h2>
                <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Tese *</label>
                  <textarea
                    value={createForm.tese}
                    onChange={e => setCreateForm(f => ({ ...f, tese: e.target.value }))}
                    placeholder="Descreva a tese de prospecção: público-alvo, problema resolvido, proposta de valor..."
                    rows={4}
                    className="mt-1 w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-miia-400/50 resize-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Template sugerido</label>
                  <textarea
                    value={createForm.template}
                    onChange={e => setCreateForm(f => ({ ...f, template: e.target.value }))}
                    placeholder="Escreva o rascunho do email de prospecção..."
                    rows={4}
                    className="mt-1 w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-miia-400/50 resize-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Potenciais clientes</label>
                  <textarea
                    value={createForm.potenciaisClientes}
                    onChange={e => setCreateForm(f => ({ ...f, potenciaisClientes: e.target.value }))}
                    placeholder="Quais empresas ou perfis seriam alvo desta tese?"
                    rows={3}
                    className="mt-1 w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-miia-400/50 resize-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Categoria *</label>
                  <input
                    value={createForm.categoria}
                    onChange={e => setCreateForm(f => ({ ...f, categoria: e.target.value }))}
                    placeholder="Nome da categoria que será criada ao aprovar"
                    className="mt-1 w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-miia-400/50"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Nome remetente</label>
                  <input
                    value={createForm.nomeRemetente}
                    onChange={e => setCreateForm(f => ({ ...f, nomeRemetente: e.target.value }))}
                    placeholder="Ex: João Silva – Empresa XYZ"
                    className="mt-1 w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-miia-400/50"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Aprovador sugerido</label>
                  {tokens.length > 0 ? (
                    <select
                      value={createForm.aprovador}
                      onChange={e => setCreateForm(f => ({ ...f, aprovador: e.target.value }))}
                      className="mt-1 w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-miia-400/50 bg-white"
                    >
                      <option value="">Selecionar depois</option>
                      {tokens.map(t => (
                        <option key={t.email} value={t.email}>{t.email}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={createForm.aprovador}
                      onChange={e => setCreateForm(f => ({ ...f, aprovador: e.target.value }))}
                      placeholder="email@empresa.com"
                      type="email"
                      className="mt-1 w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-miia-400/50"
                    />
                  )}
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={createTese}
                  disabled={creating}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-miia-500 rounded-xl hover:bg-miia-600 disabled:opacity-50"
                >
                  {creating ? 'Criando...' : 'Criar Tese'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Detail Modal ─────────────────────────────────────────────────────── */}
      {selectedTese && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => { setSelectedTese(null); setActionError(''); }}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6">
              {/* Modal header */}
              <div className="flex items-start justify-between mb-5">
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    selectedTese.status === 'NOVA' ? 'bg-amber-100 text-amber-700' :
                    selectedTese.status === 'APROVACAO' ? 'bg-blue-100 text-blue-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {selectedTese.status === 'NOVA' ? 'Nova Tese' : selectedTese.status === 'APROVACAO' ? 'Em Aprovação' : 'Aprovada'}
                  </span>
                  <span className="text-xs text-slate-400">{formatDateTime(selectedTese.dataCriacao)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => deleteTese(selectedTese)}
                    className="text-slate-300 hover:text-red-500 p-1 rounded-lg hover:bg-red-50 transition-colors"
                    title="Deletar tese"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14" />
                    </svg>
                  </button>
                  <button
                    onClick={() => { setSelectedTese(null); setActionError(''); }}
                    className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Tese */}
              <div className="mb-5">
                <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Tese</h3>
                <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed bg-slate-50 rounded-xl p-3 border border-slate-100">
                  {selectedTese.tese}
                </p>
              </div>

              {/* Template */}
              {selectedTese.template && (
                <div className="mb-5">
                  <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Template sugerido</h3>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed bg-violet-50 rounded-xl p-3 border border-violet-100">
                    {selectedTese.template}
                  </p>
                </div>
              )}

              {/* Potenciais clientes */}
              {selectedTese.potenciaisClientes && (
                <div className="mb-5">
                  <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Potenciais clientes</h3>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                    {selectedTese.potenciaisClientes}
                  </p>
                </div>
              )}

              {/* Meta info */}
              <div className="flex flex-wrap gap-3 mb-5">
                {selectedTese.criadoPor && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-400">Criado por:</span>
                    <span className="text-[10px] font-medium text-slate-600">{selectedTese.criadoPor}</span>
                  </div>
                )}
                {selectedTese.nomeRemetente && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-400">Remetente:</span>
                    <span className="text-[10px] font-medium text-slate-600">{selectedTese.nomeRemetente}</span>
                  </div>
                )}
                {selectedTese.aprovador && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-400">Aprovador:</span>
                    <span className="text-[10px] font-medium text-slate-600">{selectedTese.aprovador}</span>
                  </div>
                )}
                {selectedTese.categoria && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-400">Categoria criada:</span>
                    <span className="text-[10px] font-medium bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{selectedTese.categoria}</span>
                  </div>
                )}
              </div>

              {/* ── Action panel based on status ── */}
              {actionError && (
                <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
                  {actionError}
                </div>
              )}

              {/* NOVA: Send to approval */}
              {selectedTese.status === 'NOVA' && (
                <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <h4 className="text-xs font-semibold text-amber-800 mb-3">Enviar para Aprovação</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="text-[11px] font-medium text-slate-500">Aprovador *</label>
                      {tokens.length > 0 ? (
                        <select
                          value={aprovacaoAprovador}
                          onChange={e => setAprovacaoAprovador(e.target.value)}
                          className="mt-1 w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400/50 bg-white"
                        >
                          <option value="">Selecione...</option>
                          {tokens.map(t => <option key={t.email} value={t.email}>{t.email}</option>)}
                        </select>
                      ) : (
                        <input
                          value={aprovacaoAprovador}
                          onChange={e => setAprovacaoAprovador(e.target.value)}
                          placeholder="aprovador@empresa.com"
                          type="email"
                          className="mt-1 w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                        />
                      )}
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-slate-500">Enviar de *</label>
                      {tokens.length > 0 ? (
                        <select
                          value={aprovacaoSender}
                          onChange={e => setAprovacaoSender(e.target.value)}
                          className="mt-1 w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400/50 bg-white"
                        >
                          {tokens.map(t => <option key={t.email} value={t.email}>{t.email}</option>)}
                        </select>
                      ) : (
                        <input
                          value={aprovacaoSender}
                          onChange={e => setAprovacaoSender(e.target.value)}
                          placeholder="sua@conta.com"
                          type="email"
                          className="mt-1 w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                        />
                      )}
                    </div>
                    <button
                      onClick={enviarAprovacao}
                      disabled={sendingAprovacao}
                      className="w-full py-2 text-sm font-medium text-white bg-amber-500 rounded-xl hover:bg-amber-600 disabled:opacity-50"
                    >
                      {sendingAprovacao ? 'Enviando...' : 'Enviar para Aprovação'}
                    </button>
                  </div>
                </div>
              )}

              {/* APROVACAO: show approval actions */}
              {selectedTese.status === 'APROVACAO' && (
                <div className="mb-5 p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-4">
                  <div>
                    <h4 className="text-xs font-semibold text-blue-800 mb-1">Status</h4>
                    <p className="text-xs text-blue-600">
                      Aguardando resposta de <strong>{selectedTese.aprovador || 'aprovador'}</strong>.
                      {selectedTese.threadId && <span className="ml-1 text-blue-400">(Thread: {selectedTese.threadId.slice(0, 12)}...)</span>}
                    </p>
                  </div>

                  {/* Manual approve */}
                  <div>
                    <h4 className="text-xs font-semibold text-blue-800 mb-2">Marcar como Aprovado</h4>
                    <div className="flex gap-2">
                      <input
                        value={categoriaInput}
                        onChange={e => setCategoriaInput(e.target.value)}
                        placeholder="Nome da categoria (ex: Tech-PME-2026)"
                        className="flex-1 text-sm border border-blue-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400/50"
                      />
                      <button
                        onClick={aprovarTese}
                        disabled={approving}
                        className="px-4 py-2 text-sm font-medium text-white bg-green-500 rounded-xl hover:bg-green-600 disabled:opacity-50 whitespace-nowrap"
                      >
                        {approving ? 'Aprovando...' : 'Aprovar'}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Isso criará a categoria e o template automaticamente (ativo=FALSE)</p>
                  </div>
                </div>
              )}

              {/* APROVADA: show category info */}
              {selectedTese.status === 'APROVADA' && selectedTese.categoria && (
                <div className="mb-5 p-4 bg-green-50 border border-green-200 rounded-xl">
                  <h4 className="text-xs font-semibold text-green-800 mb-1">Tese Aprovada</h4>
                  <p className="text-xs text-green-700">
                    Categoria <strong>{selectedTese.categoria}</strong> criada com sucesso no Painel e Templates (ativo=FALSE).
                    Acesse o Painel para ativar quando estiver pronto.
                  </p>
                </div>
              )}

              {/* ── Comments thread ── */}
              <div className="border-t border-slate-100 pt-4">
                <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-3">
                  Comentários ({(selectedTese.comentarios || []).length})
                </h3>

                {(selectedTese.comentarios || []).length === 0 && (
                  <p className="text-xs text-slate-300 mb-4">Nenhum comentário ainda.</p>
                )}

                <div className="space-y-3 mb-4">
                  {(selectedTese.comentarios || []).map((c, idx) => (
                    <div key={idx} className="flex gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-miia-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-[9px] font-bold text-miia-600">{(c.autor || 'U')[0].toUpperCase()}</span>
                      </div>
                      <div className="flex-1 bg-slate-50 rounded-xl px-3 py-2">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[11px] font-semibold text-slate-700">{c.autor}</span>
                          <span className="text-[10px] text-slate-400">{formatDateTime(c.timestamp)}</span>
                        </div>
                        <p className="text-xs text-slate-600 whitespace-pre-wrap">{c.texto}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add comment */}
                <div className="flex gap-2">
                  <input
                    value={comentarioText}
                    onChange={e => setComentarioText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addComentario(); } }}
                    placeholder="Adicionar comentário... (Enter para enviar)"
                    className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-miia-400/50"
                  />
                  <button
                    onClick={addComentario}
                    disabled={addingComment || !comentarioText.trim()}
                    className="px-4 py-2 text-sm font-medium text-white bg-miia-500 rounded-xl hover:bg-miia-600 disabled:opacity-40"
                  >
                    {addingComment ? '...' : 'Enviar'}
                  </button>
                </div>
              </div>

              {/* Reenviar button (if has comments and is APROVACAO or APROVADA) */}
              {(selectedTese.status === 'APROVACAO' || (selectedTese.status === 'APROVADA' && (selectedTese.comentarios || []).length > 0)) && (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <h4 className="text-xs font-semibold text-slate-500 mb-2">Reenviar para revisão com comentários</h4>
                  <div className="flex gap-2">
                    {tokens.length > 0 ? (
                      <select
                        value={reenvioSender}
                        onChange={e => setReenvioSender(e.target.value)}
                        className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-miia-400/50 bg-white"
                      >
                        {tokens.map(t => <option key={t.email} value={t.email}>{t.email}</option>)}
                      </select>
                    ) : (
                      <input
                        value={reenvioSender}
                        onChange={e => setReenvioSender(e.target.value)}
                        placeholder="sua@conta.com"
                        className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-miia-400/50"
                      />
                    )}
                    <button
                      onClick={reenviarTese}
                      disabled={reenviando}
                      className="px-4 py-2 text-sm font-medium text-white bg-indigo-500 rounded-xl hover:bg-indigo-600 disabled:opacity-50 whitespace-nowrap"
                    >
                      {reenviando ? 'Reenviando...' : 'Reenviar'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
