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
  taxaRespostas: number;
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

interface Strategy {
  id: string;
  name: string;
  comment: string;
  categories: string[];
  createdAt: string;
}

function loadStrategies(): Strategy[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem('miia_strategies') || '[]'); } catch { return []; }
}

function saveStrategies(strategies: Strategy[]) {
  localStorage.setItem('miia_strategies', JSON.stringify(strategies));
}

export default function ResultadosPage() {
  const [results, setResults] = useState<CategoryResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [expandedStrategies, setExpandedStrategies] = useState<Record<string, boolean>>({});
  const [showCreateStrategy, setShowCreateStrategy] = useState(false);
  const [newStratName, setNewStratName] = useState('');
  const [newStratComment, setNewStratComment] = useState('');
  const [newStratCats, setNewStratCats] = useState<string[]>([]);

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
    setStrategies(loadStrategies());
  }, [loadData]);

  const toggleExpanded = (cat: string) => {
    setExpandedCats(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const toggleStrategy = (id: string) => {
    setExpandedStrategies(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const createStrategy = () => {
    if (!newStratName.trim() || newStratCats.length === 0) return;
    const strat: Strategy = { id: Date.now().toString(), name: newStratName.trim(), comment: newStratComment.trim(), categories: newStratCats, createdAt: new Date().toISOString() };
    const updated = [...strategies, strat];
    setStrategies(updated);
    saveStrategies(updated);
    setNewStratName('');
    setNewStratComment('');
    setNewStratCats([]);
    setShowCreateStrategy(false);
  };

  const deleteStrategy = (id: string) => {
    const updated = strategies.filter(s => s.id !== id);
    setStrategies(updated);
    saveStrategies(updated);
  };

  const getStrategyStats = (strat: Strategy) => {
    const cats = results.filter(r => strat.categories.includes(r.category));
    const total = cats.reduce((s, r) => s + r.totalContatos, 0);
    const e1 = cats.reduce((s, r) => s + r.email1Enviados, 0);
    const fup1 = cats.reduce((s, r) => s + r.fup1Enviados, 0);
    const fup2 = cats.reduce((s, r) => s + r.fup2Enviados, 0);
    const resp = cats.reduce((s, r) => s + r.respondidos.length, 0);
    const bounced = cats.reduce((s, r) => s + r.bounced, 0);
    const conversoes = cats.reduce((s, r) => s + r.respondidos.filter(x => x.pipeline === 'REUNIAO' || x.pipeline === 'GANHO' || x.pipeline === 'AGUARDANDO_MATERIAIS').length, 0);
    const taxaResp = e1 > 0 ? resp / e1 : 0;
    const taxaConv = e1 > 0 ? conversoes / e1 : 0;
    return { total, e1, fup1, fup2, resp, bounced, conversoes, taxaResp, taxaConv, cats };
  };

  const completedResults = results.filter(r => r.isComplete);
  const categories = Array.from(new Set(completedResults.map(r => r.category)));

  // Hide categories that are part of a strategy
  const catsInStrategies = new Set(strategies.flatMap(s => s.categories));
  const unstrategizedResults = completedResults.filter(r => !catsInStrategies.has(r.category));

  const displayResults = filterCat
    ? unstrategizedResults.filter(r => r.category === filterCat)
    : unstrategizedResults;

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
            {categories.filter(c => !catsInStrategies.has(c)).map(c => (
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

      {/* Estratégias */}
      {strategies.length > 0 && (
        <div className="space-y-4 mb-6">
          {strategies.map(strat => {
            const st = getStrategyStats(strat);
            const isExp = expandedStrategies[strat.id] || false;
            const respPct = (st.taxaResp * 100).toFixed(1) + '%';
            const convPct = (st.taxaConv * 100).toFixed(1) + '%';
            const taxaResp = getTaxaColor(st.taxaResp);
            const taxaConv = getTaxaColor(st.taxaConv);
            return (
              <div key={strat.id} className="bg-white rounded-xl border-2 border-miia-200 overflow-hidden">
                <div className="px-5 py-4 bg-miia-50/50 border-b border-miia-100 flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-miia-100 text-miia-700 px-2 py-0.5 rounded-full font-medium">Estratégia</span>
                      <h3 className="font-display text-base font-bold text-slate-800">{strat.name}</h3>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">{strat.categories.length} bases · {st.total} contatos</p>
                    {strat.comment && <p className="text-[11px] text-slate-500 mt-1 italic">{strat.comment}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`px-3 py-1.5 rounded-full text-xs font-semibold ${taxaResp.bg} ${taxaResp.text}`}>{respPct} respostas</div>
                    <div className={`px-3 py-1.5 rounded-full text-xs font-semibold ${taxaConv.bg} ${taxaConv.text}`}>{convPct} conversão</div>
                    <button onClick={() => deleteStrategy(strat.id)} className="text-slate-300 hover:text-red-500 text-xs ml-2" title="Deletar estratégia">🗑</button>
                  </div>
                </div>
                <div className="px-5 py-4">
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                    <StatBox label="Total contatos" value={st.total} color="blue" />
                    <StatBox label="E1 enviados" value={st.e1} color="blue" />
                    <StatBox label="FUP1" value={st.fup1} color="indigo" />
                    <StatBox label="FUP2" value={st.fup2} color="purple" />
                    <StatBox label="Respondidos" value={st.resp} color="green" />
                    <StatBox label="Bounced" value={st.bounced} color="red" />
                  </div>
                </div>
                <div className="border-t border-slate-100">
                  <button
                    onClick={() => toggleStrategy(strat.id)}
                    className="w-full px-5 py-3 flex items-center justify-between text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    <span>Ver bases individuais ({strat.categories.length})</span>
                    <svg className={`w-4 h-4 transition-transform duration-200 ${isExp ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                  </button>
                  {isExp && (
                    <div className="px-5 pb-4 space-y-3">
                      {st.cats.map(r => {
                        const rPct = ((r.taxaRespostas || 0) * 100).toFixed(1) + '%';
                        const cPct = (r.taxaConversao * 100).toFixed(1) + '%';
                        return (
                          <div key={r.category} className="bg-slate-50 rounded-lg p-3">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-sm font-semibold text-slate-700">{r.category}</span>
                              <span className="text-[10px] text-slate-400">{r.totalContatos} contatos · {rPct} resp · {cPct} conv</span>
                            </div>
                            <div className="grid grid-cols-5 gap-2 text-center text-[10px]">
                              <div><div className="font-bold text-blue-600">{r.email1Enviados}</div>E1</div>
                              <div><div className="font-bold text-indigo-600">{r.fup1Enviados}</div>FUP1</div>
                              <div><div className="font-bold text-purple-600">{r.fup2Enviados}</div>FUP2</div>
                              <div><div className="font-bold text-green-600">{r.respondidos.length}</div>Resp</div>
                              <div><div className="font-bold text-red-500">{r.bounced}</div>Bounce</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Criar estratégia + Modal */}
      <div className="mb-6 flex justify-end">
        <button
          onClick={() => { setShowCreateStrategy(true); setNewStratCats([]); setNewStratName(''); setNewStratComment(''); }}
          className="px-4 py-2 bg-miia-500 text-white rounded-xl text-sm font-semibold hover:bg-miia-600 transition-colors"
        >
          + Criar Estratégia
        </button>
      </div>

      {showCreateStrategy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center">
              <h2 className="font-display font-bold text-lg text-slate-800">Nova Estratégia</h2>
              <button onClick={() => setShowCreateStrategy(false)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">Nome da estratégia</label>
                <input
                  value={newStratName}
                  onChange={e => setNewStratName(e.target.value)}
                  placeholder="Ex: Envio em massa Q1"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-miia-400/50"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">Comentário (opcional)</label>
                <textarea
                  value={newStratComment}
                  onChange={e => setNewStratComment(e.target.value)}
                  placeholder="Ex: Primeira rodada de prospecção focada em EdTechs"
                  rows={2}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-miia-400/50 resize-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 mb-2 block">Selecione as bases ({newStratCats.length} selecionadas)</label>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {categories.map(cat => (
                    <label key={cat} className="flex items-center gap-2 text-sm text-slate-700 hover:bg-slate-50 px-2 py-1.5 rounded-lg cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newStratCats.includes(cat)}
                        onChange={e => {
                          if (e.target.checked) setNewStratCats([...newStratCats, cat]);
                          else setNewStratCats(newStratCats.filter(c => c !== cat));
                        }}
                        className="rounded border-slate-300 text-miia-500 focus:ring-miia-400"
                      />
                      {cat}
                    </label>
                  ))}
                  {categories.length === 0 && (
                    <p className="text-xs text-slate-400 py-2">Nenhuma base com ciclo completo disponível</p>
                  )}
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setShowCreateStrategy(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl">Cancelar</button>
              <button
                disabled={!newStratName.trim() || newStratCats.length === 0}
                onClick={createStrategy}
                className="px-6 py-2 bg-miia-500 text-white text-sm font-semibold rounded-xl hover:bg-miia-600 disabled:opacity-50 transition-colors"
              >
                Criar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bases individuais */}
      {displayResults.length === 0 && strategies.length === 0 ? (
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
      ) : displayResults.length === 0 ? null : (
        <div className="space-y-4">
          {displayResults.map(r => {
            const taxaResp = getTaxaColor(r.taxaRespostas || 0);
            const taxaConv = getTaxaColor(r.taxaConversao);
            const isExpanded = expandedCats[r.category] || false;
            const respPctStr = ((r.taxaRespostas || 0) * 100).toFixed(1) + '%';
            const convPctStr = (r.taxaConversao * 100).toFixed(1) + '%';

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
                    <div className={`px-3 py-1.5 rounded-full text-xs font-semibold ${taxaResp.bg} ${taxaResp.text}`}>
                      {respPctStr} respostas
                    </div>
                    <div className={`px-3 py-1.5 rounded-full text-xs font-semibold ${taxaConv.bg} ${taxaConv.text}`}>
                      {convPctStr} conversao
                    </div>
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
