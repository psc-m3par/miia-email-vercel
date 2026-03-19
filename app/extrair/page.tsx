'use client';

import { useState, useEffect } from 'react';

const STATUS_OPTIONS = [
  { key: 'respondido', label: 'Respondido', color: 'bg-green-100 text-green-700' },
  { key: 'bounced', label: 'Bounced', color: 'bg-red-100 text-red-600' },
  { key: 'erro', label: 'Erro', color: 'bg-orange-100 text-orange-700' },
  { key: 'email1_enviado', label: 'E1 enviado (sem resposta)', color: 'bg-blue-100 text-blue-700' },
  { key: 'fup1_enviado', label: 'FUP1 enviado (sem resposta)', color: 'bg-indigo-100 text-indigo-700' },
  { key: 'fup2_enviado', label: 'FUP2 enviado (sem resposta)', color: 'bg-purple-100 text-purple-700' },
  { key: 'pendente', label: 'Pendente (não enviado)', color: 'bg-amber-100 text-amber-700' },
];

const PIPE_OPTIONS = [
  { key: 'NOVO', label: 'Novo', color: 'bg-amber-100 text-amber-700' },
  { key: 'NEGOCIACAO', label: 'Conversando', color: 'bg-blue-100 text-blue-700' },
  { key: 'AGUARDANDO_MATERIAIS', label: 'Aguardando materiais', color: 'bg-orange-100 text-orange-700' },
  { key: 'REUNIAO', label: 'Reunião marcada', color: 'bg-purple-100 text-purple-700' },
  { key: 'GANHO', label: 'Ganho', color: 'bg-green-100 text-green-700' },
  { key: 'PERDIDO', label: 'Perdido', color: 'bg-slate-100 text-slate-500' },
  { key: 'SEM_PIPELINE', label: 'Sem pipeline', color: 'bg-slate-50 text-slate-400' },
];

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  respondido: { label: 'Respondido', color: 'bg-green-100 text-green-700' },
  bounced: { label: 'Bounced', color: 'bg-red-100 text-red-600' },
  erro: { label: 'Erro', color: 'bg-orange-100 text-orange-700' },
  email1_enviado: { label: 'E1', color: 'bg-blue-100 text-blue-700' },
  fup1_enviado: { label: 'FUP1', color: 'bg-indigo-100 text-indigo-700' },
  fup2_enviado: { label: 'FUP2', color: 'bg-purple-100 text-purple-700' },
  pendente: { label: 'Pendente', color: 'bg-amber-100 text-amber-700' },
};

interface Contact {
  firstName: string;
  lastName: string;
  companyName: string;
  category: string;
  status: string;
  pipeline: string;
  email: string;
  phone: string;
}

export default function ExtrairPage() {
  const [allCategorias, setAllCategorias] = useState<string[]>([]);
  const [accounts, setAccounts] = useState<string[]>([]);
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string[]>([]);
  const [selectedPipe, setSelectedPipe] = useState<string[]>([]);
  const [campos, setCampos] = useState({ email: true, whatsapp: true });
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingCsv, setLoadingCsv] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [googleAccount, setGoogleAccount] = useState('');
  const [googleResult, setGoogleResult] = useState<{ saved: number; errors: number; total: number; errorMessages?: string[] } | null>(null);

  // Load categories and accounts
  useEffect(() => {
    fetch('/api/sheets?type=painel').then(r => r.json()).then(data => {
      if (Array.isArray(data)) {
        setAllCategorias(data.map((c: any) => c.category));
      }
    });
    // Load all connected accounts from tokens
    fetch('/api/tokens').then(r => r.json()).then(data => {
      if (data.accounts && Array.isArray(data.accounts)) {
        const emails = data.accounts.map((t: any) => t.email).filter(Boolean);
        setAccounts(emails);
        if (emails.length > 0) setGoogleAccount(emails[0]);
      }
    });
  }, []);

  // Load preview data
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoadingPreview(true);
      fetch('/api/extrair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categorias: selectedCats,
          statusResposta: selectedStatus,
          statusPipe: selectedPipe,
          campos,
          format: 'json',
        }),
      })
        .then(r => r.json())
        .then(data => { if (data.contacts) setContacts(data.contacts); })
        .catch(() => setContacts([]))
        .finally(() => setLoadingPreview(false));
    }, 400);
    return () => clearTimeout(timer);
  }, [selectedCats, selectedStatus, selectedPipe, campos]);

  const handleVcard = () => {
    if (contacts.length === 0) return;
    const vcards = contacts.map(c => {
      const familyName = [c.lastName, c.companyName].filter(Boolean).join(' - ');
      const phone = c.phone ? (c.phone.startsWith('+') ? c.phone : '+' + c.phone) : '';
      return [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `N:${familyName};${c.firstName};;;`,
        `FN:${c.firstName} ${familyName}`,
        c.companyName ? `ORG:${c.companyName}` : '',
        c.email ? `EMAIL;TYPE=WORK:${c.email}` : '',
        phone ? `TEL;TYPE=CELL:${phone}` : '',
        'END:VCARD',
      ].filter(Boolean).join('\r\n');
    }).join('\r\n');

    const blob = new Blob([vcards], { type: 'text/vcard;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contatos_${new Date().toISOString().slice(0, 10)}.vcf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const handleCsv = async () => {
    setLoadingCsv(true);
    try {
      const res = await fetch('/api/extrair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categorias: selectedCats, statusResposta: selectedStatus, statusPipe: selectedPipe, campos, format: 'csv' }),
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `extracao_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert('Erro: ' + (e as Error).message);
    } finally {
      setLoadingCsv(false);
    }
  };

  const handleGoogleContacts = async () => {
    if (!googleAccount) { alert('Selecione uma conta Google'); return; }
    if (contacts.length === 0) { alert('Nenhum contato para salvar'); return; }
    if (!confirm(`Salvar ${contacts.length} contatos no Google Contacts de ${googleAccount}?`)) return;

    setLoadingGoogle(true);
    setGoogleResult(null);
    try {
      const res = await fetch('/api/google-contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts, accountEmail: googleAccount }),
      });
      const data = await res.json();
      if (data.error) {
        alert('Erro: ' + data.error);
      } else {
        setGoogleResult(data);
      }
    } catch (e) {
      alert('Erro: ' + (e as Error).message);
    } finally {
      setLoadingGoogle(false);
    }
  };

  const toggleItem = (list: string[], setList: (v: string[]) => void, item: string) => {
    setList(list.includes(item) ? list.filter(i => i !== item) : [...list, item]);
  };

  const Chip = ({ label, color, selected, onClick }: { label: string; color: string; selected: boolean; onClick: () => void }) => (
    <button onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
        selected ? `${color} border-current ring-2 ring-current/20` : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
      }`}>
      {label}
    </button>
  );

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-slate-800">Extrair Contatos</h1>
        <p className="text-slate-400 text-sm mt-1">Filtre, visualize e exporte contatos</p>
      </div>

      <div className="space-y-4">
        {/* Filtros */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          {/* Categoria */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-bold text-slate-700">Categoria</h2>
              {selectedCats.length > 0 && <button onClick={() => setSelectedCats([])} className="text-[10px] text-slate-400 hover:text-slate-600">Limpar</button>}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {allCategorias.map(cat => (
                <Chip key={cat} label={cat} color="bg-miia-100 text-miia-700" selected={selectedCats.includes(cat)} onClick={() => toggleItem(selectedCats, setSelectedCats, cat)} />
              ))}
            </div>
          </div>

          {/* Status */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-bold text-slate-700">Status de Resposta</h2>
              {selectedStatus.length > 0 && <button onClick={() => setSelectedStatus([])} className="text-[10px] text-slate-400 hover:text-slate-600">Limpar</button>}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_OPTIONS.map(s => (
                <Chip key={s.key} label={s.label} color={s.color} selected={selectedStatus.includes(s.key)} onClick={() => toggleItem(selectedStatus, setSelectedStatus, s.key)} />
              ))}
            </div>
          </div>

          {/* Pipeline */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-bold text-slate-700">Pipeline</h2>
              {selectedPipe.length > 0 && <button onClick={() => setSelectedPipe([])} className="text-[10px] text-slate-400 hover:text-slate-600">Limpar</button>}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PIPE_OPTIONS.map(p => (
                <Chip key={p.key} label={p.label} color={p.color} selected={selectedPipe.includes(p.key)} onClick={() => toggleItem(selectedPipe, setSelectedPipe, p.key)} />
              ))}
            </div>
          </div>

          {/* Campos */}
          <div className="flex gap-4 pt-2 border-t border-slate-100">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={campos.email} onChange={e => setCampos({ ...campos, email: e.target.checked })} className="w-3.5 h-3.5 rounded border-slate-300 text-miia-500" />
              <span className="text-xs text-slate-700">Email</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={campos.whatsapp} onChange={e => setCampos({ ...campos, whatsapp: e.target.checked })} className="w-3.5 h-3.5 rounded border-slate-300 text-miia-500" />
              <span className="text-xs text-slate-700">WhatsApp</span>
            </label>
          </div>
        </div>

        {/* Preview Table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-bold text-slate-700">Preview</h2>
              <span className="text-xs text-slate-400">
                {loadingPreview ? 'Carregando...' : `${contacts.length} contatos`}
              </span>
            </div>
          </div>
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="text-left py-2 px-3 text-slate-500 font-medium">Nome</th>
                  <th className="text-left py-2 px-3 text-slate-500 font-medium">Empresa</th>
                  <th className="text-left py-2 px-3 text-slate-500 font-medium">Categoria</th>
                  <th className="text-left py-2 px-3 text-slate-500 font-medium">Status</th>
                  {campos.email && <th className="text-left py-2 px-3 text-slate-500 font-medium">Email</th>}
                  {campos.whatsapp && <th className="text-left py-2 px-3 text-slate-500 font-medium">WhatsApp</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {contacts.slice(0, 100).map((c, i) => {
                  const st = STATUS_LABELS[c.status] || { label: c.status, color: 'bg-slate-100 text-slate-500' };
                  return (
                    <tr key={i} className="hover:bg-slate-50/50">
                      <td className="py-2 px-3 text-slate-700 font-medium">{c.firstName} {c.lastName}</td>
                      <td className="py-2 px-3 text-slate-500">{c.companyName}</td>
                      <td className="py-2 px-3"><span className="bg-miia-50 text-miia-600 px-1.5 py-0.5 rounded-full text-[10px]">{c.category}</span></td>
                      <td className="py-2 px-3"><span className={`px-1.5 py-0.5 rounded-full text-[10px] ${st.color}`}>{st.label}</span></td>
                      {campos.email && <td className="py-2 px-3 text-slate-400">{c.email}</td>}
                      {campos.whatsapp && <td className="py-2 px-3 text-slate-400">{c.phone}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {contacts.length === 0 && !loadingPreview && (
              <div className="p-8 text-center text-slate-300 text-sm">Nenhum contato encontrado com os filtros selecionados</div>
            )}
            {contacts.length > 100 && (
              <div className="p-3 text-center text-slate-400 text-[10px] bg-slate-50 border-t border-slate-100">
                Mostrando 100 de {contacts.length} contatos. Exporte para ver todos.
              </div>
            )}
          </div>
        </div>

        {/* Export Actions */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex flex-col md:flex-row gap-4">
            {/* CSV Export */}
            <div className="flex-1">
              <h3 className="text-xs font-bold text-slate-700 mb-2">Baixar Planilha</h3>
              <button onClick={handleCsv} disabled={loadingCsv || contacts.length === 0}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  loadingCsv || contacts.length === 0
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-slate-700 text-white hover:bg-slate-800'
                }`}>
                {loadingCsv ? 'Exportando...' : `Baixar CSV (${contacts.length})`}
              </button>
            </div>

            {/* Google Contacts Export */}
            <div className="flex-1">
              <h3 className="text-xs font-bold text-slate-700 mb-2">Salvar no Google Contacts</h3>
              <div className="flex gap-2">
                <select value={googleAccount} onChange={e => setGoogleAccount(e.target.value)}
                  className="flex-1 py-2 px-3 text-xs border border-slate-200 rounded-xl text-slate-600 bg-white focus:outline-none">
                  {accounts.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
                <button onClick={handleGoogleContacts} disabled={loadingGoogle || contacts.length === 0}
                  className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                    loadingGoogle || contacts.length === 0
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'bg-miia-500 text-white hover:bg-miia-600'
                  }`}>
                  {loadingGoogle ? 'Salvando...' : `Salvar (${contacts.length})`}
                </button>
              </div>
              {googleResult && (
                <div className="mt-2">
                  <div className={`text-xs font-medium ${googleResult.errors > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                    {googleResult.saved}/{googleResult.total} salvos
                    {googleResult.errors > 0 && ` · ${googleResult.errors} erros`}
                  </div>
                  {(googleResult.errorMessages ?? []).length > 0 && (
                    <div className="mt-1 text-[10px] text-red-500 space-y-0.5">
                      {(googleResult.errorMessages ?? []).map((msg: string, i: number) => (
                        <div key={i}>{msg}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <p className="text-[10px] text-slate-400 mt-1">Requer reconexão do Gmail com permissão de Contatos</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
