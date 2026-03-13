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
}

const STAGES = [
  { key: 'NOVO',       label: 'Novo',           color: 'border-t-amber-400',   badge: 'bg-amber-100 text-amber-700',   count: 'text-amber-600' },
  { key: 'NEGOCIACAO', label: 'Em negociação',   color: 'border-t-blue-400',    badge: 'bg-blue-100 text-blue-700',     count: 'text-blue-600' },
  { key: 'REUNIAO',    label: 'Reunião marcada', color: 'border-t-purple-400',  badge: 'bg-purple-100 text-purple-700', count: 'text-purple-600' },
  { key: 'GANHO',      label: 'Ganho',           color: 'border-t-green-400',   badge: 'bg-green-100 text-green-700',   count: 'text-green-600' },
  { key: 'PERDIDO',    label: 'Perdido',         color: 'border-t-slate-300',   badge: 'bg-slate-100 text-slate-500',   count: 'text-slate-400' },
];

export default function PipelinePage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [moving, setMoving] = useState<string | null>(null);

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

  const stageDeals = (key: string) => deals.filter(d => (d.pipeline || 'NOVO') === key);
  const totalAtivos = deals.filter(d => d.pipeline !== 'GANHO' && d.pipeline !== 'PERDIDO').length;

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
          <p className="text-slate-400 text-sm mt-1">{totalAtivos} negociações ativas · {deals.filter(d => d.pipeline === 'GANHO').length} ganhas</p>
        </div>
        <div className="flex gap-2">
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
                  const prevStage = STAGES[STAGES.findIndex(s => s.key === (d.pipeline || 'NOVO')) - 1];
                  const nextStage = STAGES[STAGES.findIndex(s => s.key === (d.pipeline || 'NOVO')) + 1];

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

                      {/* Move buttons */}
                      <div className="flex gap-1 mt-2">
                        {prevStage && (
                          <button
                            onClick={() => moveStage(d, prevStage.key)}
                            disabled={moving !== null}
                            className="flex-1 py-1 text-[10px] text-slate-400 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-40">
                            ← {prevStage.label}
                          </button>
                        )}
                        {nextStage && (
                          <button
                            onClick={() => moveStage(d, nextStage.key)}
                            disabled={moving !== null}
                            className="flex-1 py-1 text-[10px] text-white bg-miia-500 rounded-lg hover:bg-miia-600 transition-colors disabled:opacity-40">
                            {nextStage.label} →
                          </button>
                        )}
                      </div>

                      <Link href="/respondidos"
                        className="mt-1.5 block text-center text-[10px] text-slate-400 hover:text-miia-500 transition-colors">
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
    </div>
  );
}
