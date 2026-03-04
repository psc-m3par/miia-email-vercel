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

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selected, setSelected] = useState<number>(-1);
  const [editing, setEditing] = useState<Template | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('/api/sheets?type=templates')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setTemplates(data); })
      .finally(() => setLoading(false));
  }, []);

  const handleSelect = (idx: number) => {
    setSelected(idx);
    setEditing({ ...templates[idx] });
    setMessage('');
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
      setMessage('✅ Salvo!');
    } catch (e: any) {
      setMessage('❌ ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const PLACEHOLDERS = ['[First Name]', '[Last Name]', '[Full Name]', '[Company]', '[Category]'];

  if (loading) return <div className="animate-pulse"><div className="h-8 bg-slate-200 rounded w-48 mb-8" /><div className="h-96 bg-slate-200 rounded-2xl" /></div>;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-slate-800">Templates</h1>
        <p className="text-slate-500 mt-1">Edite os templates de email por category</p>
      </div>

      <div className="flex gap-6">
        {/* Template list */}
        <div className="w-72 shrink-0">
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <h3 className="text-xs font-medium text-slate-400 uppercase">Categories</h3>
            </div>
            <div className="p-2">
              {templates.map((t, i) => (
                <button
                  key={i}
                  onClick={() => handleSelect(i)}
                  className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-all mb-1 ${
                    selected === i
                      ? 'bg-miia-500 text-white shadow-md'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className="font-medium">{t.category}</div>
                  <div className={`text-xs mt-0.5 truncate ${selected === i ? 'text-white/60' : 'text-slate-400'}`}>
                    {t.assunto}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1">
          {editing ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 animate-fade-in">
              {/* Placeholders bar */}
              <div className="flex items-center gap-2 mb-6 pb-4 border-b border-slate-100">
                <span className="text-xs text-slate-400">Placeholders:</span>
                {PLACEHOLDERS.map(p => (
                  <span key={p} className="text-xs bg-miia-50 text-miia-600 px-2.5 py-1 rounded-lg font-mono">{p}</span>
                ))}
              </div>

              {/* Email 1 */}
              <Section title="Email 1" color="blue">
                <Field label="Assunto" value={editing.assunto} onChange={v => setEditing({ ...editing, assunto: v })} />
                <Field label="Corpo" value={editing.corpo} onChange={v => setEditing({ ...editing, corpo: v })} textarea />
              </Section>

              {/* FUP1 */}
              <Section title="Follow-up 1" color="indigo">
                <Field label="Assunto" value={editing.fup1Assunto} onChange={v => setEditing({ ...editing, fup1Assunto: v })} />
                <Field label="Corpo" value={editing.fup1Corpo} onChange={v => setEditing({ ...editing, fup1Corpo: v })} textarea />
              </Section>

              {/* FUP2 */}
              <Section title="Follow-up 2" color="purple">
                <Field label="Assunto" value={editing.fup2Assunto} onChange={v => setEditing({ ...editing, fup2Assunto: v })} />
                <Field label="Corpo" value={editing.fup2Corpo} onChange={v => setEditing({ ...editing, fup2Corpo: v })} textarea />
              </Section>

              {/* Actions */}
              <div className="flex items-center gap-4 mt-6 pt-4 border-t border-slate-100">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2.5 bg-miia-500 text-white rounded-xl font-medium hover:bg-miia-600 disabled:opacity-50 shadow-lg shadow-miia-500/20"
                >
                  {saving ? 'Salvando...' : 'Salvar alterações'}
                </button>
                {message && <span className="text-sm">{message}</span>}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
              <div className="text-5xl mb-4">📝</div>
              <p className="text-slate-400">Selecione uma category para editar o template</p>
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
