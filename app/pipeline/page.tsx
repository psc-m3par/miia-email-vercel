'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface Deal {
  rowIndex: number;
  spreadsheetId: string;
  firstName: string;
  lastName: string;
  companyName: string;
  email: string;
  category: string;
  threadId: string;
  pipeline: string;
  responsavel: string;
  nota: string;
}

const STAGES = [
  { key: 'NOVO',       label: 'Novo',           color: 'border-t-amber-400',   badge: 'bg-amber-100 text-amber-700',   count: 'text-amber-600' },
  { key: 'NEGOCIACAO', label: 'Conversando',      color: 'border-t-blue-400',    badge: 'bg-blue-100 text-blue-700',     count: 'text-blue-600' },
  { key: 'AGUARDANDO_MATERIAIS', label: 'Aguardando materiais', color: 'border-t-orange-400', badge: 'bg-orange-100 text-orange-700', count: 'text-orange-600' },
  { key: 'REUNIAO',    label: 'Reunião marcada', color: 'border-t-purple-400',  badge: 'bg-purple-100 text-purple-700', count: 'text-purple-600' },
  { key: 'GANHO',      label: 'Ganho',           color: 'border-t-green-400',   badge: 'bg-green-100 text-green-700',   count: 'text-green-600' },
  { key: 'PERDIDO',    label: 'Perdido',         color: 'border-t-slate-300',   badge: 'bg-slate-100 text-slate-500',   count: 'text-slate-400' },
];

export default function PipelinePage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [moving, setMoving] = useState<string | null>(null);
  const [filterCat, setFilterCat] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ firstName: '', lastName: '', companyName: '', email: '', mobilePhone: '', category: '', pipeline: 'NOVO', nota: '' });
  const [addSaving, setAddSaving] = useState(false);

  const loadData = useCallback(() => {
    setLoading(true);
    fetch('/api/respondidos', { cache: 'no-store' })
      .then(r => r.json())
      .then(data => {
        if (data.respondidos) setDeals(data.respondidos);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const cardKey = (d: Deal) => d.rowIndex + '-' + d.spreadsheetId;

  const moveStage = async (d: Deal, stage: string) => {
    if (d.pipeline === stage) return;
    const k = cardKey(d);
    setMoving(k + stage);
    try {
      await fetch('/api/respondidos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowIndex: d.rowIndex, pipeline: stage, spreadsheetId: d.spreadsheetId }),
      });
      setDeals(prev => prev.map(x => cardKey(x) === k ? { ...x, pipeline: stage } : x));
    } finally {
      setMoving(null);
    }
  };

  const saveNota = async (d: Deal, nota: string) => {
    const k = cardKey(d);
    try {
      await fetch('/api/respondidos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowIndex: d.rowIndex, nota, spreadsheetId: d.spreadsheetId }),
      });
      setDeals(prev => prev.map(x => cardKey(x) === k ? { ...x, nota } : x));
    } catch {}
  };

  const addContact = async () => {
    if (!addForm.firstName) { alert('Nome é obrigatório'); return; }
    setAddSaving(true);
    try {
      const res = await fetch('/api/respondidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      });
      const data = await res.json();
      if (data.ok) {
        setShowAddModal(false);
        setAddForm({ firstName: '', lastName: '', companyName: '', email: '', mobilePhone: '', category: '', pipeline: 'NOVO', nota: '' });
        loadData();
      } else {
        alert('Erro: ' + (data.error || 'desconhecido'));
      }
    } catch (e: any) {
      alert('Erro: ' + e.message);
    } finally {
      setAddSaving(false);
    }
  };

  const categorias = Array.from(new Set(deals.map(d => d.category))).filter(Boolean).sort();
  const filtered = filterCat ? deals.filter(d => d.category === filterCat) : deals;
  const stageDeals = (key: string) => filtered.filter(d => (d.pipeline || 'NOVO') === key);
  const totalAtivos = filtered.filter(d => d.pipeline !== 'GANHO' && d.pipeline !== 'PERDIDO').length;

  if (loading) return (
    <div className="animate-pulse">
      <div className="h-8 bg-slate-200 rounded w-48 mb-8" />
      <div className="flex gap-4">
        {[1,2,3,4,5].map(i => <div key={i} className="flex-1 h-64 bg-slate-200 rounded-xl" />)}
      </div>
    </div>
  );

  return (
    <div className="h-full">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="font-display text-3xl font-bold text-slate-800">Pipeline</h1>
          <p className="text-slate-400 text-sm mt-1">{totalAtivos} negociações ativas · {filtered.filter(d => d.pipeline === 'GANHO').length} ganhas</p>
        </div>
        <div className="flex gap-2">
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-xl text-slate-600 bg-white focus:outline-none hover:bg-slate-50">
            <option value="">Todas as categorias</option>
            {categorias.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button onClick={() => setShowAddModal(true)} className="px-4 py-2 bg-miia-500 text-white rounded-xl text-sm font-medium hover:bg-miia-600">
            + Adicionar
          </button>
          <Link href="/respondidos" className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50">
            Ver conversas
          </Link>
          <button onClick={loadData} className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50">
            Atualizar
          </button>
        </div>
      </div>

      {/* Kanban board */}
      <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: '60vh' }}>
        {STAGES.map(stage => {
          const stDeals = stageDeals(stage.key);
          return (
            <div key={stage.key} className={`flex-shrink-0 w-64 bg-slate-50 rounded-xl border-t-4 ${stage.color} border border-slate-200 flex flex-col`}>
              {/* Column header */}
              <div className="px-3 py-3 flex items-center justify-between border-b border-slate-200">
                <span className="text-xs font-semibold text-slate-700">{stage.label}</span>
                <span className={`text-xs font-bold ${stage.count}`}>{stDeals.length}</span>
              </div>

              {/* Cards */}
              <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                {stDeals.length === 0 && (
                  <div className="text-center py-8 text-xs text-slate-300">Nenhum</div>
                )}
                {stDeals.map(d => {
                  const k = cardKey(d);
                  const nome = [d.firstName, d.lastName].filter(Boolean).join(' ') || d.email;
                  const initials = (d.firstName?.[0] || '') + (d.lastName?.[0] || '');

                  return (
                    <div key={k} className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-start gap-2">
                        <div className="w-8 h-8 rounded-lg bg-miia-50 text-miia-600 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                          {initials || nome[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-slate-800 truncate">{nome}</div>
                          {d.companyName && <div className="text-[10px] text-slate-400 truncate">{d.companyName}</div>}
                          <div className="text-[10px] text-slate-300 truncate">{d.email}</div>
                        </div>
                      </div>

                      <div className="mt-2">
                        <span className="text-[10px] bg-miia-50 text-miia-500 px-1.5 py-0.5 rounded-full">{d.category}</span>
                      </div>

                      {/* Move dropdown */}
                      <select
                        value={d.pipeline || 'NOVO'}
                        onChange={e => moveStage(d, e.target.value)}
                        disabled={moving !== null}
                        className="mt-2 w-full text-[10px] py-1 px-2 border border-slate-200 rounded-lg text-slate-600 bg-white focus:outline-none focus:ring-1 focus:ring-miia-400 disabled:opacity-40"
                      >
                        {STAGES.map(s => (
                          <option key={s.key} value={s.key}>{s.label}</option>
                        ))}
                      </select>

                      {/* Nota */}
                      <textarea
                        defaultValue={d.nota}
                        placeholder="Nota..."
                        onBlur={e => {
                          if (e.target.value !== d.nota) saveNota(d, e.target.value);
                        }}
                        className="mt-2 w-full text-[10px] py-1.5 px-2 border border-slate-200 rounded-lg text-slate-600 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-miia-400 resize-none placeholder:text-slate-300"
                        rows={2}
                      />

                      <Link href="/respondidos"
                        className="mt-1 block text-center text-[10px] text-slate-400 hover:text-miia-500 transition-colors">
                        Ver conversa
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Adicionar Contato */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h2 className="font-display text-lg font-bold text-slate-800 mb-4">Adicionar contato ao Pipeline</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-slate-500">Nome *</label>
                  <input value={addForm.firstName} onChange={e => setAddForm(f => ({ ...f, firstName: e.target.value }))}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-miia-400/50" placeholder="Nome" />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-500">Sobrenome</label>
                  <input value={addForm.lastName} onChange={e => setAddForm(f => ({ ...f, lastName: e.target.value }))}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-miia-400/50" placeholder="Sobrenome" />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-500">Empresa</label>
                <input value={addForm.companyName} onChange={e => setAddForm(f => ({ ...f, companyName: e.target.value }))}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-miia-400/50" placeholder="Empresa" />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-500">Email *</label>
                <input value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-miia-400/50" placeholder="email@empresa.com" type="email" />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-500">WhatsApp</label>
                <input value={addForm.mobilePhone} onChange={e => setAddForm(f => ({ ...f, mobilePhone: e.target.value }))}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-miia-400/50" placeholder="5511999999999" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-slate-500">Categoria</label>
                  <select value={addForm.category} onChange={e => setAddForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-miia-400/50">
                    <option value="">Selecione...</option>
                    {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-500">Estágio</label>
                  <select value={addForm.pipeline} onChange={e => setAddForm(f => ({ ...f, pipeline: e.target.value }))}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-miia-400/50">
                    {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-500">Nota</label>
                <textarea value={addForm.nota} onChange={e => setAddForm(f => ({ ...f, nota: e.target.value }))}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-miia-400/50 h-20 resize-none" placeholder="Observações..." />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200">
                Cancelar
              </button>
              <button onClick={addContact} disabled={addSaving}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-miia-500 rounded-xl hover:bg-miia-600 disabled:opacity-50">
                {addSaving ? 'Salvando...' : 'Adicionar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
