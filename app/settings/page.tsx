'use client';

import { useState, useEffect } from 'react';

interface PainelRow {
  category: string; responsavel: string; nomeRemetente: string;
  emailsHora: number; diasFup1: number; diasFup2: number;
  ativo: boolean; cc: string;
}

export default function SettingsPage() {
  const [painel, setPainel] = useState<PainelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number>(-1);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('/api/sheets?type=painel')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setPainel(data); })
      .finally(() => setLoading(false));
  }, []);

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
          values: [r.category, r.responsavel, r.nomeRemetente, r.emailsHora, r.diasFup1, r.diasFup2, r.ativo ? 'SIM' : 'NÃO', r.cc],
        }),
      });
      setMessage(`✅ ${r.category} salvo!`);
    } catch (e: any) {
      setMessage(`❌ Erro: ${e.message}`);
    } finally {
      setSaving(-1);
    }
  };

  if (loading) return <div className="animate-pulse"><div className="h-8 bg-slate-200 rounded w-48 mb-8" />{[1,2,3].map(i => <div key={i} className="h-40 bg-slate-200 rounded-2xl mb-4" />)}</div>;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-slate-800">Painel de Controle</h1>
        <p className="text-slate-500 mt-1">Configure categories, responsáveis e limites</p>
        {message && <p className="text-sm mt-2">{message}</p>}
      </div>

      <div className="space-y-4">
        {painel.map((row, idx) => (
          <div key={idx} className="bg-white rounded-2xl border border-slate-200 overflow-hidden animate-slide-up shadow-sm hover:shadow-md" style={{ animationDelay: `${idx * 100}ms` }}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-4">
                <h3 className="font-semibold text-slate-800">{row.category}</h3>
                <button
                  onClick={() => toggleAtivo(idx)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${row.ativo ? 'bg-green-500' : 'bg-slate-300'}`}
                >
                  <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${row.ativo ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
                <span className={`text-xs font-medium ${row.ativo ? 'text-green-600' : 'text-slate-400'}`}>
                  {row.ativo ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              <button
                onClick={() => saveRow(idx)}
                disabled={saving === idx}
                className="px-4 py-1.5 bg-miia-500 text-white text-xs rounded-lg font-medium hover:bg-miia-600 disabled:opacity-50"
              >
                {saving === idx ? 'Salvando...' : 'Salvar'}
              </button>
            </div>

            {/* Fields */}
            <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              <SettingField
                label="Responsável (email)"
                value={row.responsavel}
                onChange={v => updateField(idx, 'responsavel', v)}
              />
              <SettingField
                label="Nome Remetente"
                value={row.nomeRemetente}
                onChange={v => updateField(idx, 'nomeRemetente', v)}
              />
              <SettingField
                label="Emails/Hora"
                value={row.emailsHora.toString()}
                onChange={v => updateField(idx, 'emailsHora', parseInt(v) || 20)}
                type="number"
              />
              <SettingField
                label="CC (opcional)"
                value={row.cc}
                onChange={v => updateField(idx, 'cc', v)}
              />
              <SettingField
                label="Dias até FUP1"
                value={row.diasFup1.toString()}
                onChange={v => updateField(idx, 'diasFup1', parseInt(v) || 3)}
                type="number"
              />
              <SettingField
                label="Dias até FUP2"
                value={row.diasFup2.toString()}
                onChange={v => updateField(idx, 'diasFup2', parseInt(v) || 7)}
                type="number"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingField({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="text-xs text-slate-500 mb-1 block">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-miia-400/50 focus:border-miia-400"
      />
    </div>
  );
}
