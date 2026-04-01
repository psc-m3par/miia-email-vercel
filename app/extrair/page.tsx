'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

const STATUS_OPTIONS = [
  { key: 'respondido', label: 'Respondido', color: 'bg-green-100 text-green-700' },
  { key: 'bounced', label: 'Bounced', color: 'bg-red-100 text-red-600' },
  { key: 'erro', label: 'Erro', color: 'bg-orange-100 text-orange-700' },
  { key: 'email1_enviado', label: 'E1 enviado (sem resposta)', color: 'bg-blue-100 text-blue-700' },
  { key: 'fup1_enviado', label: 'FUP1 enviado (sem resposta)', color: 'bg-indigo-100 text-indigo-700' },
  { key: 'fup2_enviado', label: 'FUP2 enviado (sem resposta)', color: 'bg-purple-100 text-purple-700' },
  { key: 'fup3_enviado', label: 'FUP3 enviado (sem resposta)', color: 'bg-violet-100 text-violet-700' },
  { key: 'fup4_enviado', label: 'FUP4 enviado (sem resposta)', color: 'bg-fuchsia-100 text-fuchsia-700' },
  { key: 'fup5_enviado', label: 'FUP5 enviado (sem resposta)', color: 'bg-pink-100 text-pink-700' },
  { key: 'fup6_enviado', label: 'FUP6 enviado (sem resposta)', color: 'bg-rose-100 text-rose-700' },
  { key: 'fup7_enviado', label: 'FUP7 enviado (sem resposta)', color: 'bg-orange-100 text-orange-700' },
  { key: 'fup8_enviado', label: 'FUP8 enviado (sem resposta)', color: 'bg-amber-100 text-amber-700' },
  { key: 'fup9_enviado', label: 'FUP9 enviado (sem resposta)', color: 'bg-teal-100 text-teal-700' },
  { key: 'fup10_enviado', label: 'FUP10 enviado (sem resposta)', color: 'bg-cyan-100 text-cyan-700' },
  { key: 'pendente', label: 'Pendente (nao enviado)', color: 'bg-amber-100 text-amber-700' },
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
  fup3_enviado: { label: 'FUP3', color: 'bg-violet-100 text-violet-700' },
  fup4_enviado: { label: 'FUP4', color: 'bg-fuchsia-100 text-fuchsia-700' },
  fup5_enviado: { label: 'FUP5', color: 'bg-pink-100 text-pink-700' },
  fup6_enviado: { label: 'FUP6', color: 'bg-rose-100 text-rose-700' },
  fup7_enviado: { label: 'FUP7', color: 'bg-orange-100 text-orange-700' },
  fup8_enviado: { label: 'FUP8', color: 'bg-amber-100 text-amber-700' },
  fup9_enviado: { label: 'FUP9', color: 'bg-teal-100 text-teal-700' },
  fup10_enviado: { label: 'FUP10', color: 'bg-cyan-100 text-cyan-700' },
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

// Parsed from Exact CRM CSV
interface ExactContact {
  firstName: string;
  lastName: string;
  companyName: string;
  email: string;
  phone: string;
  cargo: string;
  // Cross-check fields (populated after matching with sheet)
  matched?: boolean;
  status?: string;
  pipeline?: string;
  sheetCategory?: string;
}

function parseCsvLine(line: string, sep: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === sep && !inQuotes) { result.push(current); current = ''; continue; }
    current += ch;
  }
  result.push(current);
  return result;
}

function parseExactCsv(text: string): ExactContact[] {
  // Strip UTF-8 BOM if present
  const clean = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
  const allLines = clean.split(/\r?\n/).filter(l => l.trim() !== '');
  if (allLines.length < 2) return [];

  // Auto-detect separator
  const hasSemicolon = allLines[0].includes(';');
  const sep = hasSemicolon ? ';' : ',';

  // Find the actual header row (search for known column names)
  const knownHeaders = ['first name', 'nome contato', 'email', 'nome lead', 'company name', 'company'];
  let headerIdx = 0;
  for (let i = 0; i < Math.min(allLines.length, 10); i++) {
    const lower = allLines[i].toLowerCase();
    if (knownHeaders.some(h => lower.includes(h))) {
      headerIdx = i;
      break;
    }
  }

  const lines = allLines.slice(headerIdx);
  if (lines.length < 2) return [];

  const header = parseCsvLine(lines[0], sep).map(h => h.trim().toLowerCase());

  // Flexible column finder: match partial names
  const findCol = (...names: string[]) => {
    for (const name of names) {
      const idx = header.findIndex(h => h === name.toLowerCase());
      if (idx >= 0) return idx;
    }
    // Try partial match
    for (const name of names) {
      const idx = header.findIndex(h => h.includes(name.toLowerCase()));
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const iFirstName = findCol('First Name', 'NOME CONTATO', 'Nome');
  const iLastName = findCol('Last Name', 'Sobrenome');
  const iCompany = findCol('Company Name', 'Company', 'NOME LEAD', 'Empresa');
  const iPhone = findCol('Mobile Phone', 'TELEFONE', 'Phone', 'WhatsApp', 'Tel');
  const iEmail = findCol('Email', 'EMAIL', 'E-mail');
  const iCargo = findCol('Title', 'CARGO', 'Cargo');

  if (iFirstName === -1) {
    throw new Error('CSV inválido: coluna de nome não encontrada. Verifique se o CSV tem header "First Name", "NOME CONTATO" ou similar.');
  }

  const seenEmails = new Set<string>();
  const results: ExactContact[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i], sep);
    const rawPhone = iPhone >= 0 ? (cols[iPhone] || '').trim() : '';
    // Clean phone: remove quotes, =, +, spaces, hyphens, parens
    const phoneClean = rawPhone.replace(/[="'+\s\-()]/g, '');
    const email = iEmail >= 0 ? (cols[iEmail] || '').trim() : '';

    // Skip contacts without phone AND without email
    if (!phoneClean && !email) continue;

    // Deduplicate by email
    if (email) {
      const emailKey = email.toLowerCase();
      if (seenEmails.has(emailKey)) continue;
      seenEmails.add(emailKey);
    }

    results.push({
      firstName: (cols[iFirstName] || '').trim(),
      lastName: iLastName >= 0 ? (cols[iLastName] || '').trim() : '',
      companyName: (cols[iCompany] || '').trim(),
      email: iEmail !== -1 ? (cols[iEmail] || '').trim() : '',
      phone: phoneClean,
      cargo: iCargo !== -1 ? (cols[iCargo] || '').trim() : '',
    });
  }

  return results;
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

  // Exact CSV state
  const [exactContacts, setExactContacts] = useState<ExactContact[] | null>(null);
  const [exactCompanies, setExactCompanies] = useState<string[]>([]);
  const [selectedExactCompanies, setSelectedExactCompanies] = useState<string[]>([]);
  const [selectedExactStatus, setSelectedExactStatus] = useState<string[]>([]);
  const [selectedExactPipe, setSelectedExactPipe] = useState<string[]>([]);
  const [exactFileName, setExactFileName] = useState('');
  const [crossCheckDone, setCrossCheckDone] = useState(false);
  const [crossCheckLoading, setCrossCheckLoading] = useState(false);
  const [crossCheckStats, setCrossCheckStats] = useState<{ total: number; matched: number; unmatched: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [onlyWithPhone, setOnlyWithPhone] = useState(true);
  const [uploadCategory, setUploadCategory] = useState('');
  const [completedCats, setCompletedCats] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isExactMode = exactContacts !== null;

  // Filtered exact contacts (company + status + pipeline + phone filter)
  const filteredExactContacts = isExactMode
    ? exactContacts
        .filter(c => selectedExactCompanies.length === 0 || selectedExactCompanies.includes(c.companyName))
        .filter(c => selectedExactStatus.length === 0 || selectedExactStatus.includes(c.status || 'nao_encontrado'))
        .filter(c => selectedExactPipe.length === 0 || selectedExactPipe.includes(c.pipeline || 'SEM_PIPELINE'))
        .filter(c => !onlyWithPhone || c.phone)
    : [];

  // The contacts to use for export actions (unified)
  const activeContacts: { firstName: string; lastName: string; companyName: string; email: string; phone: string }[] =
    isExactMode
      ? filteredExactContacts
      : contacts;

  // Load categories, accounts, and completed bases
  useEffect(() => {
    fetch('/api/sheets?type=painel').then(r => r.json()).then(data => {
      if (Array.isArray(data)) {
        setAllCategorias(data.map((c: any) => c.category));
      }
    });
    fetch('/api/tokens').then(r => r.json()).then(data => {
      const arr = Array.isArray(data) ? data : data.accounts || data.tokens || [];
      const emails = arr.map((t: any) => t.email).filter(Boolean);
      setAccounts(emails);
      if (emails.length > 0) setGoogleAccount(emails[0]);
    });
    fetch('/api/resultados', { cache: 'no-store' }).then(r => r.json()).then(data => {
      if (data?.results) {
        setCompletedCats(new Set(data.results.filter((r: any) => r.isComplete).map((r: any) => r.category)));
      }
    });
  }, []);

  // Load preview data (only when NOT in exact mode)
  useEffect(() => {
    if (isExactMode) return;
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
  }, [selectedCats, selectedStatus, selectedPipe, campos, isExactMode]);

  // Handle file upload (Exact CSV)
  const handleFileUpload = useCallback((file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      alert('Por favor, envie um arquivo .csv');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = parseExactCsv(text);
        if (parsed.length === 0) {
          alert('Nenhum contato encontrado no CSV.');
          return;
        }
        // Apply selected category to all contacts
        if (uploadCategory) {
          parsed.forEach(c => { c.sheetCategory = uploadCategory; });
        }
        setExactContacts(parsed);
        setExactFileName(file.name);
        const companies = Array.from(new Set(parsed.map(c => c.companyName))).filter(Boolean).sort();
        setExactCompanies(companies);
        setSelectedExactCompanies([]);
        setSelectedExactStatus([]);
        setSelectedExactPipe([]);
        setCrossCheckDone(false);
        setCrossCheckStats(null);

        // Auto cross-check with sheet data
        setCrossCheckLoading(true);
        fetch('/api/extrair/crosscheck', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ exactContacts: parsed }),
        })
          .then(r => r.json())
          .then(data => {
            if (data.contacts) {
              setExactContacts(data.contacts);
              setCrossCheckDone(true);
              setCrossCheckStats(data.stats);
            }
          })
          .catch(() => {/* cross-check failed, keep original data */})
          .finally(() => setCrossCheckLoading(false));
      } catch (err) {
        alert('Erro ao processar CSV: ' + (err as Error).message);
      }
    };
    reader.readAsText(file, 'utf-8');
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const clearExactCsv = () => {
    setExactContacts(null);
    setExactCompanies([]);
    setSelectedExactCompanies([]);
    setSelectedExactStatus([]);
    setSelectedExactPipe([]);
    setExactFileName('');
    setCrossCheckDone(false);
    setCrossCheckStats(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const generateVcardBlob = () => {
    const vcards = activeContacts.map(c => {
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
    return new Blob([vcards], { type: 'text/vcard;charset=utf-8' });
  };

  const handleVcard = () => {
    if (activeContacts.length === 0) return;
    const blob = generateVcardBlob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contatos_${new Date().toISOString().slice(0, 10)}.vcf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const handleShareVcard = async () => {
    if (activeContacts.length === 0) return;
    const blob = generateVcardBlob();
    const file = new File([blob], `contatos_${new Date().toISOString().slice(0, 10)}.vcf`, { type: 'text/vcard' });

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Contatos' });
      } catch {
        // User cancelled or share failed — fallback to download
        handleVcard();
      }
    } else {
      // Browser doesn't support file sharing — fallback to download
      handleVcard();
      alert('Seu browser não suporta compartilhamento direto. O arquivo foi baixado — arraste pro WhatsApp Web.');
    }
  };

  const handleCsv = async () => {
    if (isExactMode) {
      // Export filtered exact contacts as CSV directly
      const rows = filteredExactContacts.map(c =>
        [c.firstName, c.companyName, c.cargo, c.phone, c.email].map(v => `"${(v || '').replace(/"/g, '""')}"`).join(',')
      );
      const csv = ['Nome,Empresa,Cargo,Telefone,Email', ...rows].join('\r\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `exact_contatos_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      return;
    }

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
    if (activeContacts.length === 0) { alert('Nenhum contato para salvar'); return; }
    if (!confirm(`Salvar ${activeContacts.length} contatos no Google Contacts de ${googleAccount}?`)) return;

    setLoadingGoogle(true);
    setGoogleResult(null);
    try {
      const payload = activeContacts.map(c => ({
        firstName: c.firstName,
        lastName: c.lastName,
        companyName: c.companyName,
        email: c.email,
        phone: c.phone,
      }));
      const res = await fetch('/api/google-contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts: payload, accountEmail: googleAccount }),
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

  const displayContacts = isExactMode ? filteredExactContacts : contacts;
  const displayCount = displayContacts.length;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-slate-800">Extrair Contatos</h1>
        <p className="text-slate-400 text-sm mt-1">Filtre, visualize e exporte contatos</p>
      </div>

      <div className="space-y-4">
        {/* CSV Upload Area */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-slate-700">Importar CSV do Exact CRM</h2>
            {isExactMode && (
              <button onClick={clearExactCsv} className="text-xs text-red-500 hover:text-red-700 font-medium">
                Remover arquivo
              </button>
            )}
          </div>

          {!isExactMode ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">Categoria do CSV</label>
                <select
                  value={uploadCategory}
                  onChange={e => setUploadCategory(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 text-slate-600 focus:outline-none focus:ring-2 focus:ring-miia-400/50"
                >
                  <option value="">Selecione a categoria...</option>
                  {allCategorias.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => {
                  if (!uploadCategory) { alert('Selecione a categoria primeiro'); return; }
                  fileInputRef.current?.click();
                }}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                  dragOver
                    ? 'border-miia-400 bg-miia-50'
                    : !uploadCategory
                      ? 'border-slate-100 bg-slate-50 opacity-60'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                />
                <div className="text-slate-400">
                  <svg className="mx-auto mb-2 w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  <p className="text-sm font-medium text-slate-500">
                    {uploadCategory ? 'Arraste o CSV aqui ou clique para selecionar' : 'Selecione a categoria acima primeiro'}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">Aceita: Exact (;) ou Apollo (,)</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 bg-miia-50 rounded-xl p-4">
              <svg className="w-5 h-5 text-miia-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-miia-700 truncate">{exactFileName}</p>
                <p className="text-[10px] text-miia-500">{exactContacts.length} contatos com telefone encontrados</p>
              </div>
            </div>
          )}
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          {/* Categoria / Company filter */}
          {isExactMode ? (
            <>
              {/* Cross-check status */}
              {crossCheckLoading && (
                <div className="text-xs text-amber-600 font-medium">Cruzando com dados da planilha...</div>
              )}
              {crossCheckDone && crossCheckStats && (
                <div className="text-xs text-green-600 font-medium">
                  Cross-check: {crossCheckStats.matched} encontrados na planilha · {crossCheckStats.unmatched} novos
                </div>
              )}

              {/* Empresa */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xs font-bold text-slate-700">Empresa (NOME LEAD)</h2>
                  {selectedExactCompanies.length > 0 && (
                    <button onClick={() => setSelectedExactCompanies([])} className="text-[10px] text-slate-400 hover:text-slate-600">Limpar</button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {exactCompanies.map(company => (
                    <Chip
                      key={company}
                      label={company}
                      color="bg-miia-100 text-miia-700"
                      selected={selectedExactCompanies.includes(company)}
                      onClick={() => toggleItem(selectedExactCompanies, setSelectedExactCompanies, company)}
                    />
                  ))}
                </div>
              </div>

              {/* Status (only after cross-check) */}
              {crossCheckDone && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-xs font-bold text-slate-700">Status de Resposta</h2>
                    {selectedExactStatus.length > 0 && <button onClick={() => setSelectedExactStatus([])} className="text-[10px] text-slate-400 hover:text-slate-600">Limpar</button>}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[...STATUS_OPTIONS, { key: 'nao_encontrado', label: 'Não encontrado na base', color: 'bg-slate-100 text-slate-500' }].map(s => (
                      <Chip key={s.key} label={s.label} color={s.color} selected={selectedExactStatus.includes(s.key)} onClick={() => toggleItem(selectedExactStatus, setSelectedExactStatus, s.key)} />
                    ))}
                  </div>
                </div>
              )}

              {/* Pipeline (only after cross-check) */}
              {crossCheckDone && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-xs font-bold text-slate-700">Pipeline</h2>
                    {selectedExactPipe.length > 0 && <button onClick={() => setSelectedExactPipe([])} className="text-[10px] text-slate-400 hover:text-slate-600">Limpar</button>}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {PIPE_OPTIONS.map(p => (
                      <Chip key={p.key} label={p.label} color={p.color} selected={selectedExactPipe.includes(p.key)} onClick={() => toggleItem(selectedExactPipe, setSelectedExactPipe, p.key)} />
                    ))}
                  </div>
                </div>
              )}

              {/* WhatsApp filter */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={onlyWithPhone} onChange={e => setOnlyWithPhone(e.target.checked)} className="w-3.5 h-3.5 rounded border-slate-300 text-miia-500" />
                  <span className="text-xs font-bold text-slate-700">Só com WhatsApp</span>
                </label>
              </div>
            </>
          ) : (
            <>
              {/* Categoria */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xs font-bold text-slate-700">Categoria</h2>
                  <div className="flex items-center gap-2">
                    {completedCats.size > 0 && (
                      <>
                        <button
                          onClick={() => setSelectedCats(allCategorias.filter(c => completedCats.has(c)))}
                          className="text-[10px] text-green-600 hover:text-green-800 font-medium"
                        >
                          Finalizadas ({allCategorias.filter(c => completedCats.has(c)).length})
                        </button>
                        <span className="text-slate-200">|</span>
                        <button
                          onClick={() => setSelectedCats(allCategorias.filter(c => !completedCats.has(c)))}
                          className="text-[10px] text-amber-600 hover:text-amber-800 font-medium"
                        >
                          Ativas ({allCategorias.filter(c => !completedCats.has(c)).length})
                        </button>
                        <span className="text-slate-200">|</span>
                      </>
                    )}
                    {selectedCats.length > 0 && <button onClick={() => setSelectedCats([])} className="text-[10px] text-slate-400 hover:text-slate-600">Limpar</button>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {allCategorias.map(cat => (
                    <Chip key={cat} label={cat} color={completedCats.has(cat) ? 'bg-green-100 text-green-700' : 'bg-miia-100 text-miia-700'} selected={selectedCats.includes(cat)} onClick={() => toggleItem(selectedCats, setSelectedCats, cat)} />
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
            </>
          )}
        </div>

        {/* Preview Table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-bold text-slate-700">Preview</h2>
              <span className="text-xs text-slate-400">
                {!isExactMode && loadingPreview ? 'Carregando...' : `${displayCount} contatos`}
              </span>
            </div>
          </div>
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            {isExactMode ? (
              /* Exact CRM table */
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="text-left py-2 px-3 text-slate-500 font-medium">Nome - Empresa (Categoria)</th>
                    <th className="text-left py-2 px-3 text-slate-500 font-medium">Cargo</th>
                    <th className="text-left py-2 px-3 text-slate-500 font-medium">WhatsApp</th>
                    <th className="text-left py-2 px-3 text-slate-500 font-medium">Email</th>
                    {crossCheckDone && <th className="text-left py-2 px-3 text-slate-500 font-medium">Status</th>}
                    {crossCheckDone && <th className="text-left py-2 px-3 text-slate-500 font-medium">Pipeline</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredExactContacts.slice(0, 100).map((c, i) => {
                    const st = STATUS_LABELS[c.status || ''] || { label: c.status === 'nao_encontrado' ? 'Novo' : (c.status || ''), color: 'bg-slate-100 text-slate-500' };
                    const fullName = [c.firstName, c.lastName].filter(Boolean).join(' ');
                    const catLabel = c.sheetCategory ? ` (${c.sheetCategory})` : '';
                    const displayName = `${fullName} - ${c.companyName}${catLabel}`;
                    return (
                      <tr key={i} className="hover:bg-slate-50/50">
                        <td className="py-2 px-3 text-slate-700 font-medium">{displayName}</td>
                        <td className="py-2 px-3 text-slate-500">{c.cargo}</td>
                        <td className="py-2 px-3 text-slate-500">{c.phone || '-'}</td>
                        <td className="py-2 px-3 text-slate-400">{c.email}</td>
                        {crossCheckDone && <td className="py-2 px-3"><span className={`px-1.5 py-0.5 rounded-full text-[10px] ${st.color}`}>{st.label}</span></td>}
                        {crossCheckDone && <td className="py-2 px-3 text-slate-400">{c.pipeline || '-'}</td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              /* Original email automation table */
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
            )}
            {displayCount === 0 && !loadingPreview && (
              <div className="p-8 text-center text-slate-300 text-sm">
                {isExactMode ? 'Nenhum contato encontrado com os filtros selecionados' : 'Nenhum contato encontrado com os filtros selecionados'}
              </div>
            )}
            {displayCount > 100 && (
              <div className="p-3 text-center text-slate-400 text-[10px] bg-slate-50 border-t border-slate-100">
                Mostrando 100 de {displayCount} contatos. Exporte para ver todos.
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
              <button onClick={handleCsv} disabled={loadingCsv || displayCount === 0}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  loadingCsv || displayCount === 0
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-slate-700 text-white hover:bg-slate-800'
                }`}>
                {loadingCsv ? 'Exportando...' : `Baixar CSV (${displayCount})`}
              </button>
            </div>

            {/* vCard Export */}
            <div className="flex-1">
              <h3 className="text-xs font-bold text-slate-700 mb-2">Enviar pro celular</h3>
              <div className="flex gap-2">
                <button onClick={handleShareVcard} disabled={displayCount === 0}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    displayCount === 0
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}>
                  {`Compartilhar .vcf (${displayCount})`}
                </button>
                <button onClick={handleVcard} disabled={displayCount === 0}
                  className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    displayCount === 0
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                  }`}>
                  Baixar
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Compartilha via WhatsApp/email ou baixa o .vcf. Abra no celular pra importar.</p>
            </div>

            {/* Google Contacts Export */}
            <div className="flex-1">
              <h3 className="text-xs font-bold text-slate-700 mb-2">Salvar no Google Contacts</h3>
              <div className="flex gap-2">
                <select value={googleAccount} onChange={e => setGoogleAccount(e.target.value)}
                  className="flex-1 py-2 px-3 text-xs border border-slate-200 rounded-xl text-slate-600 bg-white focus:outline-none">
                  {accounts.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
                <button onClick={handleGoogleContacts} disabled={loadingGoogle || displayCount === 0}
                  className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                    loadingGoogle || displayCount === 0
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'bg-miia-500 text-white hover:bg-miia-600'
                  }`}>
                  {loadingGoogle ? 'Salvando...' : `Salvar (${displayCount})`}
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
