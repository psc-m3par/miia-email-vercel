'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

const SHEET_ID = '1njKJ8Bm0JMJlh0kvycfYU6xqg1CWu4nSqAldEp2-fak';

function IconDashboard({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="4" rx="1" />
      <rect x="14" y="11" width="7" height="10" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function IconUpload({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function IconTemplates({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function IconContatos({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

function IconPainel({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}

function IconGmail({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

function IconMonitor({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function IconReply({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 17 4 12 9 7" />
      <path d="M20 18v-2a4 4 0 00-4-4H4" />
    </svg>
  );
}

const NAV = [
  { href: '/', label: 'Dashboard', Icon: IconDashboard },
  { href: '/monitor', label: 'Monitor', Icon: IconMonitor },
  { href: '/upload', label: 'Upload Apollo', Icon: IconUpload },
  { href: '/templates', label: 'Templates', Icon: IconTemplates },
  { href: '/contacts', label: 'Contatos', Icon: IconContatos },
  { href: '/settings', label: 'Painel', Icon: IconPainel },
  { href: '/connect', label: 'Conectar Gmail', Icon: IconGmail },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [respondidosCount, setRespondidosCount] = useState(0);
  useEffect(() => {
    fetch('/api/respondidos', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setRespondidosCount(d.respondidos?.filter((r: any) => r.atendido !== 'SIM').length || 0))
      .catch(() => {});
  }, []);
  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-white border-r border-slate-200 flex flex-col z-50">
      <div className="px-6 py-6 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-miia-500 flex items-center justify-center">
            <span className="text-white font-bold font-display text-lg">M</span>
          </div>
          <div>
            <h1 className="font-display font-bold text-miia-500 text-lg leading-tight">MIIA</h1>
            <p className="text-xs text-slate-400 leading-tight">Email Automation</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-miia-500 text-white shadow-lg shadow-miia-500/25'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-miia-500'
              }`}
            >
              <item.Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              {item.label}
            </Link>
          );
        })}
        {respondidosCount > 0 && (
          <Link
            href="/respondidos"
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              pathname === '/respondidos'
                ? 'bg-miia-500 text-white shadow-lg shadow-miia-500/25'
                : 'text-slate-600 hover:bg-slate-50 hover:text-miia-500'
            }`}
          >
            <IconReply className={`w-5 h-5 ${pathname === '/respondidos' ? 'text-white' : 'text-slate-400'}`} />
            <span className="flex-1">Respondidos</span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${pathname === '/respondidos' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'}`}>
              {respondidosCount}
            </span>
          </Link>
        )}
      </nav>
      <div className="px-6 py-4 border-t border-slate-100">
        <p className="text-xs text-slate-400">v4.0 - Marco 2026</p>
        <a
          href={'https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/edit'}
          target="_blank"
          rel="noopener"
          className="text-xs text-miia-400 hover:text-miia-500 mt-1 inline-block"
        >
          Abrir Planilha
        </a>
      </div>
    </aside>
  );
}