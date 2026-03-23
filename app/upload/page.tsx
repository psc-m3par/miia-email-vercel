'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface ParsedContact {
  firstName: string;
  lastName: string;
  companyName: string;
  email: string;
  mobilePhone: string;
  linkedinUrl: string;
}

function parseCSV(text: string): ParsedContact[] {
  // Strip BOM
  const clean = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
  const allLines = clean.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (allLines.length < 2) return [];

  // Find actual header row (skip title/empty rows)
  const knownHeaders = ['first name', 'email', 'company', 'nome contato', 'nome lead'];
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

  const headerLine = lines[0];
  const headers = headerLine.split(',').map(h => h.trim().toLowerCase());

  const isApolloFormat = lines.length > 1 && lines[1].startsWith('"') && lines[1].endsWith('"');

  if (isApolloFormat) {
    return parseApolloFormat(lines);
  } else {
    return parseNormalFormat(lines, headers);
  }
}

function parseApolloFormat(lines: string[]): ParsedContact[] {
  const contacts: ParsedContact[] = [];

  for (let i = 1; i < lines.length; i++) {
    let line = lines[i];
    if (!line) continue;

    if (line.startsWith('"') && line.endsWith('"')) {
      line = line.substring(1, line.length - 1);
    }
    line = line.replace(/""/g, '');

    const parts = line.split(',').map(p => p.trim().replace(/^'/, ''));
    if (parts.length < 5) continue;

    const email = parts[4] || '';
    if (!email || !email.includes('@')) continue;

    contacts.push({
      firstName: parts[0] || '',
      lastName: parts[1] || '',
      companyName: parts[3] || '',
      email: email,
      mobilePhone: (parts[6] || '').replace(/^'/, ''),
      linkedinUrl: parts[7] || '',
    });
  }

  return contacts;
}

function parseNormalFormat(lines: string[], headers: string[]): ParsedContact[] {
  const col = (...names: string[]) => {
    // Exact match first
    for (const name of names) {
      const idx = headers.indexOf(name.toLowerCase());
      if (idx !== -1) return idx;
    }
    // Partial match
    for (const name of names) {
      const idx = headers.findIndex(h => h.includes(name.toLowerCase()));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const iFirst = col('first name', 'nome contato', 'nome');
  const iLast = col('last name', 'sobrenome');
  const iCompany = col('company name', 'company', 'nome lead', 'empresa');
  const iEmail = col('email', 'e-mail');
  const iPhone = col('mobile phone', 'telefone', 'phone', 'whatsapp');
  const iLinkedin = col('person linkedin url', 'linkedin');

  if (iFirst === -1 && iEmail === -1) return [];

  const contacts: ParsedContact[] = [];

  for (let i = 1; i < lines.length; i++) {
    // Parse CSV line respecting quoted fields
    const parts: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let j = 0; j < lines[i].length; j++) {
      const ch = lines[i][j];
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === ',' && !inQuotes) { parts.push(current.trim()); current = ''; continue; }
      current += ch;
    }
    parts.push(current.trim());

    const email = iEmail >= 0 ? (parts[iEmail] || '') : '';
    if (!email || !email.includes('@')) continue;

    contacts.push({
      firstName: iFirst >= 0 ? (parts[iFirst] || '') : '',
      lastName: iLast >= 0 ? (parts[iLast] || '') : '',
      companyName: iCompany >= 0 ? (parts[iCompany] || '') : '',
      email: email,
      mobilePhone: iPhone >= 0 ? (parts[iPhone] || '') : '',
      linkedinUrl: iLinkedin >= 0 ? (parts[iLinkedin] || '') : '',
    });
  }

  return contacts;
}

interface ContactFlags {
  duplicata: boolean;
  duplicataInfo: string | null;
  clienteAtual: boolean;
  clienteMatchType: 'email' | 'empresa' | null;
}

interface AnnotatedContact extends ParsedContact {
  flags?: ContactFlags;
}

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [contacts, setContacts] = useState<AnnotatedContact[]>([]);
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [crossCheckStats, setCrossCheckStats] = useState<{ total: number; duplicatas: number; clientesAtuais: number; limpos: number } | null>(null);
  const [crossChecking, setCrossChecking] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/sheets?type=painel')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setCategories(data.map((p: any) => p.category));
        }
      });
  }, []);

  const parseFile = useCallback(async (f: File) => {
    setFile(f);
    setError('');
    setResult(null);

    try {
      const text = await f.text();

      let parsed: ParsedContact[] = [];

      if (f.name.endsWith('.csv')) {
        parsed = parseCSV(text);
      } else if (f.name.endsWith('.xlsx') || f.name.endsWith('.xls')) {
        const XLSX = await import('xlsx');
        const arrayBuffer = await f.arrayBuffer();
        const wb = XLSX.read(arrayBuffer, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws) as any[];
        parsed = data.filter(r => r.Email || r.email).map(r => ({
          firstName: r['First Name'] || '',
          lastName: r['Last Name'] || '',
          companyName: r['Company Name'] || '',
          email: r.Email || r.email || '',
          mobilePhone: r['Mobile Phone'] || '',
          linkedinUrl: r['Person Linkedin Url'] || '',
        }));
      } else {
        setError('Formato nao suportado. Use .csv ou .xlsx');
        return;
      }

      if (parsed.length === 0) {
        setError('Nenhum contato encontrado no CSV.');
        return;
      }

      setContacts(parsed);

      // Run cross-check
      setCrossChecking(true);
      try {
        const res = await fetch('/api/upload/crosscheck', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contacts: parsed }),
        });
        const data = await res.json();
        if (data.contacts) {
          setContacts(data.contacts);
          setCrossCheckStats(data.stats);
          const checks: Record<number, boolean> = {};
          data.contacts.forEach((c: AnnotatedContact, i: number) => {
            checks[i] = !c.flags?.duplicata && !c.flags?.clienteAtual;
          });
          setChecked(checks);
        }
      } catch {
        // Cross-check failed, continue without flags
        const checks: Record<number, boolean> = {};
        parsed.forEach((_: any, i: number) => { checks[i] = true; });
        setChecked(checks);
      } finally {
        setCrossChecking(false);
      }
    } catch (e: any) {
      setError('Erro ao processar arquivo: ' + e.message);
    }
  }, []);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) parseFile(e.dataTransfer.files[0]);
  };

  const selectedContacts = contacts.filter((_, i) => checked[i]);
  const selectedCount = selectedContacts.length;

  const handleUpload = async () => {
    const cat = selectedCategory || newCategory;
    if (!cat) { setError('Selecione ou crie uma category'); return; }
    if (selectedCount === 0) { setError('Nenhum contato selecionado'); return; }

    setUploading(true);
    setError('');

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts: selectedContacts, category: cat }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setContacts([]);
    setResult(null);
    setError('');
    setSelectedCategory('');
    setNewCategory('');
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-slate-800">Upload Apollo</h1>
        <p className="text-slate-500 mt-1">Faca upload da base exportada do Apollo (.csv ou .xlsx)</p>
      </div>

      {result ? (
        <SuccessState result={result} onReset={reset} />
      ) : (
        <>
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all mb-6 ${
              dragActive
                ? 'border-miia-400 bg-miia-50'
                : file
                ? 'border-green-300 bg-green-50'
                : 'border-slate-300 bg-white hover:border-miia-300 hover:bg-miia-50/30'
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={e => e.target.files?.[0] && parseFile(e.target.files[0])}
            />

            {file ? (
              <div className="animate-fade-in">
                <div className="text-4xl mb-3">✅</div>
                <p className="font-semibold text-slate-700">{file.name}</p>
                <p className="text-sm text-green-600 mt-1">{contacts.length} contatos encontrados</p>
                <button onClick={(e) => { e.stopPropagation(); reset(); }} className="text-xs text-slate-400 hover:text-red-400 mt-3">
                  Trocar arquivo
                </button>
              </div>
            ) : (
              <div>
                <div className="text-5xl mb-4">📤</div>
                <p className="font-semibold text-slate-600">Arraste o CSV/XLSX do Apollo aqui</p>
                <p className="text-sm text-slate-400 mt-2">ou clique para selecionar</p>
              </div>
            )}
          </div>

          {contacts.length > 0 && (
            <div className="animate-slide-up">
              {/* Cross-check stats */}
              {crossChecking && (
                <div className="bg-miia-50 rounded-2xl p-4 mb-4 text-center text-sm text-miia-600 animate-pulse">
                  Verificando duplicatas e clientes atuais...
                </div>
              )}
              {crossCheckStats && (
                <div className="flex gap-3 mb-4 flex-wrap">
                  <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-100 text-green-700">{crossCheckStats.limpos} limpos</span>
                  <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-100 text-amber-700">{crossCheckStats.duplicatas} duplicatas</span>
                  <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-100 text-red-700">{crossCheckStats.clientesAtuais} clientes atuais</span>
                  <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-miia-100 text-miia-700">{selectedCount} selecionados</span>
                  <button onClick={() => { const c: Record<number, boolean> = {}; contacts.forEach((_, i) => { c[i] = true; }); setChecked(c); }}
                    className="text-xs text-miia-500 hover:underline">Selecionar todos</button>
                  <button onClick={() => { const c: Record<number, boolean> = {}; contacts.forEach((ct: AnnotatedContact, i) => { c[i] = !ct.flags?.duplicata && !ct.flags?.clienteAtual; }); setChecked(c); }}
                    className="text-xs text-miia-500 hover:underline">Só limpos</button>
                  <button onClick={() => { const c: Record<number, boolean> = {}; contacts.forEach((_, i) => { c[i] = false; }); setChecked(c); }}
                    className="text-xs text-red-400 hover:underline">Deselecionar todos</button>
                </div>
              )}

              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden mb-6">
                <div className="px-5 py-3 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="font-semibold text-slate-700">Preview ({contacts.length} contatos)</h3>
                  <span className="text-xs text-slate-400">Mostrando primeiros 20</span>
                </div>
                <div className="overflow-x-auto max-h-96 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-50 z-10">
                      <tr>
                        <th className="px-3 py-2.5 text-center text-xs font-medium text-slate-500 w-8">
                          <input type="checkbox" checked={selectedCount === contacts.length}
                            onChange={e => { const c: Record<number, boolean> = {}; contacts.forEach((_, i) => { c[i] = e.target.checked; }); setChecked(c); }}
                            className="rounded" />
                        </th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Nome</th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Empresa</th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Email</th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contacts.slice(0, 20).map((c: AnnotatedContact, i) => (
                        <tr key={i} className={`border-t border-slate-50 hover:bg-slate-50/50 ${!checked[i] ? 'opacity-40' : ''}`}>
                          <td className="px-3 py-2 text-center">
                            <input type="checkbox" checked={!!checked[i]}
                              onChange={e => setChecked(prev => ({ ...prev, [i]: e.target.checked }))}
                              className="rounded" />
                          </td>
                          <td className="px-4 py-2 text-slate-700 text-xs">{c.firstName} {c.lastName}</td>
                          <td className="px-4 py-2 text-slate-500 text-xs">{c.companyName}</td>
                          <td className="px-4 py-2 text-slate-500 font-mono text-[10px]">{c.email}</td>
                          <td className="px-4 py-2">
                            {c.flags?.duplicata && (
                              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700" title={c.flags.duplicataInfo || ''}>
                                Duplicata {c.flags.duplicataInfo ? `(${c.flags.duplicataInfo})` : ''}
                              </span>
                            )}
                            {c.flags?.clienteAtual && (
                              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700 ml-1">
                                Cliente atual ({c.flags.clienteMatchType})
                              </span>
                            )}
                            {!c.flags?.duplicata && !c.flags?.clienteAtual && (
                              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700">Limpo</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
                <h3 className="font-semibold text-slate-700 mb-4">Selecionar Category</h3>
                {categories.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {categories.map(cat => (
                      <button
                        key={cat}
                        onClick={() => { setSelectedCategory(cat); setNewCategory(''); }}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                          selectedCategory === cat
                            ? 'bg-miia-500 text-white shadow-lg shadow-miia-500/25'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400">ou</span>
                  <input
                    type="text"
                    placeholder="Nova category..."
                    value={newCategory}
                    onChange={e => { setNewCategory(e.target.value); setSelectedCategory(''); }}
                    className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-miia-400/50 focus:border-miia-400"
                  />
                </div>
              </div>

              <button
                onClick={handleUpload}
                disabled={uploading || (!selectedCategory && !newCategory)}
                className="w-full py-4 bg-miia-500 text-white rounded-2xl font-semibold text-lg hover:bg-miia-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-miia-500/25"
              >
                {uploading ? 'Enviando para planilha...' : `Enviar ${selectedCount} contato${selectedCount !== 1 ? 's' : ''} para Planilha`}
              </button>
            </div>
          )}

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              {error}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SuccessState({ result, onReset }: { result: any; onReset: () => void }) {
  return (
    <div className="text-center py-16">
      <div className="text-7xl mb-6">🎉</div>
      <h2 className="font-display text-2xl font-bold text-slate-800 mb-2">Upload concluido!</h2>
      <div className="bg-green-50 border border-green-200 rounded-2xl p-6 max-w-md mx-auto mt-6 text-left">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">Category:</span><strong>{result.category}</strong></div>
          <div className="flex justify-between"><span className="text-slate-500">Total processados:</span><strong>{result.total}</strong></div>
          <div className="flex justify-between"><span className="text-slate-500">Validos enviados:</span><strong className="text-green-600">{result.valid}</strong></div>
          {result.invalid > 0 && (
            <div className="flex justify-between"><span className="text-slate-500">Invalidos:</span><strong className="text-red-500">{result.invalid}</strong></div>
          )}
        </div>
      </div>
      <button onClick={onReset} className="mt-6 px-8 py-3 bg-miia-500 text-white rounded-xl font-medium hover:bg-miia-600">
        Fazer novo upload
      </button>
    </div>
  );
}
