'use client';

import { useState, useEffect } from 'react';

interface Template {
  category: string;
  assunto: string;
  corpo: string;
  fup1Assunto: string;
  fup1Corpo: string;
  fup2Assunto: string;
  fup2Corpo: string;
}

function AIPanel({ category, onApply }: { category: string; onApply: (t: Partial<Template>) => void }) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);

  const generate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/ai-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim(), category }),
      });
      const data = await res.json();
      if (!data.ok) { setError(data.error || 'Erro desconhecido'); return; }
      onApply(data.template);
      setOpen(false);
      setPrompt('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-6 rounded-2xl border border-violet-200 bg-violet-50 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-violet-700 hover:bg-violet-100 transition-colors"
      >
        <span className="flex items-center gap-2">
          <span className="text-base">✨</span> Gerar com IA
        </span>
        <span className="text-violet-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-violet-200">
          <p className="text-xs text-violet-600 pt-3">Descreva o produto/serviço, tom, público-alvo e qualquer detalhe relevante. A IA vai preencher todos os 6 campos automaticamente.</p>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) generate(); }}
            placeholder="Ex: Somos uma empresa de software de RH para PMEs. Queremos prospectar diretores de RH de empresas 50-500 funcionários. Tom profissional mas descontraído."
            rows={4}
            className="w-full px-3 py-2 border border-violet-200 rounded-xl text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400/50 resize-none"
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex items-center gap-3">
            <button
              onClick={generate}
              disabled={loading || !prompt.trim()}
              className="px-4 py-2 bg-violet-600 text-white rounded-xl text-xs font-medium hover:bg-violet-700 disabled:opacity-50"
            >
              {loading ? 'Gerando...' : '✨ Gerar templates'}
            </button>
            <span className="text-[10px] text-violet-400">⌘+Enter para gerar</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selected, setSelected] = useState<number>(-1);
  const [editing, setEditing] = useState<Template | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [newTemplate, setNewTemplate] = useState<Template>({ category: '', assunto: '', corpo: '', fup1Assunto: '', fup1Corpo: '', fup2Assunto: '', fup2Corpo: '' });
  const [creating, setCreating] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [completedCats, setCompletedCats] = useState<Set<string>>(new Set());
  const [showFinished, setShowFinished] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/sheets?type=templates').then(r => r.json()),
      fetch('/api/sheets?type=painel').then(r => r.json()),
      fetch('/api/resultados', { cache: 'no-store' }).then(r => r.json()),
    ]).then(([tmplData, painelData, resultData]) => {
      if (Array.isArray(tmplData)) setTemplates(tmplData);
      if (Array.isArray(painelData)) {
        const tmplCats = Array.isArray(tmplData) ? tmplData.map((t: Template) => t.category) : [];
        const allCats = painelData.map((p: any) => p.category).filter((c: string) => !tmplCats.includes(c));
        setCategories(allCats);
      }
      if (resultData?.results) {
        const done = new Set<string>(
          resultData.results
            .filter((r: any) => r.isComplete)
            .map((r: any) => r.category)
        );
        setCompletedCats(done);
      }
    }).finally(() => setLoading(false));
  }, []);

  const handleSelect = (idx: number) => {
    setSelected(idx);
    setEditing({ ...templates[idx] });
    setMessage('');
    setShowNew(false);
  };

  const handleSave = async () => {
    if (!editing || selected < 0) return;
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/sheets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'templates',
          rowIndex: selected + 2,
          values: [editing.category, editing.assunto, editing.corpo, editing.fup1Assunto, editing.fup1Corpo, editing.fup2Assunto, editing.fup2Corpo],
        }),
      });
      if (!res.ok) throw new Error('Falha ao salvar');
      templates[selected] = { ...editing };
      setTemplates([...templates]);
      setMessage('Salvo!');
    } catch (e: any) {
      setMessage('Erro: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    if (!newTemplate.category) { setMessage('Selecione uma category'); return; }
    if (!newTemplate.assunto) { setMessage('Assunto obrigatorio'); return; }
    if (!newTemplate.corpo) { setMessage('Corpo do email obrigatorio'); return; }
    setCreating(true);
    setMessage('');
    try {
      const rowIndex = templates.length + 2;
      const res = await fetch('/api/sheets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'templates',
          rowIndex: rowIndex,
          values: [newTemplate.category, newTemplate.assunto, newTemplate.corpo, newTemplate.fup1Assunto, newTemplate.fup1Corpo, newTemplate.fup2Assunto, newTemplate.fup2Corpo],
        }),
      });
      if (!res.ok) throw new Error('Falha ao criar');
      setTemplates([...templates, { ...newTemplate }]);
      setMessage('Template criado para "' + newTemplate.category + '"!');
      setShowNew(false);
      setNewTemplate({ category: '', assunto: '', corpo: '', fup1Assunto: '', fup1Corpo: '', fup2Assunto: '', fup2Corpo: '' });
      setCategories(categories.filter(c => c !== newTemplate.category));
    } catch (e: any) {
      setMessage('Erro: ' + e.message);
    } finally {
      setCreating(false);
    }
  };

  const PLACEHOLDERS = ['[First Name]', '[Last Name]', '[Full Name]', '[Company]', '[Category]'];

  if (loading) return <div className="animate-pulse"><div className="h-8 bg-slate-200 rounded w-48 mb-8" /><div className="h-96 bg-slate-200 rounded-2xl" /></div>;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-slate-800">Templates</h1>
        <p className="text-slate-500 mt-1">Edite os templates de email por category</p>
        {message && <p className="text-sm mt-2 bg-white border border-slate-200 rounded-xl px-4 py-2 inline-block">{message}</p>}
      </div>

      <div className="flex gap-6">
        <div className="w-72 shrink-0">
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xs font-medium text-slate-400 uppercase">Categories</h3>
              <button onClick={() => { setShowNew(true); setSelected(-1); setEditing(null); }}
                className="text-xs bg-green-500 text-white px-2.5 py-1 rounded-lg font-medium hover:bg-green-600">
                + Novo
              </button>
            </div>
            <div className="p-2">
              {templates.filter(t => !completedCats.has(t.category)).map((t, i) => {
                const realIdx = templates.indexOf(t);
                return (
                  <button
                    key={realIdx}
                    onClick={() => handleSelect(realIdx)}
                    className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-all mb-1 ${
                      selected === realIdx
                        ? 'bg-miia-500 text-white shadow-md'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-medium">{t.category}</div>
                    <div className={`text-xs mt-0.5 truncate ${selected === realIdx ? 'text-white/60' : 'text-slate-400'}`}>
                      {t.assunto}
                    </div>
                  </button>
                );
              })}
              {templates.some(t => completedCats.has(t.category)) && (
                <>
                  <button
                    onClick={() => setShowFinished(!showFinished)}
                    className="w-full flex items-center justify-between px-4 py-2.5 mt-2 rounded-xl text-xs font-medium text-slate-400 hover:bg-slate-50 transition-colors border border-dashed border-slate-200"
                  >
                    <span>Finalizadas ({templates.filter(t => completedCats.has(t.category)).length})</span>
                    <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${showFinished ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                  </button>
                  {showFinished && templates.filter(t => completedCats.has(t.category)).map(t => {
                    const realIdx = templates.indexOf(t);
                    return (
                      <button
                        key={realIdx}
                        onClick={() => handleSelect(realIdx)}
                        className={`w-full text-left px-4 py-2.5 rounded-xl text-sm transition-all mb-1 ${
                          selected === realIdx
                            ? 'bg-miia-500 text-white shadow-md'
                            : 'text-slate-500 hover:bg-slate-50 opacity-70'
                        }`}
                      >
                        <div className="font-medium text-xs">{t.category}</div>
                        <div className={`text-[10px] mt-0.5 truncate ${selected === realIdx ? 'text-white/60' : 'text-slate-400'}`}>
                          {t.assunto}
                        </div>
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1">
          {showNew ? (
            <div className="bg-white rounded-2xl border border-green-200 p-6 animate-fade-in">
              <h3 className="font-semibold text-green-700 mb-4">Criar Novo Template</h3>
              <div className="mb-4">
                <label className="text-xs text-slate-500 mb-1 block">Category</label>
                {categories.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {categories.map(cat => (
                      <button key={cat} onClick={() => setNewTemplate({...newTemplate, category: cat})}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium ${newTemplate.category === cat ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                        {cat}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">Todas as categories ja tem template. Crie uma nova category no Painel primeiro.</p>
                )}
              </div>
              <AIPanel
                category={newTemplate.category}
                onApply={t => setNewTemplate(prev => ({ ...prev, ...t }))}
              />
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
                <span className="text-xs text-slate-400">Placeholders:</span>
                {PLACEHOLDERS.map(p => (
                  <span key={p} className="text-xs bg-miia-50 text-miia-600 px-2.5 py-1 rounded-lg font-mono">{p}</span>
                ))}
              </div>
              <Section title="Email 1" color="blue">
                <Field label="Assunto" value={newTemplate.assunto} onChange={v => setNewTemplate({...newTemplate, assunto: v})} />
                <Field label="Corpo" value={newTemplate.corpo} onChange={v => setNewTemplate({...newTemplate, corpo: v})} textarea />
              </Section>
              <Section title="Follow-up 1" color="indigo">
                <Field label="Assunto" value={newTemplate.fup1Assunto} onChange={v => setNewTemplate({...newTemplate, fup1Assunto: v})} />
                <Field label="Corpo" value={newTemplate.fup1Corpo} onChange={v => setNewTemplate({...newTemplate, fup1Corpo: v})} textarea />
              </Section>
              <Section title="Follow-up 2" color="purple">
                <Field label="Assunto" value={newTemplate.fup2Assunto} onChange={v => setNewTemplate({...newTemplate, fup2Assunto: v})} />
                <Field label="Corpo" value={newTemplate.fup2Corpo} onChange={v => setNewTemplate({...newTemplate, fup2Corpo: v})} textarea />
              </Section>
              <div className="flex items-center gap-4 mt-6 pt-4 border-t border-slate-100">
                <button onClick={handleCreate} disabled={creating}
                  className="px-6 py-2.5 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 disabled:opacity-50">
                  {creating ? 'Criando...' : 'Criar Template'}
                </button>
                <button onClick={() => setShowNew(false)}
                  className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-medium hover:bg-slate-50">
                  Cancelar
                </button>
              </div>
            </div>
          ) : editing ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 animate-fade-in">
              <AIPanel
                category={editing.category}
                onApply={t => setEditing(prev => prev ? { ...prev, ...t } : prev)}
              />
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
                <span className="text-xs text-slate-400">Placeholders:</span>
                {PLACEHOLDERS.map(p => (
                  <span key={p} className="text-xs bg-miia-50 text-miia-600 px-2.5 py-1 rounded-lg font-mono">{p}</span>
                ))}
              </div>
              <Section title="Email 1" color="blue">
                <Field label="Assunto" value={editing.assunto} onChange={v => setEditing({ ...editing, assunto: v })} />
                <Field label="Corpo" value={editing.corpo} onChange={v => setEditing({ ...editing, corpo: v })} textarea />
              </Section>
              <Section title="Follow-up 1" color="indigo">
                <Field label="Assunto" value={editing.fup1Assunto} onChange={v => setEditing({ ...editing, fup1Assunto: v })} />
                <Field label="Corpo" value={editing.fup1Corpo} onChange={v => setEditing({ ...editing, fup1Corpo: v })} textarea />
              </Section>
              <Section title="Follow-up 2" color="purple">
                <Field label="Assunto" value={editing.fup2Assunto} onChange={v => setEditing({ ...editing, fup2Assunto: v })} />
                <Field label="Corpo" value={editing.fup2Corpo} onChange={v => setEditing({ ...editing, fup2Corpo: v })} textarea />
              </Section>
              <div className="flex items-center gap-4 mt-6 pt-4 border-t border-slate-100">
                <button onClick={handleSave} disabled={saving}
                  className="px-6 py-2.5 bg-miia-500 text-white rounded-xl font-medium hover:bg-miia-600 disabled:opacity-50 shadow-lg shadow-miia-500/20">
                  {saving ? 'Salvando...' : 'Salvar alteracoes'}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
              <div className="text-5xl mb-4">📝</div>
              <p className="text-slate-400">Selecione uma category para editar ou clique em "+ Novo" para criar</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
  };
  return (
    <div className="mb-6">
      <div className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-medium border mb-3 ${colors[color]}`}>
        {title}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, value, onChange, textarea }: { label: string; value: string; onChange: (v: string) => void; textarea?: boolean }) {
  const cls = "w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-miia-400/50 focus:border-miia-400 bg-white";
  return (
    <div>
      <label className="text-xs text-slate-500 mb-1 block">{label}</label>
      {textarea ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} rows={8} className={cls + ' resize-y font-mono text-xs'} />
      ) : (
        <input type="text" value={value} onChange={e => onChange(e.target.value)} className={cls} />
      )}
    </div>
  );
}