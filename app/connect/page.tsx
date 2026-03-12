'use client';
import { useState, useEffect } from 'react';

interface Account {
  email: string;
  status: 'ativo' | 'expirado';
  expiry: string;
}

export default function ConnectPage() {
  const [authSuccess, setAuthSuccess] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('auth') === 'success') {
      setAuthSuccess(true);
      setAuthEmail(params.get('email') || '');
    }
    fetch('/api/tokens').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setAccounts(data);
    }).finally(() => setLoadingAccounts(false));
  }, []);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-slate-800">Conectar Gmail</h1>
        <p className="text-slate-500 mt-1">
          Cada responsavel precisa conectar seu Gmail uma vez para que o sistema possa enviar emails da sua conta.
        </p>
      </div>

      {authSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-6 mb-6">
          <h3 className="font-semibold text-green-800 mb-1">Conectado com sucesso!</h3>
          <p className="text-green-700 text-sm">
            O Gmail de <strong>{authEmail}</strong> foi conectado. Agora o sistema pode enviar emails desta conta.
          </p>
        </div>
      )}

      {/* Contas conectadas */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm mb-6">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-display text-base font-bold text-slate-800">Contas Conectadas</h2>
          <p className="text-[11px] text-slate-400 mt-0.5">Tokens de acesso armazenados na planilha</p>
        </div>
        {loadingAccounts ? (
          <div className="px-6 py-4 animate-pulse">
            <div className="h-8 bg-slate-100 rounded w-64 mb-2" />
            <div className="h-8 bg-slate-100 rounded w-48" />
          </div>
        ) : accounts.length === 0 ? (
          <div className="px-6 py-8 text-center">
            <p className="text-slate-400 text-sm">Nenhuma conta conectada ainda.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {accounts.map(acc => (
              <div key={acc.email} className="px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${acc.status === 'ativo' ? 'bg-green-500' : 'bg-red-400'}`} />
                  <span className="text-sm font-medium text-slate-700">{acc.email}</span>
                </div>
                <div className="flex items-center gap-3">
                  {acc.expiry && (
                    <span className="text-[10px] text-slate-400">
                      expira {new Date(acc.expiry).toLocaleDateString('pt-BR')}
                    </span>
                  )}
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                    acc.status === 'ativo'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-600'
                  }`}>
                    {acc.status === 'ativo' ? 'Ativo' : 'Expirado'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">Autorizar acesso ao Gmail</h2>
          <p className="text-slate-500 text-sm mb-6 max-w-md mx-auto">
            Ao clicar no botao abaixo, voce sera redirecionado para o Google onde podera autorizar o envio de emails pela sua conta.
          </p>
          <a
            href="/api/auth/login"
            className="inline-flex items-center gap-3 px-8 py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 shadow-lg shadow-blue-500/20 transition-all"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Conectar com Google
          </a>
        </div>
      </div>

      <div className="mt-6 bg-slate-50 rounded-2xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-700 mb-3">Como funciona</h3>
        <div className="space-y-3 text-sm text-slate-600">
          <p>1. Clique em "Conectar com Google" e faca login com a conta que sera usada para enviar emails.</p>
          <p>2. Autorize as permissoes solicitadas (envio e leitura de emails).</p>
          <p>3. Pronto! O sistema salvara o token de acesso e podera enviar emails da sua conta automaticamente.</p>
          <p>4. Cada responsavel so precisa fazer isso uma vez. O token se renova automaticamente.</p>
        </div>
      </div>
    </div>
  );
}
