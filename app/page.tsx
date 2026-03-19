'use client';

import { useState, useEffect, useCallback } from 'react';

interface Stats {
  total: number; pendentes: number; email1: number; fup1: number; fup2: number;
  respondidos: number; bounced: number; erros: number; semThread: number;
  hojeEmail1: number; hojeFup1: number; hojeFup2: number;
  e1Respondidos: number; e1Bounced: number;
  fup1Respondidos: number; fup1Bounced: number;
  fup2Respondidos: number; fup2Bounced: number;
}

interface FupForecast {
  fup1Aguardando: number; fup1ProximaData: string | null; fup1Prontos: number;
  fup2Aguardando: number; fup2ProximaData: string | null; fup2Prontos: number;
}

interface Contact {
  firstName: string; lastName: string; companyName: string; email: string;
  category: string; email1Enviado: string; fup1Enviado: string; fup2Enviado: string;
}

interface DashboardData {
  painel: any[];
  stats: Record<string, Stats>;
  totalGeral: Stats;
  totalContatos: number;
}

interface PipelineCount {
  NOVO: number; NEGOCIACAO: number; REUNIAO: number; AGUARDANDO_MATERIAIS: number; GANHO: number; PERDIDO: number;
}

function getEstado(s: Stats, ativo: boolean): { label: string; color: string } {
  if (!ativo) return { label: 'Pausado', color: 'bg-slate-100 text-slate-500' };
  if (s.total === 0) return { label: 'Sem base', color: 'bg-slate-100 text-slate-400' };
  if (s.pendentes > 0) return { label: 'Enviando Email 1', color: 'bg-blue-100 text-blue-700' };
  const semFup1 = s.email1 - s.respondidos - s.fup1;
  if (semFup1 > 0) return { label: 'Aguardando FUP1', color: 'bg-indigo-100 text-indigo-700' };
  if (s.fup1 > 0 && s.fup2 < s.fup1) return { label: 'Aguardando FUP2', color: 'bg-purple-100 text-purple-700' };
  if (s.email1 > 0) return { label: 'Ciclo completo', color: 'bg-green-100 text-green-700' };
  return { label: 'Pronto', color: 'bg-slate-100 text-slate-500' };
}

function getTimingInfo(ultimoEnvio: string, pendentes: number): { ultimoLabel: string; proximoLabel: string; recente: boolean } {
  if (!ultimoEnvio) return { ultimoLabel: '', proximoLabel: pendentes > 0 ? 'Pronto para enviar' : '', recente: false };
  const minAgo = Math.floor((Date.now() - new Date(ultimoEnvio).getTime()) / 60000);
  const recente = minAgo < 4;
  const ultimoLabel = minAgo < 1 ? 'há menos de 1 min' : `há ${minAgo} min`;
  const minRestantes = 55 - minAgo;
  let proximoLabel = '';
  if (pendentes > 0) {
    proximoLabel = minRestantes > 0 ? `próximo em ${minRestantes} min` : 'pronto para enviar';
  }
  return { ultimoLabel, proximoLabel, recente };
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdate, setLastUpdate] = useState('');
  const [pausingAll, setPausingAll] = useState(false);
  const [togglingCat, setTogglingCat] = useState('');
  const [reportConfig, setReportConfig] = useState({ hora_relatorio: '', email_relatorio: '' });
  const [savingReport, setSavingReport] = useState(false);
  const [reportMsg, setReportMsg] = useState('');
  const [connectedEmails, setConnectedEmails] = useState<string[]>([]);
  const [pipeline, setPipeline] = useState<PipelineCount | null>(null);
  const [fupForecast, setFupForecast] = useState<Record<string, FupForecast>>({});

  const loadData = useCallback(() => {
    Promise.all([
      fetch('/api/dashboard', { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/sheets?type=contacts', { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/config', { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/tokens', { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/respondidos', { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/monitor', { cache: 'no-store' }).then(r => r.json()),
    ]).then(([dashData, contactsData, configData, tokensData, respData, monitorData]) => {
      if (dashData.error) setError(dashData.error);
      else setData(dashData);
      if (contactsData.contacts) setContacts(contactsData.contacts);
      if (configData && !configData.error) {
        setReportConfig({
          hora_relatorio: configData.hora_relatorio || '',
          email_relatorio: configData.email_relatorio || '',
        });
      }
      if (Array.isArray(tokensData)) {
        setConnectedEmails(tokensData.map((t: any) => t.email));
      }
      if (monitorData?.fupForecast) setFupForecast(monitorData.fupForecast);
      if (respData.respondidos) {
        const counts: PipelineCount = { NOVO: 0, NEGOCIACAO: 0, REUNIAO: 0, AGUARDANDO_MATERIAIS: 0, GANHO: 0, PERDIDO: 0 };
        for (const r of respData.respondidos) {
          const stage = (r.pipeline || 'NOVO') as keyof PipelineCount;
          if (stage in counts) counts[stage]++;
        }
        setPipeline(counts);
      }
      setLastUpdate(new Date().toLocaleTimeString('pt-BR'));
    }).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);

  const triggerScheduler = useCallback(() => {
    fetch('/api/send-emails').catch(() => {});
    fetch('/api/send-fups').catch(() => {});
    fetch('/api/check-replies').catch(() => {});
    fetch('/api/send-report').catch(() => {});
  }, []);

  useEffect(() => {
    loadData();
    triggerScheduler();
    const interval = setInterval(() => {
      loadData();
      triggerScheduler();
    }, 30000);
    return () => clearInterval(interval);
  }, [loadData, triggerScheduler]);

  const savePainelRow = async (cat: any, ativo: boolean) => {
    await fetch('/api/sheets', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'painel', rowIndex: cat.rowIndex,
        values: [cat.category, cat.responsavel, cat.nomeRemetente, cat.emailsHora, cat.diasFup1, cat.diasFup2, ativo ? 'SIM' : 'NAO', cat.cc, cat.ultimoEnvio || '', cat.horaInicio ?? 8, cat.horaFim ?? 24],
      }),
    }).catch(() => {});
  };

  const handleToggleCat = async (cat: any) => {
    setTogglingCat(cat.category);
    await savePainelRow(cat, !cat.ativo);
    setTogglingCat('');
    loadData();
  };

  const handlePausarTudo = async () => {
    if (!data) return;
    setPausingAll(true);
    for (const cat of data.painel.filter((p: any) => p.ativo)) {
      await savePainelRow(cat, false);
    }
    setPausingAll(false);
    loadData();
  };

  const handleRetomarTudo = async () => {
    if (!data) return;
    setPausingAll(true);
    for (const cat of data.painel.filter((p: any) => !p.ativo)) {
      await savePainelRow(cat, true);
    }
    setPausingAll(false);
    loadData();
  };

  const saveReportConfig = async () => {
    setSavingReport(true);
    setReportMsg('');
    try {
      await fetch('/api/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'hora_relatorio', value: reportConfig.hora_relatorio }) });
      await fetch('/api/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'email_relatorio', value: reportConfig.email_relatorio }) });
      setReportMsg('Salvo!');
      setTimeout(() => setReportMsg(''), 3000);
      loadData();
    } catch { setReportMsg('Erro ao salvar'); }
    finally { setSavingReport(false); }
  };

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState error={error} onRetry={loadData} />;
  if (!data) return null;

  const { totalGeral, stats, painel } = data;

  const algumaAtiva = painel.some((p: any) => p.ativo);
  const algumaPausada = painel.some((p: any) => !p.ativo);
  const todasAtivas = !algumaPausada;

  const recentlySent = contacts
    .filter(c => c.email1Enviado && c.email1Enviado.startsWith('OK'))
    .sort((a, b) => b.email1Enviado.localeCompare(a.email1Enviado))
    .slice(0, 10);

  const alerts: string[] = [];
  for (const cat in stats) {
    const s = stats[cat];
    const painelCat = painel.find((p: any) => p.category === cat);
    if (s.semThread > 0) alerts.push(s.semThread + ' contatos de "' + cat + '" sem Thread ID (FUPs bloqueados)');
    if (s.pendentes > 0 && s.pendentes <= 5) alerts.push('Base de "' + cat + '" quase vazia: ' + s.pendentes + ' pendentes Email 1');
    if (s.erros > 0) alerts.push(s.erros + ' erros em "' + cat + '"');
    if (s.pendentes === 0 && s.total > 0) {
      const estado = getEstado(s, painelCat?.ativo ?? true);
      if (estado.label === 'Ciclo completo') {
        alerts.push('Base de "' + cat + '" esgotada (ciclo completo)');
      }
    }
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6 flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-slate-400 text-xs mt-1">Ultima atualização: {lastUpdate}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="px-3 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-200 flex items-center gap-1">
            ↺ Atualizar
          </button>
          {algumaAtiva && (
            <button
              onClick={handlePausarTudo}
              disabled={pausingAll}
              className="px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 disabled:opacity-50 flex items-center gap-2">
              {pausingAll ? '...' : (
                <><span className="w-2 h-2 bg-white rounded-full inline-block" /> Pausar Tudo</>
              )}
            </button>
          )}
          {!todasAtivas && (
            <button
              onClick={handleRetomarTudo}
              disabled={pausingAll}
              className="px-4 py-2 bg-green-500 text-white rounded-xl text-sm font-medium hover:bg-green-600 disabled:opacity-50 flex items-center gap-2">
              {pausingAll ? '...' : (
                <><span>▶</span> Retomar Tudo</>
              )}
            </button>
          )}
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6">
          <h3 className="text-sm font-semibold text-amber-800 mb-2">Alertas</h3>
          {alerts.map((a, i) => (
            <p key={i} className="text-xs text-amber-700 mb-1">⚠ {a}</p>
          ))}
        </div>
      )}

      <div className="bg-gradient-to-br from-miia-500 to-miia-700 rounded-2xl p-6 mb-6 text-white shadow-xl shadow-miia-500/20">
        <h2 className="text-sm font-medium text-white/70 mb-4">ATIVIDADE DE HOJE</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <BigMetric label="Emails enviados" value={totalGeral.hojeEmail1} />
          <BigMetric label="FUP1 enviados" value={totalGeral.hojeFup1} />
          <BigMetric label="FUP2 enviados" value={totalGeral.hojeFup2} />
          <BigMetric label="Respondidos" value={totalGeral.respondidos} accent="green" />
          <BigMetric label="Pendentes" value={totalGeral.pendentes} accent="amber" />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
        <StatBox label="Total na base" value={totalGeral.total} color="slate" />
        <StatBox label="Email 1 enviado" value={totalGeral.email1} color="blue" />
        <StatBox label="FUP1 enviado" value={totalGeral.fup1} color="indigo" />
        <StatBox label="FUP2 enviado" value={totalGeral.fup2} color="purple" />
        <StatBox label="Respondidos" value={totalGeral.respondidos} color="green" />
        <StatBox label="Erros" value={totalGeral.erros} color="red" />
      </div>

      {pipeline && (pipeline.NOVO + pipeline.NEGOCIACAO + pipeline.REUNIAO + pipeline.AGUARDANDO_MATERIAIS + pipeline.GANHO + pipeline.PERDIDO) > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6">
          <h2 className="font-display text-sm font-bold text-slate-700 mb-3">Pipeline Comercial</h2>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-center">
            {[
              { key: 'NOVO',       label: 'Novo',         color: 'bg-amber-50 text-amber-700 border-amber-200' },
              { key: 'NEGOCIACAO', label: 'Conversando',  color: 'bg-blue-50 text-blue-700 border-blue-200' },
              { key: 'REUNIAO',    label: 'Reunião',      color: 'bg-purple-50 text-purple-700 border-purple-200' },
              { key: 'AGUARDANDO_MATERIAIS', label: 'Ag. Materiais', color: 'bg-orange-50 text-orange-700 border-orange-200' },
              { key: 'GANHO',      label: 'Ganho',        color: 'bg-green-50 text-green-700 border-green-200' },
              { key: 'PERDIDO',    label: 'Perdido',      color: 'bg-red-50 text-red-600 border-red-200' },
            ].map(s => (
              <div key={s.key} className={`rounded-xl border p-3 ${s.color}`}>
                <div className="text-xl font-bold font-display">{pipeline[s.key as keyof PipelineCount]}</div>
                <div className="text-[10px] mt-0.5 opacity-70">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-800 mb-3">Rotinas por Categoria</h2>
          <div className="space-y-3">
            {Object.entries(stats).map(([cat, s]) => {
              const painelCat = painel.find((p: any) => p.category === cat);
              const progresso = s.total > 0 ? Math.round((s.email1 / s.total) * 100) : 0;
              const taxaRespEmail1 = s.email1 > 0 ? Math.round((s.respondidos / s.email1) * 100) : 0;
              const taxaRespFup1 = s.fup1 > 0 ? Math.round((s.respondidos / s.fup1) * 100) : 0;
              const taxaRespFup2 = s.fup2 > 0 ? Math.round((s.respondidos / s.fup2) * 100) : 0;
              const emailsPerResp = s.respondidos > 0 ? Math.round(s.email1 / s.respondidos) : 0;
              const estado = getEstado(s, painelCat?.ativo ?? false);
              const { ultimoLabel, proximoLabel, recente } = getTimingInfo(painelCat?.ultimoEnvio || '', s.pendentes);

              return (
                <div key={cat} className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {recente && (
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                        </span>
                      )}
                      <h3 className="font-semibold text-slate-700 text-sm">{cat}</h3>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${estado.color}`}>
                        {estado.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">{s.total} contatos</span>
                      {painelCat && (
                        <button
                          onClick={() => handleToggleCat(painelCat)}
                          disabled={togglingCat === cat}
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors disabled:opacity-50 ${
                            painelCat.ativo
                              ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                              : 'bg-green-100 text-green-700 hover:bg-green-200'
                          }`}>
                          {togglingCat === cat ? '...' : (painelCat.ativo ? 'Pausar' : 'Retomar')}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-3">
                    <div className="h-full bg-gradient-to-r from-miia-400 to-miia-600 rounded-full transition-all" style={{ width: progresso + '%' }} />
                  </div>

                  <div className="mb-2">
                    {/* Header */}
                    <div className="grid grid-cols-[40px_1fr_1fr_1fr_1fr_1fr] gap-1 text-center py-1 border-b border-slate-100">
                      <span />
                      <span className="text-[9px] text-slate-400 font-medium">Enviados</span>
                      <span className="text-[9px] text-slate-400 font-medium">Pendentes</span>
                      <span className="text-[9px] text-slate-400 font-medium">Resp.</span>
                      <span className="text-[9px] text-slate-400 font-medium">Bounce</span>
                      <span className="text-[9px] text-slate-400 font-medium">s/ Thread</span>
                    </div>
                    {/* Email 1 */}
                    <div className="grid grid-cols-[40px_1fr_1fr_1fr_1fr_1fr] gap-1 text-center py-1.5 border-b border-slate-50">
                      <span className="text-[10px] font-semibold text-blue-600 text-left">E1</span>
                      <span className="text-xs font-bold text-blue-600">{s.email1}</span>
                      <span className={`text-xs font-bold ${s.pendentes > 0 ? 'text-amber-600' : 'text-slate-300'}`}>{s.pendentes}</span>
                      <span className={`text-xs font-bold ${s.e1Respondidos > 0 ? 'text-green-600' : 'text-slate-300'}`}>{s.e1Respondidos}</span>
                      <span className={`text-xs font-bold ${s.e1Bounced > 0 ? 'text-red-500' : 'text-slate-300'}`}>{s.e1Bounced}</span>
                      <span className={`text-xs font-bold ${s.semThread > 0 ? 'text-orange-500' : 'text-slate-300'}`}>{s.semThread}</span>
                    </div>
                    {/* FUP1 */}
                    {(() => {
                      const fup1Pendentes = Math.max(0, s.email1 - s.fup1 - s.e1Respondidos - s.e1Bounced - s.semThread);
                      return (
                        <div className="grid grid-cols-[40px_1fr_1fr_1fr_1fr_1fr] gap-1 text-center py-1.5 border-b border-slate-50">
                          <span className="text-[10px] font-semibold text-indigo-600 text-left">FUP1</span>
                          <span className="text-xs font-bold text-indigo-600">{s.fup1}</span>
                          <span className={`text-xs font-bold ${fup1Pendentes > 0 ? 'text-amber-600' : 'text-slate-300'}`}>{fup1Pendentes}</span>
                          <span className={`text-xs font-bold ${s.fup1Respondidos > 0 ? 'text-green-600' : 'text-slate-300'}`}>{s.fup1Respondidos}</span>
                          <span className={`text-xs font-bold ${s.fup1Bounced > 0 ? 'text-red-500' : 'text-slate-300'}`}>{s.fup1Bounced}</span>
                          <span className="text-xs text-slate-300">—</span>
                        </div>
                      );
                    })()}
                    {/* FUP2 */}
                    {(() => {
                      const fup2Pendentes = Math.max(0, s.fup1 - s.fup2 - s.fup1Respondidos - s.fup1Bounced);
                      return (
                        <div className="grid grid-cols-[40px_1fr_1fr_1fr_1fr_1fr] gap-1 text-center py-1.5">
                          <span className="text-[10px] font-semibold text-purple-600 text-left">FUP2</span>
                          <span className="text-xs font-bold text-purple-600">{s.fup2}</span>
                          <span className={`text-xs font-bold ${fup2Pendentes > 0 ? 'text-amber-600' : 'text-slate-300'}`}>{fup2Pendentes}</span>
                          <span className={`text-xs font-bold ${s.fup2Respondidos > 0 ? 'text-green-600' : 'text-slate-300'}`}>{s.fup2Respondidos}</span>
                          <span className={`text-xs font-bold ${s.fup2Bounced > 0 ? 'text-red-500' : 'text-slate-300'}`}>{s.fup2Bounced}</span>
                          <span className="text-xs text-slate-300">—</span>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Previsão de FUPs */}
                  {(() => {
                    const fc = fupForecast[cat];
                    if (!fc) return null;
                    const hasFup1Info = fc.fup1Aguardando > 0 || fc.fup1Prontos > 0;
                    const hasFup2Info = fc.fup2Aguardando > 0 || fc.fup2Prontos > 0;
                    if (!hasFup1Info && !hasFup2Info) return null;

                    const formatProx = (isoDate: string | null) => {
                      if (!isoDate) return '';
                      const diff = Math.floor((new Date(isoDate).getTime() - Date.now()) / 3600000);
                      if (diff <= 0) return 'agora';
                      if (diff < 24) return `em ${diff}h`;
                      return `em ${Math.ceil(diff / 24)}d`;
                    };

                    return (
                      <div className="bg-indigo-50/50 rounded-lg px-3 py-2 mb-2 text-[10px]">
                        <div className="font-semibold text-indigo-700 mb-1">Próximos FUPs</div>
                        <div className="flex gap-4">
                          {hasFup1Info && (
                            <div>
                              <span className="text-indigo-600 font-medium">FUP1:</span>{' '}
                              {fc.fup1Prontos > 0 ? (
                                <span className="text-green-600 font-semibold">{fc.fup1Prontos} pronto(s)</span>
                              ) : (
                                <span className="text-slate-500">
                                  {fc.fup1Aguardando} aguardando
                                  {fc.fup1ProximaData && <> — próx {formatProx(fc.fup1ProximaData)}</>}
                                </span>
                              )}
                            </div>
                          )}
                          {hasFup2Info && (
                            <div>
                              <span className="text-purple-600 font-medium">FUP2:</span>{' '}
                              {fc.fup2Prontos > 0 ? (
                                <span className="text-green-600 font-semibold">{fc.fup2Prontos} pronto(s)</span>
                              ) : (
                                <span className="text-slate-500">
                                  {fc.fup2Aguardando} aguardando
                                  {fc.fup2ProximaData && <> — próx {formatProx(fc.fup2ProximaData)}</>}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {(ultimoLabel || proximoLabel) && (
                    <div className="bg-slate-50 rounded-lg px-3 py-2 mb-2 flex items-center justify-between flex-wrap gap-1">
                      {ultimoLabel && (
                        <span className="text-[10px] text-slate-500">
                          Ultimo envio: <strong className="text-slate-700">{ultimoLabel}</strong>
                        </span>
                      )}
                      {proximoLabel && (
                        <span className={`text-[10px] font-medium ${proximoLabel.startsWith('pronto') ? 'text-green-600' : 'text-slate-500'}`}>
                          {proximoLabel.startsWith('pronto') ? '✓ ' : ''}{proximoLabel}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="border-t border-slate-100 pt-2 mt-1">
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>Taxa resp. Email1: <strong className="text-slate-700">{taxaRespEmail1}%</strong></span>
                      <span>FUP1: <strong className="text-slate-700">{taxaRespFup1}%</strong></span>
                      <span>FUP2: <strong className="text-slate-700">{taxaRespFup2}%</strong></span>
                      {emailsPerResp > 0 && (
                        <span>Emails/resp: <strong className="text-miia-500">{emailsPerResp}</strong></span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          {totalGeral.email1 > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="font-display text-base font-bold text-slate-800">Eficiência de Conversão</h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">Taxa de resposta por etapa</p>
                </div>
                {totalGeral.respondidos > 0 && (
                  <div className="flex gap-3">
                    <div className="text-center">
                      <div className="text-xl font-bold font-display text-miia-500">{Math.round((totalGeral.respondidos / totalGeral.email1) * 100)}%</div>
                      <div className="text-[10px] text-slate-400">Taxa geral</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold font-display text-green-500">{totalGeral.respondidos}</div>
                      <div className="text-[10px] text-slate-400">Respondidos</div>
                    </div>
                  </div>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left px-3 py-2.5 text-slate-500 font-medium">Categoria</th>
                      <th className="text-center px-3 py-2.5 text-slate-500 font-medium">Env.</th>
                      <th className="text-center px-3 py-2.5 text-slate-500 font-medium">Resp.</th>
                      <th className="text-center px-3 py-2.5 text-blue-600 font-medium">E1%</th>
                      <th className="text-center px-3 py-2.5 text-indigo-600 font-medium">F1%</th>
                      <th className="text-center px-3 py-2.5 text-purple-600 font-medium">F2%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(stats).map(([cat, s]) => {
                      const taxaEmail1 = s.email1 > 0 ? Math.round((s.respondidos / s.email1) * 100) : 0;
                      const taxaFup1   = s.fup1 > 0   ? Math.round((s.respondidos / s.fup1) * 100)   : 0;
                      const taxaFup2   = s.fup2 > 0   ? Math.round((s.respondidos / s.fup2) * 100)   : 0;
                      return (
                        <tr key={cat} className="border-b border-slate-50 hover:bg-slate-50/50">
                          <td className="px-3 py-2.5 font-medium text-slate-700 max-w-[110px] truncate">{cat}</td>
                          <td className="px-3 py-2.5 text-center text-slate-600">{s.email1}</td>
                          <td className="px-3 py-2.5 text-center font-bold text-green-600">{s.respondidos}</td>
                          <td className="px-3 py-2.5 text-center">
                            <span className={`font-bold ${taxaEmail1 > 0 ? 'text-blue-600' : 'text-slate-300'}`}>{taxaEmail1 > 0 ? taxaEmail1 + '%' : '—'}</span>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className={`font-bold ${taxaFup1 > 0 ? 'text-indigo-600' : 'text-slate-300'}`}>{taxaFup1 > 0 ? taxaFup1 + '%' : '—'}</span>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className={`font-bold ${taxaFup2 > 0 ? 'text-purple-600' : 'text-slate-300'}`}>{taxaFup2 > 0 ? taxaFup2 + '%' : '—'}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div>
            <h2 className="font-display text-lg font-bold text-slate-800 mb-3">Ultimos Emails Enviados</h2>
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {recentlySent.length > 0 ? (
                <div className="divide-y divide-slate-50 max-h-[260px] overflow-y-auto">
                  {recentlySent.map((c, i) => {
                    const time = c.email1Enviado.replace('OK ', '');
                    let status = 'Email 1';
                    let statusColor = 'bg-blue-100 text-blue-700';
                    if (c.fup2Enviado === 'RESPONDIDO') { status = 'Respondido'; statusColor = 'bg-green-100 text-green-700'; }
                    else if (c.fup2Enviado && c.fup2Enviado.startsWith('OK')) { status = 'FUP2'; statusColor = 'bg-purple-100 text-purple-700'; }
                    else if (c.fup1Enviado && c.fup1Enviado.startsWith('OK')) { status = 'FUP1'; statusColor = 'bg-indigo-100 text-indigo-700'; }
                    return (
                      <div key={i} className="px-4 py-3 flex items-center justify-between hover:bg-slate-50/50">
                        <div>
                          <p className="text-sm font-medium text-slate-700">{c.firstName} {c.lastName}</p>
                          <p className="text-xs text-slate-400">{c.companyName} - {c.email}</p>
                        </div>
                        <div className="text-right">
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusColor}`}>{status}</span>
                          <p className="text-[10px] text-slate-400 mt-1">{time}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 text-sm">Nenhum email enviado ainda</div>
              )}
            </div>
          </div>

          {/* Relatório Diário */}
          <ReportConfigSection
            reportConfig={reportConfig}
            setReportConfig={setReportConfig}
            connectedEmails={connectedEmails}
            savingReport={savingReport}
            reportMsg={reportMsg}
            onSave={saveReportConfig}
          />
        </div>
      </div>
    </div>
  );
}

function BigMetric({ label, value, accent }: { label: string; value: number; accent?: string }) {
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
    <div className={`rounded-xl border p-3 text-center ${colors[color]}`}>
      <div className="text-xl font-bold font-display">{value}</div>
      <div className="text-[10px] mt-0.5 opacity-70">{label}</div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-slate-50 rounded-lg py-1.5">
      <div className={`text-sm font-bold font-display ${color}`}>{value}</div>
      <div className="text-[10px] text-slate-400">{label}</div>
    </div>
  );
}

function ReportConfigSection({ reportConfig, setReportConfig, connectedEmails, savingReport, reportMsg, onSave }: {
  reportConfig: { hora_relatorio: string; email_relatorio: string };
  setReportConfig: React.Dispatch<React.SetStateAction<{ hora_relatorio: string; email_relatorio: string }>>;
  connectedEmails: string[];
  savingReport: boolean;
  reportMsg: string;
  onSave: () => void;
}) {
  const [customInput, setCustomInput] = useState('');

  const emailList = reportConfig.email_relatorio
    ? reportConfig.email_relatorio.split(',').map(e => e.trim()).filter(Boolean)
    : [];

  const addEmail = (email: string) => {
    const trimmed = email.trim();
    if (!trimmed || emailList.includes(trimmed)) return;
    setReportConfig(c => ({ ...c, email_relatorio: [...emailList, trimmed].join(',') }));
  };

  const removeEmail = (email: string) => {
    setReportConfig(c => ({ ...c, email_relatorio: emailList.filter(e => e !== email).join(',') }));
  };

  const availableToAdd = connectedEmails.filter(e => !emailList.includes(e));

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 className="font-display text-base font-bold text-slate-800">Relatório Diário</h2>
          <p className="text-[11px] text-slate-400 mt-0.5">Receba um resumo por email todo dia no horário configurado</p>
        </div>
        {reportConfig.hora_relatorio && (
          <span className="text-[11px] bg-indigo-50 text-indigo-600 font-medium px-2.5 py-1 rounded-full border border-indigo-100">
            Agendado para {reportConfig.hora_relatorio}h
          </span>
        )}
      </div>
      <div className="px-5 py-4 flex items-start gap-4 flex-wrap">
        <div className="shrink-0">
          <label className="text-xs text-slate-500 mb-1 block">Horário de envio</label>
          <div className="flex items-center gap-2">
            <input
              type="number" min={0} max={23}
              value={reportConfig.hora_relatorio}
              onChange={e => setReportConfig(c => ({ ...c, hora_relatorio: e.target.value }))}
              placeholder="ex: 18"
              className="w-20 px-3 py-2 border border-slate-200 rounded-xl text-sm text-center focus:outline-none focus:ring-2 focus:ring-miia-400/50"
            />
            <span className="text-xs text-slate-400">h (Brasília)</span>
          </div>
        </div>

        <div className="flex-1 min-w-[220px]">
          <label className="text-xs text-slate-500 mb-1 block">Destinatários</label>
          {emailList.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {emailList.map(email => (
                <span key={email} className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-full text-[11px]">
                  {email}
                  <button onClick={() => removeEmail(email)} className="text-indigo-300 hover:text-indigo-700 font-bold leading-none">×</button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2 flex-wrap">
            {availableToAdd.length > 0 && (
              <select
                value=""
                onChange={e => { if (e.target.value) addEmail(e.target.value); }}
                className="px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-500 focus:outline-none focus:ring-2 focus:ring-miia-400/50 bg-white">
                <option value="">+ Conta conectada</option>
                {availableToAdd.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            )}
            <input
              type="email"
              value={customInput}
              onChange={e => setCustomInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && customInput) { addEmail(customInput); setCustomInput(''); } }}
              onBlur={() => { if (customInput) { addEmail(customInput); setCustomInput(''); } }}
              placeholder="+ Outro email"
              className="flex-1 min-w-[160px] px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-miia-400/50"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-5">
          <button
            onClick={onSave}
            disabled={savingReport}
            className="px-4 py-2 bg-indigo-500 text-white rounded-xl text-sm font-medium hover:bg-indigo-600 disabled:opacity-50">
            {savingReport ? 'Salvando...' : 'Salvar'}
          </button>
          {reportMsg && <span className="text-xs text-green-600 font-medium">{reportMsg}</span>}
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="max-w-7xl mx-auto animate-pulse">
      <div className="h-8 bg-slate-200 rounded w-48 mb-6" />
      <div className="h-36 bg-slate-200 rounded-2xl mb-6" />
      <div className="grid grid-cols-6 gap-3 mb-6">
        {[1,2,3,4,5,6].map(i => <div key={i} className="h-16 bg-slate-200 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div className="h-80 bg-slate-200 rounded-xl" />
        <div className="h-80 bg-slate-200 rounded-xl" />
      </div>
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="max-w-xl mx-auto mt-20 text-center">
      <div className="text-6xl mb-4">⚠️</div>
      <h2 className="font-display text-xl font-bold text-slate-800 mb-2">Erro ao carregar</h2>
      <p className="text-slate-500 mb-4">{error}</p>
      <button onClick={onRetry} className="px-6 py-2.5 bg-miia-500 text-white rounded-xl font-medium hover:bg-miia-600">
        Tentar novamente
      </button>
    </div>
  );
}
