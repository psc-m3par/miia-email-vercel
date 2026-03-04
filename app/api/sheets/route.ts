'use client';

import { useState, useEffect } from 'react';

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzXGYYkwrYIfQO_gsy0Lg1RU70Ea8-t_eIEFHbcW3ha24BH2qJuWwQvpTm1vGS5gmlM6w/exec';

interface PainelRow {
  category: string; responsavel: string; nomeRemetente: string;
  emailsHora: number; diasFup1: number; diasFup2: number;
  ativo: boolean; cc: string;
}

interface CatStats {
  total: number; pendentes: number; email1: number; fup1: number; fup2: number; respondidos: number;
}

export default function SettingsPage() {
  const [painel, setPainel] = useState<PainelRow[]>([]);
  const [stats, setStats] = useState<Record<string, CatStats>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number>(-1);
  const [clearing, setClearing] = useState<string>('');
  const [message, setMessage] = useState('');
  const [confirmClear, setConfirmClear] = useState<string>('');
  const [triggerLoading, setTriggerLoading] = useState('');

  const loadData = () => {
    setLoading(true);
    Promise.all([
      fetch('/api/sheets?type=painel').then(r => r.json()),
      fetch('/api/dashboard', { cache: 'no-store' }).then(r => r.json()),
    ]).then(([painelData, dashData]) => {
      if (Array.isArray(painelData)) setPainel(painelData);
      if (dashData.stats) setStats(dashData.stats);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

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
          values: [r.category, r.responsavel, r.nomeRemetente, r.emailsHora, r.diasFup1, r.diasFup2, r.ativo ? 'SIM' : 'NAO', r.cc],
        }),
      });
      setMessage('Salvo: ' + r.category);
    } catch (e: any) {
      setMessage('Erro: ' + e.message);
    } finally {
      setSaving(-1);
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

  const handleTrigger = async (action: string) => {
    setTriggerLoading(action);
    setMessage('');
    try {
      const url = APPS_SCRIPT_URL + '?action=' + action;
      const res = await fetch(url, { redirect: 'follow' });
      const text = await res.text();
      if (text.includes('"ok"') || text.includes('true')) {
        setMessage(action === 'enviar' ? 'Emails enviados!' : 'FUPs enviados!');
        setTimeout(() => loadData(), 3000);
      } else {
        setMessage('Resposta: ' + text.substring(0, 100));
      }
    } catch (e: any) {
      setMessage('Erro: ' + e.message);
    } finally {
      setTriggerLoading('');
    }
  };

  if (loading) return <div className="animate-pulse"><div className="h-8 bg-slate-200 rounded w-48 mb-8" />{[1,2,3].map(i => <div key={i} className="h-40 bg-slate-200 rounded-2xl mb-4" />)}</div>;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-slate-800">Painel de Controle</h1>
        <p className="text-slate-500 mt-1">Configure categories, envie emails e gerencie bases</p>
        {message && <p className="text-sm mt-2 bg-white border border-slate-200 rounded-xl px-4 py-2 inline-block">{message}</p>}
      </div>

      <div className="flex gap-3 mb-8">
        <button onClick={() => handleTrigger('enviar')} disabled={triggerLoading === 'enviar'}
          className="px-5 py-2.5 bg-miia-500 text-white rounded-xl text-sm font-medium hover:bg-miia-600 disabled:opacity-50 shadow-lg shadow-miia-500/20 flex items-center gap-2">
          {triggerLoading === 'enviar' ? <Spinner /> : <span>🚀</span>}
          {triggerLoading === 'enviar' ? 'Enviando...' : 'Enviar Emails Agora'}
        </button>
        <button onClick={() => handleTrigger('fups')} disabled={triggerLoading === 'fups'}
          className="px-5 py-2.5 bg-indigo-500 text-white rounded-xl text-sm font-medium hover:bg-indigo-600 disabled:opacity-50 shadow-lg shadow-indigo-500/20 flex items-center gap-2">
          {triggerLoading === 'fups' ? <Spinner /> : <span>↩️</span>}
          {triggerLoading === 'fups' ? 'Enviando...' : 'Enviar FUPs Agora'}
        </button>
        <button onClick={() => loadData()} className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50">
          Atualizar
        </button>
      </div>

      <div className="space-y-4">
        {painel.map((row, idx) => {
          const catStats = stats[row.category] || { total: 0, pendentes: 0, email1: 0, fup1: 0, fup2: 0, respondidos: 0 };
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
                <button onClick={() => saveRow(idx)} disabled={saving === idx}
                  className="px-4 py-1.5 bg-miia-500 text-white text-xs rounded-lg font-medium hover:bg-miia-600 disabled:opacity-50">
                  {saving === idx ? 'Salvando...' : 'Salvar'}
                </button>
              </div>

              <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-6 flex-wrap">
                <StatPill label="Total" value={catStats.total} color="text-slate-700 bg-slate-200" />
                <StatPill label="Pendentes" value={catStats.pendentes} color="text-amber-700 bg-amber-100" />
                <StatPill label="Enviados" value={catStats.email1} color="text-blue-700 bg-blue-100" />
                <StatPill label="FUP1" value={catStats.fup1} color="text-indigo-700 bg-indigo-100" />
                <StatPill label="FUP2" value={catStats.fup2} color="text-purple-700 bg-purple-100" />
                <StatPill label="Respondidos" value={catStats.respondidos} color="text-green-700 bg-green-100" />
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

function Spinner() {
  return <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>;
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
``