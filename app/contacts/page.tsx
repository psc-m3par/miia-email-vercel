'use client';

import { useState, useEffect } from 'react';

interface Contact {
  rowIndex: number; firstName: string; lastName: string; companyName: string;
  email: string; category: string; email1Enviado: string;
  fup1Enviado: string; fup2Enviado: string;
  fup3Enviado: string; fup4Enviado: string; fup5Enviado: string; fup6Enviado: string;
  fup7Enviado: string; fup8Enviado: string; fup9Enviado: string; fup10Enviado: string;
  threadId: string;
}

interface PainelRow {
  category: string; responsavel: string;
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [painel, setPainel] = useState<PainelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterResp, setFilterResp] = useState('');
  const [search, setSearch] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [responsaveis, setResponsaveis] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([
      fetch('/api/sheets?type=contacts').then(r => r.json()),
      fetch('/api/sheets?type=painel').then(r => r.json()),
    ]).then(([contactData, painelData]) => {
      if (contactData.contacts) {
        setContacts(contactData.contacts);
        const cats = Array.from(new Set(contactData.contacts.map((c: Contact) => c.category).filter(Boolean))) as string[];
        setCategories(cats);
      }
      if (Array.isArray(painelData)) {
        setPainel(painelData);
        const resps = Array.from(new Set(painelData.map((p: PainelRow) => p.responsavel).filter(Boolean))) as string[];
        setResponsaveis(resps);
      }
    }).finally(() => setLoading(false));
  }, []);

  const getResponsavel = (category: string) => {
    const p = painel.find(p => p.category === category);
    return p ? p.responsavel : '';
  };

  const getStatus = (c: Contact) => {
    const allFupEnviados = [c.fup1Enviado, c.fup2Enviado, c.fup3Enviado, c.fup4Enviado, c.fup5Enviado, c.fup6Enviado, c.fup7Enviado, c.fup8Enviado, c.fup9Enviado, c.fup10Enviado];
    if (allFupEnviados.some(f => f === 'BOUNCE')) return 'bounce';
    if (allFupEnviados.some(f => f === 'RESPONDIDO')) return 'respondido';
    // Check from highest FUP down
    for (let i = 9; i >= 0; i--) {
      if (allFupEnviados[i]?.startsWith('OK')) return `fup${i + 1}`;
    }
    if (c.email1Enviado?.startsWith('ERRO')) return 'erro';
    if (c.email1Enviado?.startsWith('OK')) return 'email1';
    return 'pendente';
  };

  const statusLabel: Record<string, { label: string; bg: string; text: string }> = {
    pendente:   { label: 'Pendente',       bg: 'bg-slate-100',   text: 'text-slate-600' },
    email1:     { label: 'Email 1',        bg: 'bg-blue-100',    text: 'text-blue-700' },
    fup1:       { label: 'FUP1',           bg: 'bg-indigo-100',  text: 'text-indigo-700' },
    fup2:       { label: 'FUP2',           bg: 'bg-purple-100',  text: 'text-purple-700' },
    fup3:       { label: 'FUP3',           bg: 'bg-violet-100',  text: 'text-violet-700' },
    fup4:       { label: 'FUP4',           bg: 'bg-fuchsia-100', text: 'text-fuchsia-700' },
    fup5:       { label: 'FUP5',           bg: 'bg-pink-100',    text: 'text-pink-700' },
    fup6:       { label: 'FUP6',           bg: 'bg-rose-100',    text: 'text-rose-700' },
    fup7:       { label: 'FUP7',           bg: 'bg-orange-100',  text: 'text-orange-700' },
    fup8:       { label: 'FUP8',           bg: 'bg-amber-100',   text: 'text-amber-700' },
    fup9:       { label: 'FUP9',           bg: 'bg-teal-100',    text: 'text-teal-700' },
    fup10:      { label: 'FUP10',          bg: 'bg-cyan-100',    text: 'text-cyan-700' },
    respondido: { label: 'Respondido',     bg: 'bg-green-100',   text: 'text-green-700' },
    bounce:     { label: 'Nao encontrado', bg: 'bg-orange-100',  text: 'text-orange-700' },
    erro:       { label: 'Erro',           bg: 'bg-red-100',     text: 'text-red-700' },
  };

  const filtered = contacts.filter(c => {
    if (filterCat && c.category !== filterCat) return false;
    if (filterStatus && getStatus(c) !== filterStatus) return false;
    if (filterResp && getResponsavel(c.category) !== filterResp) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!((c.firstName + ' ' + c.lastName).toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.companyName.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  if (loading) return <div className="animate-pulse"><div className="h-8 bg-slate-200 rounded w-48 mb-8" /><div className="h-96 bg-slate-200 rounded-2xl" /></div>;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="font-display text-3xl font-bold text-slate-800">Contatos</h1>
          <p className="text-slate-500 mt-1">{contacts.length} contatos na base</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-6 flex gap-4 items-center flex-wrap">
        <input
          type="text"
          placeholder="Buscar nome, email ou empresa..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-miia-400/50"
        />
        <select
          value={filterCat}
          onChange={e => setFilterCat(e.target.value)}
          className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-miia-400/50"
        >
          <option value="">Todas categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={filterResp}
          onChange={e => setFilterResp(e.target.value)}
          className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-miia-400/50"
        >
          <option value="">Todos responsaveis</option>
          {responsaveis.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-miia-400/50"
        >
          <option value="">Todos status</option>
          {Object.entries(statusLabel).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <span className="text-xs text-slate-400">{filtered.length} resultados</span>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Nome</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Empresa</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Category</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Responsavel</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Thread</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map((c, i) => {
                const status = getStatus(c);
                const sl = statusLabel[status];
                const resp = getResponsavel(c.category);
                return (
                  <tr key={i} className="border-t border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-3 text-slate-700 font-medium">{c.firstName} {c.lastName}</td>
                    <td className="px-4 py-3 text-slate-500">{c.companyName}</td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-xs">{c.email}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-lg">{c.category}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{resp}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2.5 py-1 rounded-lg font-medium ${sl.bg} ${sl.text}`}>{sl.label}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400 font-mono">{c.threadId ? 'OK' : '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length > 100 && (
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-400 text-center">
            Mostrando 100 de {filtered.length} contatos
          </div>
        )}
      </div>
    </div>
  );
}