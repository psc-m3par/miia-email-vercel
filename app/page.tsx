'use client';

import { useState, useEffect } from 'react';

interface Stats {
  total: number; pendentes: number; email1: number; fup1: number; fup2: number;
  respondidos: number; erros: number; semThread: number;
  hojeEmail1: number; hojeFup1: number; hojeFup2: number;
}

interface DashboardData {
  painel: any[];
  templates: any[];
  stats: Record<string, Stats>;
  totalGeral: Stats;
  totalContatos: number;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState error={error} />;
  if (!data) return null;

  const { totalGeral, stats, painel } = data;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-slate-500 mt-1">Visao geral dos envios de email</p>
      </div>

      <div className="bg-gradient-to-br from-miia-500 to-miia-700 rounded-2xl p-6 mb-8 text-white shadow-xl shadow-miia-500/20">
        <h2 className="text-sm font-medium text-white/70 mb-4">ATIVIDADE DE HOJE</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <MetricCard label="Emails enviados" value={totalGeral.hojeEmail1} />
          <MetricCard label="FUP1 enviados" value={totalGeral.hojeFup1} />
          <MetricCard label="FUP2 enviados" value={totalGeral.hojeFup2} />
          <MetricCard label="Respondidos" value={totalGeral.respondidos} accent="green" />
          <MetricCard label="Pendentes" value={totalGeral.pendentes} accent="amber" />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
        <StatBox label="Total na base" value={totalGeral.total} color="slate" />
        <StatBox label="Email 1 enviado" value={totalGeral.email1} color="blue" />
        <StatBox label="FUP1 enviado" value={totalGeral.fup1} color="indigo" />
        <StatBox label="FUP2 enviado" value={totalGeral.fup2} color="purple" />
        <StatBox label="Respondidos" value={totalGeral.respondidos} color="green" />
        <StatBox label="Erros" value={totalGeral.erros} color="red" />
      </div>

      <h2 className="font-display text-xl font-bold text-slate-800 mb-4">Por Categoria</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Object.entries(stats).map(([cat, s]) => {
          const painelCat = painel.find((p: any) => p.category === cat);
          const progresso = s.total > 0 ? Math.round((s.email1 / s.total) * 100) : 0;
          const taxaResposta = s.email1 > 0 ? Math.round((s.respondidos / s.email1) * 100) : 0;

          return (
            <div key={cat} className="bg-white rounded-2xl border border-slate-200 overflow-hidden animate-slide-up shadow-sm hover:shadow-md">
              <div className="bg-miia-500 px-5 py-3 flex justify-between items-center">
                <div>
                  <h3 className="text-white font-semibold">{cat}</h3>
                  <p className="text-white/60 text-xs">{s.total} contatos</p>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${painelCat?.ativo ? 'bg-green-400/20 text-green-100' : 'bg-red-400/20 text-red-100'}`}>
                  {painelCat?.ativo ? 'Ativo' : 'Inativo'}
                </span>
              </div>

              <div className="p-5">
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                    <span>Progresso da base</span>
                    <span className="font-semibold text-miia-500">{progresso}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-miia-400 to-miia-600 rounded-full transition-all duration-500" style={{ width: progresso + '%' }} />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-3">
                  <MiniStat label="Pendentes" value={s.pendentes} color="text-slate-600" />
                  <MiniStat label="Email 1" value={s.email1} color="text-blue-600" />
                  <MiniStat label="FUP1" value={s.fup1} color="text-indigo-600" />
                  <MiniStat label="FUP2" value={s.fup2} color="text-purple-600" />
                  <MiniStat label="Respondidos" value={s.respondidos} color="text-green-600" />
                  <MiniStat label="Erros" value={s.erros} color="text-red-600" />
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-100">
                  <span>Taxa de resposta: <strong className="text-miia-500">{taxaResposta}%</strong></span>
                  {s.semThread > 0 && (
                    <span className="text-amber-500">{s.semThread} sem thread</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MetricCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  const colorMap: Record<string, string> = { green: 'text-green-300', amber: 'text-amber-300' };
  return (
    <div className="text-center">
      <div className={`text-3xl font-bold font-display ${accent ? colorMap[accent] : 'text-white'}`}>{value}</div>
      <div className="text-xs mt-1 text-white/60">{label}</div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    slate: 'bg-slate-50 text-slate-700 border-slate-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    red: 'bg-red-50 text-red-700 border-red-200',
  };
  return (
    <div className={`rounded-xl border p-4 text-center ${colors[color]}`}>
      <div className="text-2xl font-bold font-display">{value}</div>
      <div className="text-xs mt-1 opacity-70">{label}</div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center py-2 bg-slate-50 rounded-lg">
      <div className={`text-lg font-bold font-display ${color}`}>{value}</div>
      <div className="text-[10px] text-slate-400">{label}</div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="max-w-7xl mx-auto animate-pulse">
      <div className="h-8 bg-slate-200 rounded w-48 mb-8" />
      <div className="h-40 bg-slate-200 rounded-2xl mb-8" />
      <div className="grid grid-cols-6 gap-4 mb-8">
        {[1,2,3,4,5,6].map((i) => <div key={i} className="h-20 bg-slate-200 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-2 gap-6">
        {[1,2,3,4].map((i) => <div key={i} className="h-64 bg-slate-200 rounded-2xl" />)}
      </div>
    </div>
  );
}

function ErrorState({ error }: { error: string }) {
  return (
    <div className="max-w-xl mx-auto mt-20 text-center">
      <div className="text-6xl mb-4">⚠️</div>
      <h2 className="font-display text-xl font-bold text-slate-800 mb-2">Erro ao carregar</h2>
      <p className="text-slate-500 mb-4">{error}</p>
      <button onClick={() => window.location.reload()} className="px-6 py-2.5 bg-miia-500 text-white rounded-xl font-medium hover:bg-miia-600">
        Tentar novamente
      </button>
    </div>
  );
}