'use client';

import { useState, useEffect } from 'react';

interface PainelRow {
  category: string; responsavel: string; nomeRemetente: string;
  emailsHora: number; diasFup1: number; diasFup2: number;
  ativo: boolean; cc: string; horaInicio: number; horaFim: number;
}

interface CatStats {
  total: number; pendentes: number; email1: number; fup1: number; fup2: number; respondidos: number; erros: number;
}

export default function SettingsPage() {
  const [painel, setPainel] = useState<PainelRow[]>([]);
  const [stats, setStats] = useState<Record<string, CatStats>>({});
  const [totalGeral, setTotalGeral] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number>(-1);
  const [clearing, setClearing] = useState<string>('');
  const [sending, setSending] = useState<string>('');
  const [retrying, setRetrying] = useState(false);
  const [message, setMessage] = useState('');
  const [confirmClear, setConfirmClear] = useState<string>('');
  const [confirmDelete, setConfirmDelete] = useState<string>('');
  const [deletingCat, setDeletingCat] = useState<string>('');
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCat, setNewCat] = useState({ category: '', responsavel: '', nomeRemetente: '', emailsHora: 20, diasFup1: 3, diasFup2: 7, ativo: true, cc: '', horaInicio: 8, horaFim: 20 });
  const [creatingCat, setCreatingCat] = useState(false);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      fetch('/api/sheets?type=painel').then(r => r.json()),
      fetch('/api/dashboard', { cache: 'no-store' }).then(r => r.json()),
    ]).then(([painelData, dashData]) => {
      if (Array.isArray(painelData)) setPainel(painelData);
      if (dashData.stats) setStats(dashData.stats);
      if (dashData.totalGeral) setTotalGeral(dashData.totalGeral);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const getTotalErros = () => {
    return totalGeral.erros || 0;
  };

  const toggleAtivo = async (idx: number) => {
    const updated = [...painel];
    updated[idx] = { ...updated[idx], ativo: !updated[idx].ativo };
    setPainel(updated);
    await saveRow(idx, updated[idx]);
  };

  const updateField = (idx: number, field: keyof PainelRow, value: any) => {
    const updated = [...painel];
    (updated[idx] as any)[field] = value;
    setPainel(updated);
  };

  const saveRow = async (idx: number, row?: PainelRow) => {
    const r = row || painel[idx];
    setSaving(idx);
    setMessage('');
    try {
      await fetch('/api/sheets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'painel',
          rowIndex: idx + 2,
          values: [r.category, r.responsavel, r.nomeRemetente, r.emailsHora, r.diasFup1, r.diasFup2, r.ativo ? 'SIM' : 'NAO', r.cc, '', r.horaInicio ?? 8, r.horaFim ?? 20],
        }),
      });
      setMessage('Salvo: ' + r.category);
    } catch (e: any) {
      setMessage('Erro: ' + e.message);
    } finally {
      setSaving(-1);
    }
  };

  const handleSendNow = async (category: string) => {
    setSending(category);
    setMessage('');
    try {
      const res = await fetch('/api/send-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category }),
      });
      const data = await res.json();
      if (data.enviados > 0) {
        setMessage(data.enviados + ' emails enviados para "' + category + '"!');
      } else if (data.erros?.length > 0) {
        setMessage('Erros ao enviar "' + category + '": ' + data.erros.join(', '));
      } else {
        setMessage('Nenhum email pendente em "' + category + '".');
      }
      loadData();
    } catch (e: any) {
      setMessage('Erro: ' + e.message);
    } finally {
      setSending('');
    }
  };

  const handleRetryErrors = async () => {
    setRetrying(true);
    setMessage('');
    try {
      const res = await fetch('/api/retry-errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.corrigidos > 0) {
        setMessage(data.corrigidos + ' emails corrigidos e reenviados!');
      } else if (data.erros?.length > 0) {
        setMessage('Erros persistem: ' + data.erros.join(', '));
      } else {
        setMessage('Nenhum erro encontrado.');
      }
      loadData();
    } catch (e: any) {
      setMessage('Erro: ' + e.message);
    } finally {
      setRetrying(false);
    }
  };

  const handleCreateCategory = async () => {
    if (!newCat.category.trim()) { setMessage('Nome da category obrigatorio'); return; }
    if (!newCat.responsavel.trim()) { setMessage('Email do responsavel obrigatorio'); return; }
    if (!newCat.nomeRemetente.trim()) { setMessage('Nome do remetente obrigatorio'); return; }
    setCreatingCat(true);
    setMessage('');
    try {
      await fetch('/api/sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'painel',
          values: [newCat.category, newCat.responsavel, newCat.nomeRemetente, newCat.emailsHora, newCat.diasFup1, newCat.diasFup2, newCat.ativo ? 'SIM' : 'NAO', newCat.cc, '', newCat.horaInicio, newCat.horaFim],
        }),
      });
      setMessage('Category "' + newCat.category + '" criada!');
      setShowNewCat(false);
      setNewCat({ category: '', responsavel: '', nomeRemetente: '', emailsHora: 20, diasFup1: 3, diasFup2: 7, ativo: true, cc: '', horaInicio: 8, horaFim: 20 });
      loadData();
    } catch (e: any) {
      setMessage('Erro: ' + e.message);
    } finally {
      setCreatingCat(false);
    }
  };

  const handleClearBase = async (category: string) => {
    if (confirmClear !== category) {
      setConfirmClear(category);
      return;
    }
    setClearing(category);
    setMessage('');
    setConfirmClear('');
    try {
      const res = await fetch('/api/sheets', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessage(data.deleted + ' contatos de "' + category + '" removidos!');
      loadData();
    } catch (e: any) {
      setMessage('Erro: ' + e.message);
    } finally {
      setClearing('');
    }
  };

  const handleDeleteCategory = async (category: string) => {
    if (confirmDelete !== category) {
      setConfirmDelete(category);
      return;
    }
    setDeletingCat(category);
    setMessage('');
    setConfirmDelete('');
    try {
      const res = await fetch('/api/sheets', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, deleteFromPainel: true, deleteFromTemplates: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessage('Category "' + category + '" excluida!');
      loadData();
    } catch (e: any) {
      setMessage('Erro: ' + e.message);
    } finally {
      setDeletingCat('');
    }
  };

  if (loading) return <div className="animate-pulse"><div className="h-8 bg-slate-200 rounded w-48 mb-8" />{[1,2,3].map(i => <div key={i} className="h-40 bg-slate-200 rounded-2xl mb-4" />)}</div>;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-slate-800">Painel de Controle</h1>
        <p className="text-slate-500 mt-1">Configure categories e gerencie bases</p>
        {message && <p className="text-sm mt-2 bg-white border border-slate-200 rounded-xl px-4 py-2 inline-block">{message}</p>}
      </div>

      <div className="flex gap-3 mb-8 flex-wrap">
        <button onClick={() => setShowNewCat(!showNewCat)}
          className="px-5 py-2.5 bg-green-500 text-white rounded-xl text-sm font-medium hover:bg-green-600 shadow-lg shadow-green-500/20 flex items-center gap-2">
          <span>+</span> Nova Category
        </button>
        <button onClick={() => loadData()} className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50">
          Atualizar
        </button>
        {painel.some(p => p.ativo) && (
          <button
            onClick={async () => {
              setMessage('Pausando tudo...');
              for (let i = 0; i < painel.length; i++) {
                if (painel[i].ativo) await saveRow(i, { ...painel[i], ativo: false });
              }
              loadData();
              setMessage('Todas as rotinas pausadas.');
            }}
            className="px-5 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 shadow-lg shadow-amber-500/20 flex items-center gap-2">
            ⏸ Pausar Tudo
          </button>
        )}
        {painel.some(p => !p.ativo) && (
          <button
            onClick={async () => {
              setMessage('Retomando tudo...');
              for (let i = 0; i < painel.length; i++) {
                if (!painel[i].ativo) await saveRow(i, { ...painel[i], ativo: true });
              }
              loadData();
              setMessage('Todas as rotinas retomadas.');
            }}
            className="px-5 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 shadow-lg shadow-green-600/20 flex items-center gap-2">
            ▶ Retomar Tudo
          </button>
        )}
        {getTotalErros() > 0 && (
          <button onClick={handleRetryErrors} disabled={retrying}
            className="px-5 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 shadow-lg shadow-orange-500/20 flex items-center gap-2 disabled:opacity-50">
            {retrying ? 'Corrigindo...' : 'Corrigir Erros (' + getTotalErros() + ')'}
          </button>
        )}
      </div>

      {showNewCat && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-6 mb-6">
          <h3 className="font-semibold text-green-800 mb-4">Criar Nova Category</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <SettingField label="Nome da Category" value={newCat.category} onChange={v => setNewCat({...newCat, category: v})} />
            <SettingField label="Responsavel (email)" value={newCat.responsavel} onChange={v => setNewCat({...newCat, responsavel: v})} />
            <SettingField label="Nome Remetente" value={newCat.nomeRemetente} onChange={v => setNewCat({...newCat, nomeRemetente: v})} />
            <SettingField label="Emails/Hora" value={newCat.emailsHora.toString()} onChange={v => setNewCat({...newCat, emailsHora: parseInt(v) || 20})} type="number" />
            <SettingField label="CC (opcional)" value={newCat.cc} onChange={v => setNewCat({...newCat, cc: v})} />
            <SettingField label="Dias ate FUP1" value={newCat.diasFup1.toString()} onChange={v => setNewCat({...newCat, diasFup1: parseInt(v) || 3})} type="number" />
            <SettingField label="Dias ate FUP2" value={newCat.diasFup2.toString()} onChange={v => setNewCat({...newCat, diasFup2: parseInt(v) || 7})} type="number" />
            <SettingField label="Hora inicio (ex: 8)" value={newCat.horaInicio.toString()} onChange={v => setNewCat({...newCat, horaInicio: parseInt(v) || 0})} type="number" />
            <SettingField label="Hora fim (ex: 20)" value={newCat.horaFim.toString()} onChange={v => setNewCat({...newCat, horaFim: parseInt(v) || 24})} type="number" />
          </div>
          <div className="flex gap-3">
            <button onClick={handleCreateCategory} disabled={creatingCat}
              className="px-6 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-50">
              {creatingCat ? 'Criando...' : 'Criar Category'}
            </button>
            <button onClick={() => setShowNewCat(false)}
              className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50">
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {painel.map((row, idx) => {
          const catStats = stats[row.category] || { total: 0, pendentes: 0, email1: 0, fup1: 0, fup2: 0, respondidos: 0, erros: 0 };
          return (
            <div key={idx} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <div className="flex items-center gap-4">
                  <h3 className="font-semibold text-slate-800 text-lg">{row.category}</h3>
                  <button onClick={() => toggleAtivo(idx)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${row.ativo ? 'bg-green-500' : 'bg-slate-300'}`}>
                    <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${row.ativo ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                  <span className={`text-xs font-medium ${row.ativo ? 'text-green-600' : 'text-slate-400'}`}>
                    {row.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleSendNow(row.category)} disabled={sending === row.category || !row.ativo}
                    className="px-4 py-1.5 bg-blue-500 text-white text-xs rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 flex items-center gap-1">
                    {sending === row.category ? 'Enviando...' : 'Enviar Agora'}
                  </button>
                  <button onClick={() => saveRow(idx)} disabled={saving === idx}
                    className="px-4 py-1.5 bg-miia-500 text-white text-xs rounded-lg font-medium hover:bg-miia-600 disabled:opacity-50">
                    {saving === idx ? 'Salvando...' : 'Salvar'}
                  </button>
                  {confirmDelete === row.category ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleDeleteCategory(row.category)} disabled={deletingCat === row.category}
                        className="px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg font-medium hover:bg-red-700">
                        {deletingCat === row.category ? '...' : 'Confirmar'}
                      </button>
                      <button onClick={() => setConfirmDelete('')}
                        className="px-3 py-1.5 bg-slate-200 text-slate-600 text-xs rounded-lg font-medium">
                        Nao
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => handleDeleteCategory(row.category)}
                      className="px-3 py-1.5 bg-red-50 text-red-600 text-xs rounded-lg font-medium hover:bg-red-100 border border-red-200">
                      Excluir
                    </button>
                  )}
                </div>
              </div>

              <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-6 flex-wrap">
                <StatPill label="Total" value={catStats.total} color="text-slate-700 bg-slate-200" />
                <StatPill label="Pendentes" value={catStats.pendentes} color="text-amber-700 bg-amber-100" />
                <StatPill label="Enviados" value={catStats.email1} color="text-blue-700 bg-blue-100" />
                <StatPill label="FUP1" value={catStats.fup1} color="text-indigo-700 bg-indigo-100" />
                <StatPill label="FUP2" value={catStats.fup2} color="text-purple-700 bg-purple-100" />
                <StatPill label="Respondidos" value={catStats.respondidos} color="text-green-700 bg-green-100" />
                {catStats.erros > 0 && <StatPill label="Erros" value={catStats.erros} color="text-red-700 bg-red-100" />}
                <div className="ml-auto">
                  {confirmClear === row.category ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-red-600 font-medium">Tem certeza?</span>
                      <button onClick={() => handleClearBase(row.category)} disabled={clearing === row.category}
                        className="px-3 py-1 bg-red-500 text-white text-xs rounded-lg font-medium hover:bg-red-600">
                        {clearing === row.category ? 'Limpando...' : 'Sim, limpar'}
                      </button>
                      <button onClick={() => setConfirmClear('')}
                        className="px-3 py-1 bg-slate-200 text-slate-600 text-xs rounded-lg font-medium hover:bg-slate-300">
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => handleClearBase(row.category)}
                      className="px-3 py-1.5 bg-red-50 text-red-600 text-xs rounded-lg font-medium hover:bg-red-100 border border-red-200">
                      Limpar base ({catStats.total})
                    </button>
                  )}
                </div>
              </div>

              <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                <SettingField label="Responsavel (email)" value={row.responsavel} onChange={v => updateField(idx, 'responsavel', v)} />
                <SettingField label="Nome Remetente" value={row.nomeRemetente} onChange={v => updateField(idx, 'nomeRemetente', v)} />
                <SettingField label="Emails/Hora" value={row.emailsHora.toString()} onChange={v => updateField(idx, 'emailsHora', parseInt(v) || 20)} type="number" />
                <SettingField label="CC (opcional)" value={row.cc} onChange={v => updateField(idx, 'cc', v)} />
                <SettingField label="Dias ate FUP1" value={row.diasFup1.toString()} onChange={v => updateField(idx, 'diasFup1', parseInt(v) || 3)} type="number" />
                <SettingField label="Dias ate FUP2" value={row.diasFup2.toString()} onChange={v => updateField(idx, 'diasFup2', parseInt(v) || 7)} type="number" />
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Janela de envio</label>
                  <div className="flex items-center gap-2">
                    <input type="number" min={0} max={23} value={row.horaInicio ?? 8}
                      onChange={e => updateField(idx, 'horaInicio', parseInt(e.target.value) || 0)}
                      className="w-16 px-2 py-2 border border-slate-200 rounded-xl text-sm text-center focus:outline-none focus:ring-2 focus:ring-miia-400/50" />
                    <span className="text-xs text-slate-400">h ate</span>
                    <input type="number" min={1} max={24} value={row.horaFim ?? 20}
                      onChange={e => updateField(idx, 'horaFim', parseInt(e.target.value) || 24)}
                      className="w-16 px-2 py-2 border border-slate-200 rounded-xl text-sm text-center focus:outline-none focus:ring-2 focus:ring-miia-400/50" />
                    <span className="text-xs text-slate-400">h</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${color}`}>{value}</span>
      <span className="text-xs text-slate-500">{label}</span>
    </div>
  );
}

function SettingField({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="text-xs text-slate-500 mb-1 block">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-miia-400/50 focus:border-miia-400" />
    </div>
  );
}