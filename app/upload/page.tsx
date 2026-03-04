'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface ParsedContact {
  'First Name': string;
  'Last Name': string;
  'Company Name': string;
  Email: string;
  'Mobile Phone': string;
  'Person Linkedin Url': string;
  [key: string]: string;
}

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [contacts, setContacts] = useState<ParsedContact[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load categories from Painel
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

      if (f.name.endsWith('.csv')) {
        // Parse CSV
        const Papa = (await import('papaparse')).default;
        const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
        const data = parsed.data as ParsedContact[];
        setContacts(data.filter(r => r.Email || r.email));
      } else if (f.name.endsWith('.xlsx') || f.name.endsWith('.xls')) {
        // Parse XLSX
        const XLSX = await import('xlsx');
        const arrayBuffer = await f.arrayBuffer();
        const wb = XLSX.read(arrayBuffer, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws) as ParsedContact[];
        setContacts(data.filter(r => r.Email || r.email));
      } else {
        setError('Formato não suportado. Use .csv ou .xlsx');
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

  const handleUpload = async () => {
    const cat = selectedCategory || newCategory;
    if (!cat) { setError('Selecione ou crie uma category'); return; }
    if (contacts.length === 0) { setError('Nenhum contato para enviar'); return; }

    setUploading(true);
    setError('');

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts, category: cat }),
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
        <p className="text-slate-500 mt-1">Faça upload da base exportada do Apollo (.csv ou .xlsx)</p>
      </div>

      {result ? (
        <SuccessState result={result} onReset={reset} />
      ) : (
        <>
          {/* Dropzone */}
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

          {/* Preview */}
          {contacts.length > 0 && (
            <div className="animate-slide-up">
              {/* Preview table */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden mb-6">
                <div className="px-5 py-3 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="font-semibold text-slate-700">Preview ({contacts.length} contatos)</h3>
                  <span className="text-xs text-slate-400">Mostrando primeiros 5</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Nome</th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Empresa</th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">Email</th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">LinkedIn</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contacts.slice(0, 5).map((c, i) => (
                        <tr key={i} className="border-t border-slate-50 hover:bg-slate-50/50">
                          <td className="px-4 py-2.5 text-slate-700">{c['First Name']} {c['Last Name']}</td>
                          <td className="px-4 py-2.5 text-slate-500">{c['Company Name']}</td>
                          <td className="px-4 py-2.5 text-slate-500 font-mono text-xs">{c.Email || c.email}</td>
                          <td className="px-4 py-2.5 text-slate-400 text-xs truncate max-w-[200px]">{c['Person Linkedin Url'] ? '✓' : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Category selector */}
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

              {/* Upload button */}
              <button
                onClick={handleUpload}
                disabled={uploading || (!selectedCategory && !newCategory)}
                className="w-full py-4 bg-miia-500 text-white rounded-2xl font-semibold text-lg hover:bg-miia-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-miia-500/25 transition-all hover:shadow-xl hover:shadow-miia-500/30"
              >
                {uploading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    Enviando para planilha...
                  </span>
                ) : (
                  `Enviar ${contacts.length} contatos → Planilha`
                )}
              </button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 animate-fade-in">
              ❌ {error}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SuccessState({ result, onReset }: { result: any; onReset: () => void }) {
  return (
    <div className="text-center py-16 animate-slide-up">
      <div className="text-7xl mb-6">🎉</div>
      <h2 className="font-display text-2xl font-bold text-slate-800 mb-2">Upload concluído!</h2>
      <div className="bg-green-50 border border-green-200 rounded-2xl p-6 max-w-md mx-auto mt-6 text-left">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">Category:</span><strong>{result.category}</strong></div>
          <div className="flex justify-between"><span className="text-slate-500">Total processados:</span><strong>{result.total}</strong></div>
          <div className="flex justify-between"><span className="text-slate-500">Válidos enviados:</span><strong className="text-green-600">{result.valid}</strong></div>
          {result.invalid > 0 && (
            <div className="flex justify-between"><span className="text-slate-500">Inválidos (sem email):</span><strong className="text-red-500">{result.invalid}</strong></div>
          )}
        </div>
      </div>
      <p className="text-sm text-slate-400 mt-4">Os contatos já estão na planilha. O script vai começar a enviar automaticamente.</p>
      <button onClick={onReset} className="mt-6 px-8 py-3 bg-miia-500 text-white rounded-xl font-medium hover:bg-miia-600">
        Fazer novo upload
      </button>
    </div>
  );
}
