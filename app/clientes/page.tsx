'use client';

import { useState, useEffect, useRef } from 'react';

export default function ClientesPage() {
  const [clients, setClients] = useState<{ empresa: string; email: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [newEmpresa, setNewEmpresa] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/clients').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setClients(data);
    }).finally(() => setLoading(false));
  }, []);

  const handleUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const clean = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
      const lines = clean.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length === 0) { setMsg('Arquivo vazio'); return; }

      const knownHeaders = ['empresa', 'company', 'email', 'razao'];
      const hasHeader = knownHeaders.some(h => lines[0].toLowerCase().includes(h));

      if (hasHeader) {
        const sep = lines[0].includes(';') ? ';' : ',';
        const header = lines[0].split(sep).map(h => h.trim().toLowerCase());
        const findCol = (...names: string[]) => {
          for (const n of names) {
            const idx = header.findIndex(h => h.includes(n.toLowerCase()));
            if (idx >= 0) return idx;
          }
          return -1;
        };
        const iCompany = findCol('empresa', 'company', 'razao social', 'nome');
        const iEmail = findCol('email', 'e-mail');

        const parsed: { empresa: string; email: string }[] = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(sep).map(c => c.trim().replace(/^["']|["']$/g, ''));
          const empresa = iCompany >= 0 ? (cols[iCompany] || '') : '';
          const email = iEmail >= 0 ? (cols[iEmail] || '') : '';
          if (empresa || email) parsed.push({ empresa, email });
        }
        setClients(prev => [...prev, ...parsed]);
        setMsg(`${parsed.length} clientes adicionados. Clique "Salvar" para confirmar.`);
      } else {
        const parsed: { empresa: string; email: string }[] = [];
        for (const line of lines) {
          const name = line.replace(/^["';,]+|["';,]+$/g, '').trim();
          if (name) parsed.push({ empresa: name, email: '' });
        }
        setClients(prev => [...prev, ...parsed]);
        setMsg(`${parsed.length} clientes adicionados. Clique "Salvar" para confirmar.`);
      }
    };
    reader.readAsText(file);
  };

  const addManual = () => {
    if (!newEmpresa && !newEmail) return;
    setClients(prev => [...prev, { empresa: newEmpresa, email: newEmail }]);
    setNewEmpresa('');
    setNewEmail('');
    setMsg('Cliente adicionado. Clique "Salvar" para confirmar.');
  };

  const removeClient = (idx: number) => {
    setClients(prev => prev.filter((_, i) => i !== idx));
    setMsg('Cliente removido. Clique "Salvar" para confirmar.');
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clients }),
      });
      const data = await res.json();
      if (data.ok) setMsg(`${data.count} clientes salvos.`);
      else setMsg('Erro: ' + (data.error || 'desconhecido'));
    } catch (err: any) {
      setMsg('Erro: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="max-w-4xl mx-auto animate-pulse">
      <div className="h-8 bg-slate-200 rounded w-48 mb-8" />
      <div className="h-64 bg-slate-200 rounded-2xl" />
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-slate-800">Base de Clientes</h1>
        <p className="text-slate-500 mt-1">Clientes atuais são flaggados no upload para evitar prospecção duplicada</p>
      </div>

      {msg && <p className="text-sm text-miia-600 bg-miia-50 rounded-lg px-4 py-3 mb-4">{msg}</p>}

      {/* Actions */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={e => {
          const f = e.target.files?.[0];
          if (f) handleUpload(f);
        }} />
        <button onClick={() => fileRef.current?.click()}
          className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50">
          Upload CSV/Lista
        </button>
        <button onClick={save} disabled={saving || clients.length === 0}
          className="px-5 py-2.5 bg-miia-500 text-white rounded-xl text-sm font-medium hover:bg-miia-600 disabled:opacity-50">
          {saving ? 'Salvando...' : `Salvar (${clients.length})`}
        </button>
        <span className="px-3 py-2.5 text-xs text-slate-500 bg-slate-100 rounded-lg">{clients.length} clientes na base</span>
      </div>

      {/* Manual add */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Adicionar manualmente</h3>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="text-[10px] text-slate-400 mb-1 block">Empresa</label>
            <input value={newEmpresa} onChange={e => setNewEmpresa(e.target.value)}
              placeholder="Nome da empresa"
              onKeyDown={e => e.key === 'Enter' && addManual()}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-miia-400/50" />
          </div>
          <div className="flex-1">
            <label className="text-[10px] text-slate-400 mb-1 block">Email (opcional)</label>
            <input value={newEmail} onChange={e => setNewEmail(e.target.value)}
              placeholder="email@empresa.com"
              onKeyDown={e => e.key === 'Enter' && addManual()}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-miia-400/50" />
          </div>
          <button onClick={addManual}
            className="px-5 py-2 bg-green-500 text-white rounded-xl text-sm font-medium hover:bg-green-600 whitespace-nowrap">
            + Adicionar
          </button>
        </div>
      </div>

      {/* Client list */}
      {clients.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <h3 className="font-semibold text-slate-700">Clientes ({clients.length})</h3>
          </div>
          <div className="max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500">Empresa</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500">Email</th>
                  <th className="text-center px-3 py-2.5 text-xs font-medium text-slate-400 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c, i) => (
                  <tr key={i} className="border-t border-slate-50 group hover:bg-slate-50/50">
                    <td className="px-4 py-2 text-slate-700">{c.empresa}</td>
                    <td className="px-4 py-2 text-slate-500">{c.email || '—'}</td>
                    <td className="px-3 py-2 text-center">
                      <button onClick={() => removeClient(i)}
                        className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {clients.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <p className="text-lg mb-2">Nenhum cliente cadastrado</p>
          <p className="text-sm">Faça upload de um CSV ou adicione manualmente acima</p>
        </div>
      )}
    </div>
  );
}
