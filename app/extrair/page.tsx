'use client';

import { useState, useEffect } from 'react';

const STATUS_OPTIONS = [
  { key: 'respondido', label: 'Respondido', color: 'bg-green-100 text-green-700' },
  { key: 'bounced', label: 'Bounced', color: 'bg-red-100 text-red-600' },
  { key: 'erro', label: 'Erro', color: 'bg-orange-100 text-orange-700' },
  { key: 'email1_enviado', label: 'E1 enviado (sem resposta)', color: 'bg-blue-100 text-blue-700' },
  { key: 'fup1_enviado', label: 'FUP1 enviado (sem resposta)', color: 'bg-indigo-100 text-indigo-700' },
  { key: 'fup2_enviado', label: 'FUP2 enviado (sem resposta)', color: 'bg-purple-100 text-purple-700' },
  { key: 'pendente', label: 'Pendente (não enviado)', color: 'bg-amber-100 text-amber-700' },
];

const PIPE_OPTIONS = [
  { key: 'NOVO', label: 'Novo', color: 'bg-amber-100 text-amber-700' },
  { key: 'NEGOCIACAO', label: 'Conversando', color: 'bg-blue-100 text-blue-700' },
  { key: 'AGUARDANDO_MATERIAIS', label: 'Aguardando materiais', color: 'bg-orange-100 text-orange-700' },
  { key: 'REUNIAO', label: 'Reunião marcada', color: 'bg-purple-100 text-purple-700' },
  { key: 'GANHO', label: 'Ganho', color: 'bg-green-100 text-green-700' },
  { key: 'PERDIDO', label: 'Perdido', color: 'bg-slate-100 text-slate-500' },
  { key: 'SEM_PIPELINE', label: 'Sem pipeline', color: 'bg-slate-50 text-slate-400' },
];

export default function ExtrairPage() {
  const [categorias, setCategorias] = useState<string[]>([]);
  const [allCategorias, setAllCategorias] = useState<string[]>([]);
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string[]>([]);
  const [selectedPipe, setSelectedPipe] = useState<string[]>([]);
  const [campos, setCampos] = useState({ email: true, whatsapp: true });
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{ total: number } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    fetch('/api/sheets?type=painel')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setAllCategorias(data.map((c: any) => c.category));
        }
      });
  }, []);

  // Preview count
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoadingPreview(true);
      fetch('/api/extrair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categorias: selectedCats,
          statusResposta: selectedStatus,
          statusPipe: selectedPipe,
          campos,
          preview: true,
        }),
      })
        .then(async r => {
          const text = await r.text();
          // Count lines minus header
          const lines = text.trim().split('\n').length - 1;
          setPreview({ total: Math.max(0, lines) });
        })
        .catch(() => setPreview(null))
        .finally(() => setLoadingPreview(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [selectedCats, selectedStatus, selectedPipe, campos]);

  const handleExport = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/extrair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categorias: selectedCats,
          statusResposta: selectedStatus,
          statusPipe: selectedPipe,
          campos,
        }),
      });

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `extracao_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert('Erro ao exportar: ' + (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const toggleItem = (list: string[], setList: (v: string[]) => void, item: string) => {
    setList(list.includes(item) ? list.filter(i => i !== item) : [...list, item]);
  };

  const Chip = ({ label, color, selected, onClick }: { label: string; color: string; selected: boolean; onClick: () => void }) => (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
        selected
          ? `${color} border-current ring-2 ring-current/20`
          : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-slate-800">Extrair Contatos</h1>
        <p className="text-slate-400 text-sm mt-1">Filtre e exporte contatos para uma planilha CSV</p>
      </div>

      <div className="space-y-6">
        {/* Categoria */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-sm font-bold text-slate-700">Categoria</h2>
            {selectedCats.length > 0 && (
              <button onClick={() => setSelectedCats([])} className="text-[10px] text-slate-400 hover:text-slate-600">
                Limpar
              </button>
            )}
          </div>
          <p className="text-[11px] text-slate-400 mb-3">Vazio = todas as categorias</p>
          <div className="flex flex-wrap gap-2">
            {allCategorias.map(cat => (
              <Chip
                key={cat}
                label={cat}
                color="bg-miia-100 text-miia-700"
                selected={selectedCats.includes(cat)}
                onClick={() => toggleItem(selectedCats, setSelectedCats, cat)}
              />
            ))}
          </div>
        </div>

        {/* Status de Resposta */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-sm font-bold text-slate-700">Status de Resposta</h2>
            {selectedStatus.length > 0 && (
              <button onClick={() => setSelectedStatus([])} className="text-[10px] text-slate-400 hover:text-slate-600">
                Limpar
              </button>
            )}
          </div>
          <p className="text-[11px] text-slate-400 mb-3">Vazio = todos os status</p>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map(s => (
              <Chip
                key={s.key}
                label={s.label}
                color={s.color}
                selected={selectedStatus.includes(s.key)}
                onClick={() => toggleItem(selectedStatus, setSelectedStatus, s.key)}
              />
            ))}
          </div>
        </div>

        {/* Status Pipeline */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-sm font-bold text-slate-700">Status no Pipeline</h2>
            {selectedPipe.length > 0 && (
              <button onClick={() => setSelectedPipe([])} className="text-[10px] text-slate-400 hover:text-slate-600">
                Limpar
              </button>
            )}
          </div>
          <p className="text-[11px] text-slate-400 mb-3">Vazio = todos</p>
          <div className="flex flex-wrap gap-2">
            {PIPE_OPTIONS.map(p => (
              <Chip
                key={p.key}
                label={p.label}
                color={p.color}
                selected={selectedPipe.includes(p.key)}
                onClick={() => toggleItem(selectedPipe, setSelectedPipe, p.key)}
              />
            ))}
          </div>
        </div>

        {/* Campos para extrair */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-display text-sm font-bold text-slate-700 mb-3">O que extrair?</h2>
          <p className="text-[11px] text-slate-400 mb-3">Nome + Empresa + Categoria + Status + Pipeline sempre inclusos</p>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={campos.email}
                onChange={e => setCampos({ ...campos, email: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300 text-miia-500 focus:ring-miia-400"
              />
              <span className="text-sm text-slate-700">Email</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={campos.whatsapp}
                onChange={e => setCampos({ ...campos, whatsapp: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300 text-miia-500 focus:ring-miia-400"
              />
              <span className="text-sm text-slate-700">WhatsApp</span>
            </label>
          </div>
        </div>

        {/* Preview + Export */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-sm font-bold text-slate-700">Exportar</h2>
              {loadingPreview ? (
                <p className="text-xs text-slate-400 mt-1">Calculando...</p>
              ) : preview ? (
                <p className="text-xs text-slate-500 mt-1">
                  <span className="font-bold text-miia-600 text-lg">{preview.total}</span> contatos encontrados
                </p>
              ) : null}
            </div>
            <button
              onClick={handleExport}
              disabled={loading || (preview?.total === 0)}
              className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                loading || preview?.total === 0
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-miia-500 text-white hover:bg-miia-600 shadow-sm hover:shadow-md'
              }`}
            >
              {loading ? 'Exportando...' : 'Baixar CSV'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
