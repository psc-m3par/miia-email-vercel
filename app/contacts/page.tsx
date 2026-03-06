'use client';

import { useState, useEffect } from 'react';

interface Contact {
  rowIndex: number; firstName: string; lastName: string; companyName: string;
  email: string; category: string; email1Enviado: string;
  fup1Enviado: string; fup2Enviado: string; threadId: string;
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/sheets?type=contacts')
      .then(r => r.json())
      .then(data => {
        if (data.contacts) {
          setContacts(data.contacts);
          const cats = Array.from(new Set(data.contacts.map((c: Contact) => c.category).filter(Boolean))) as string[];
          setCategories(cats);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const getStatus = (c: Contact) => {
    if (c.fup1Enviado === 'RESPONDIDO' || c.fup2Enviado === 'RESPONDIDO') return 'respondido';
    if (c.fup2Enviado?.startsWith('OK')) return 'fup2';
    if (c.fup1Enviado?.startsWith('OK')) return 'fup1';
    if (c.email1Enviado?.startsWith('ERRO')) return 'erro';
    if (c.email1Enviado?.startsWith('OK')) return 'email1';
    return 'pendente';
  };

  const statusLabel: Record<string, { label: string; bg: string; text: string }> = {
    pendente:   { label: 'Pendente',    bg: 'bg-slate-100',  text: 'text-slate-600' },
    email1:     { label: 'Email 1',     bg: 'bg-blue-100',   text: 'text-blue-700' },
    fup1:       { label: 'FUP1',        bg: 'bg-indigo-100', text: 'text-indigo-700' },
    fup2:       { label: 'FUP2',        bg: 'bg-purple-100', text: 'text-purple-700' },
    respondido: { label: 'Respondido',  bg: 'bg-green-100',  text: 'text-green-700' },
    erro:       { label: 'Erro',        bg: 'bg-red-100',    text: 'text-red-700' },
  };

  const filtered = contacts.filter(c => {
    if (filterCat && c.category !== filterCat) return false;
    if (filterStatus && getStatus(c) !== filterStatus) return false;
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
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Thread</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map((c, i) => {
                const status = getStatus(c);
                const sl = statusLabel[status];
                return (
                  <tr key={i} className="border-t border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-3 text-slate-700 font-medium">{c.firstName} {c.lastName}</td>
                    <td className="px-4 py-3 text-slate-500">{c.companyName}</td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-xs">{c.email}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-lg">{c.category}</span>
                    </td>
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