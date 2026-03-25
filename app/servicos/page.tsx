'use client';

import { useState, useEffect, useCallback } from 'react';

interface Servico {
  rowIndex: number;
  id: string;
  nome: string;
  descricao: string;
  detalhes: string;
  dataCriacao: string;
}

export default function ServicosPage() {
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Servico | null>(null);
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [detalhes, setDetalhes] = useState('');
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);

  const loadData = useCallback(() => {
    setLoading(true);
    fetch('/api/servicos', { cache: 'no-store' })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setServicos(data); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSave = async () => {
    if (!nome.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await fetch('/api/servicos', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rowIndex: editing.rowIndex, nome, descricao, detalhes }),
        });
      } else {
        await fetch('/api/servicos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome, descricao, detalhes }),
        });
      }
      resetForm();
      loadData();
    } finally { setSaving(false); }
  };

  const handleDelete = async (s: Servico) => {
    if (!confirm(`Deletar "${s.nome}"?`)) return;
    await fetch('/api/servicos', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rowIndex: s.rowIndex }),
    });
    loadData();
  };

  const startEdit = (s: Servico) => {
    setEditing(s);
    setNome(s.nome);
    setDescricao(s.descricao);
    setDetalhes(s.detalhes);
    setShowForm(true);
  };

  const handleBulkImport = async () => {
    if (!bulkText.trim()) return;
    setBulkSaving(true);
    try {
      // Parse: each block separated by double newline = one service
      // First line of block = name, optional ":" splits name:description
      // Rest = details
      const blocks = bulkText.split(/\n{2,}/).filter(b => b.trim());
      for (const block of blocks) {
        const lines = block.trim().split('\n');
        const firstLine = lines[0];
        let sNome = firstLine;
        let sDescricao = '';
        if (firstLine.includes(':')) {
          const [n, ...d] = firstLine.split(':');
          sNome = n.trim();
          sDescricao = d.join(':').trim();
        }
        const sDetalhes = lines.slice(1).join('\n').trim();
        await fetch('/api/servicos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome: sNome, descricao: sDescricao, detalhes: sDetalhes }),
        });
      }
      setBulkText('');
      setShowBulk(false);
      loadData();
    } finally { setBulkSaving(false); }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditing(null);
    setNome('');
    setDescricao('');
    setDetalhes('');
  };

  if (loading) return (
    <div className="max-w-4xl mx-auto animate-pulse">
      <div className="h-8 bg-slate-200 rounded w-48 mb-6" />
      <div className="space-y-4">
        {[1, 2, 3].map(i => <div key={i} className="h-32 bg-slate-200 rounded-xl" />)}
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="font-display text-3xl font-bold text-slate-800">Serviços MIIA</h1>
          <p className="text-slate-400 text-xs mt-1">Catálogo de serviços e soluções para referência</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowBulk(true); setBulkText(''); }}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-200 transition-colors"
          >
            Importar Lista
          </button>
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="px-4 py-2 bg-miia-500 text-white rounded-xl text-sm font-semibold hover:bg-miia-600 transition-colors"
          >
            + Novo Serviço
          </button>
        </div>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center">
              <h2 className="font-display font-bold text-lg text-slate-800">
                {editing ? 'Editar Serviço' : 'Novo Serviço'}
              </h2>
              <button onClick={resetForm} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">Nome do Serviço *</label>
                <input
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  placeholder="Ex: Correção de Redação com IA"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-miia-400/50"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">Descrição curta</label>
                <input
                  value={descricao}
                  onChange={e => setDescricao(e.target.value)}
                  placeholder="Uma linha resumindo o serviço"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-miia-400/50"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">Detalhes</label>
                <textarea
                  value={detalhes}
                  onChange={e => setDetalhes(e.target.value)}
                  placeholder="Funcionalidades, público-alvo, diferenciais, preço..."
                  rows={8}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-miia-400/50 resize-y"
                />
              </div>
            </div>
            <div className="p-5 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={resetForm} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl">Cancelar</button>
              <button
                disabled={saving || !nome.trim()}
                onClick={handleSave}
                className="px-6 py-2 bg-miia-500 text-white text-sm font-semibold rounded-xl hover:bg-miia-600 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Salvando...' : editing ? 'Salvar' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk import modal */}
      {showBulk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center">
              <h2 className="font-display font-bold text-lg text-slate-800">Importar Lista de Serviços</h2>
              <button onClick={() => setShowBulk(false)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-slate-500">Cole a lista completa. Cada serviço separado por uma <strong>linha em branco</strong>. A primeira linha de cada bloco é o nome (use ":" pra separar nome e descrição). As linhas seguintes são os detalhes.</p>
              <div className="text-[10px] text-slate-400 bg-slate-50 rounded-lg p-3 font-mono">
                Correção de Redação: Correção automática com IA<br/>
                Funcionalidade X, público Y, diferencial Z<br/>
                <br/>
                Banco de Questões: Prática adaptativa<br/>
                Detalhes do serviço aqui...
              </div>
              <textarea
                value={bulkText}
                onChange={e => setBulkText(e.target.value)}
                rows={15}
                placeholder="Cole a lista de serviços aqui..."
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-miia-400/50 resize-y font-mono"
              />
            </div>
            <div className="p-5 border-t border-slate-100 flex justify-between items-center">
              <span className="text-xs text-slate-400">
                {bulkText.trim() ? `${bulkText.split(/\n{2,}/).filter(b => b.trim()).length} serviço(s) detectados` : ''}
              </span>
              <div className="flex gap-2">
                <button onClick={() => setShowBulk(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl">Cancelar</button>
                <button
                  disabled={bulkSaving || !bulkText.trim()}
                  onClick={handleBulkImport}
                  className="px-6 py-2 bg-miia-500 text-white text-sm font-semibold rounded-xl hover:bg-miia-600 disabled:opacity-50 transition-colors"
                >
                  {bulkSaving ? 'Importando...' : 'Importar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cards */}
      {servicos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <div className="text-4xl mb-4 text-slate-300">📦</div>
          <h2 className="font-display text-lg font-bold text-slate-600 mb-2">Nenhum serviço cadastrado</h2>
          <p className="text-slate-400 text-sm">Clique em "+ Novo Serviço" para adicionar o primeiro.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {servicos.map(s => {
            const isExp = expanded[s.id] || false;
            return (
              <div key={s.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div
                  className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-slate-50/50 transition-colors"
                  onClick={() => setExpanded(prev => ({ ...prev, [s.id]: !prev[s.id] }))}
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display text-sm font-bold text-slate-800">{s.nome}</h3>
                    {s.descricao && <p className="text-xs text-slate-500 mt-0.5 truncate">{s.descricao}</p>}
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <button
                      onClick={e => { e.stopPropagation(); startEdit(s); }}
                      className="text-slate-300 hover:text-miia-500 p-1 rounded-lg hover:bg-miia-50 transition-colors"
                      title="Editar"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(s); }}
                      className="text-slate-300 hover:text-red-500 p-1 rounded-lg hover:bg-red-50 transition-colors"
                      title="Deletar"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14" />
                      </svg>
                    </button>
                    <svg className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isExp ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
                  </div>
                </div>
                {isExp && s.detalhes && (
                  <div className="px-5 pb-4 border-t border-slate-100 pt-3">
                    <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{s.detalhes}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
