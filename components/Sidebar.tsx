'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
const SHEET_ID = '1njKJ8Bm0JMJlh0kvycfYU6xqg1CWu4nSqAldEp2-fak';
const NAV = [
  { href: '/', label: 'Dashboard', icon: 'D' },
  { href: '/upload', label: 'Upload Apollo', icon: 'U' },
  { href: '/templates', label: 'Templates', icon: 'T' },
  { href: '/contacts', label: 'Contatos', icon: 'C' },
  { href: '/settings', label: 'Painel', icon: 'P' },
  { href: '/connect', label: 'Conectar Gmail', icon: 'G' },
];
export default function Sidebar() {
  const pathname = usePathname();
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
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
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