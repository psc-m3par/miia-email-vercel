'use client';

import { useState, useEffect, useCallback } from 'react';

interface Respondido {
  nome: string;
  email: string;
  empresa: string;
  pipeline: string;
}

interface CategoryResult {
  category: string;
  totalContatos: number;
  email1Enviados: number;
  fup1Enviados: number;
  fup2Enviados: number;
  respondidos: Respondido[];
  bounced: number;
  taxaConversao: number;
  isComplete: boolean;
}

const PIPELINE_BADGES: Record<string, string> = {
  NOVO: 'bg-blue-50 text-blue-700 border-blue-200',
  NEGOCIACAO: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  REUNIAO: 'bg-purple-50 text-purple-700 border-purple-200',
  AGUARDANDO_MATERIAIS: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  GANHO: 'bg-green-50 text-green-700 border-green-200',
  PERDIDO: 'bg-red-50 text-red-600 border-red-200',
};

const PIPELINE_LABELS: Record<string, string> = {
  NOVO: 'Novo',
  NEGOCIACAO: 'Conversando',
  REUNIAO: 'Reuniao marcada',
  AGUARDANDO_MATERIAIS: 'Aguardando materiais',
  GANHO: 'Ganho',
  PERDIDO: 'Perdido',
};

function getPipelineBadgeClass(stage: string): string {
  return PIPELINE_BADGES[stage] || 'bg-slate-50 text-slate-600 border-slate-200';
}

function getPipelineLabel(stage: string): string {
  return PIPELINE_LABELS[stage] || stage;
}

function getTaxaColor(taxa: number): { bg: string; text: string; label: string } {
  const pct = taxa * 100;
  if (pct >= 10) return { bg: 'bg-green-100', text: 'text-green-700', label: 'Excelente' };
  if (pct >= 5) return { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Moderada' };
  return { bg: 'bg-red-100', text: 'text-red-600', label: 'Baixa' };
}

export default function ResultadosPage() {
  const [results, setResults] = useState<CategoryResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});

  const loadData = useCallback(() => {
    setLoading(true);
    fetch('/api/resultados', { cache: 'no-store' })
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setError(data.error);
        } else {
          setResults(data.results || []);
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleExpanded = (cat: string) => {
    setExpandedCats(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const completedResults = results.filter(r => r.isComplete);
  const categories = Array.from(new Set(completedResults.map(r => r.category)));

  const displayResults = filterCat
    ? completedResults.filter(r => r.category === filterCat)
    : completedResults;

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState error={error} onRetry={loadData} />;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6 flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-slate-800">Resultados</h1>
          <p className="text-slate-400 text-xs mt-1">
            Bases com ciclo completo ({completedResults.length} de {results.length} categorias)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterCat}
            onChange={e => setFilterCat(e.target.value)}
            className="text-xs border border-slate-200 rounded-xl px-3 py-2 text-slate-600 focus:outline-none focus:ring-2 focus:ring-miia-400/50 bg-white"
          >
            <option value="">Todas as categorias</option>
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <button
            onClick={loadData}
            className="px-3 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-200"
          >
            Atualizar
          </button>
        </div>
      </div>

      {displayResults.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <div className="text-4xl mb-4 text-slate-300">--</div>
          <h2 className="font-display text-lg font-bold text-slate-600 mb-2">
            Nenhuma base finalizada ainda
          </h2>
          <p className="text-slate-400 text-sm max-w-md mx-auto">
            Os resultados aparecem aqui quando todas as rotinas de uma categoria forem concluidas
            (Email 1, FUP1 e FUP2 sem pendencias).
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {displayResults.map(r => {
            const taxa = getTaxaColor(r.taxaConversao);
            const isExpanded = expandedCats[r.category] || false;
            const pctStr = (r.taxaConversao * 100).toFixed(1) + '%';

            return (
              <div
                key={r.category}
                className="bg-white rounded-xl border border-slate-200 overflow-hidden"
              >
                {/* Header */}
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="font-display text-base font-bold text-slate-800">
                      {r.category}
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {r.totalContatos} contatos na base
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={`px-3 py-1.5 rounded-full text-xs font-semibold ${taxa.bg} ${taxa.text}`}>
                      {pctStr} conversao
                    </div>
                    <span className="text-[10px] text-slate-300">{taxa.label}</span>
                  </div>
                </div>

                {/* Stats grid */}
                <div className="px-5 py-4">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <StatBox label="E1 enviados" value={r.email1Enviados} color="blue" />
                    <StatBox label="FUP1 enviados" value={r.fup1Enviados} color="indigo" />
                    <StatBox label="FUP2 enviados" value={r.fup2Enviados} color="purple" />
                    <StatBox label="Respondidos" value={r.respondidos.length} color="green" />
                    <StatBox label="Bounced" value={r.bounced} color="red" />
                  </div>
                </div>

                {/* Expandable respondidos */}
                {r.respondidos.length > 0 && (
                  <div className="border-t border-slate-100">
                    <button
                      onClick={() => toggleExpanded(r.category)}
                      className="w-full px-5 py-3 flex items-center justify-between text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      <span>Ver respondidos ({r.respondidos.length})</span>
                      <svg
                        className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>

                    {isExpanded && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 border-t">
                              <th className="text-left px-5 py-2.5 text-slate-500 font-medium">Nome</th>
                              <th className="text-left px-3 py-2.5 text-slate-500 font-medium">Empresa</th>
                              <th className="text-left px-3 py-2.5 text-slate-500 font-medium">Email</th>
                              <th className="text-left px-3 py-2.5 text-slate-500 font-medium">Pipeline</th>
                            </tr>
                          </thead>
                          <tbody>
                            {r.respondidos.map((resp, i) => (
                              <tr
                                key={i}
                                className="border-b border-slate-50 hover:bg-slate-50/50"
                              >
                                <td className="px-5 py-2.5 font-medium text-slate-700">
                                  {resp.nome || '(sem nome)'}
                                </td>
                                <td className="px-3 py-2.5 text-slate-600">
                                  {resp.empresa || '-'}
                                </td>
                                <td className="px-3 py-2.5 text-slate-500">{resp.email}</td>
                                <td className="px-3 py-2.5">
                                  <span
                                    className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border ${getPipelineBadgeClass(resp.pipeline)}`}
                                  >
                                    {getPipelineLabel(resp.pipeline)}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
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

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    red: 'bg-red-50 text-red-700 border-red-200',
  };
  return (
    <div className={`rounded-xl border p-3 text-center ${colors[color] || colors.blue}`}>
      <div className="text-xl font-bold font-display">{value}</div>
      <div className="text-[10px] mt-0.5 opacity-70">{label}</div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="max-w-6xl mx-auto animate-pulse">
      <div className="h-8 bg-slate-200 rounded w-48 mb-6" />
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-48 bg-slate-200 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="max-w-xl mx-auto mt-20 text-center">
      <h2 className="font-display text-xl font-bold text-slate-800 mb-2">Erro ao carregar</h2>
      <p className="text-slate-500 mb-4">{error}</p>
      <button
        onClick={onRetry}
        className="px-6 py-2.5 bg-miia-500 text-white rounded-xl font-medium hover:bg-miia-600"
      >
        Tentar novamente
      </button>
    </div>
  );
}
