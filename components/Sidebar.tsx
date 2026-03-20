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

function IconPainel({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18" />
      <path d="M9 21V9" />
    </svg>
  );
}

function IconComercial({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}

function IconChats({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  );
}

function IconCopilot({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function IconSettings({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}

function IconChevronDown({ className, open }: { className?: string; open: boolean }) {
  return (
    <svg className={`${className} transition-transform duration-200 ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function IconCollapse({ className, collapsed }: { className?: string; collapsed: boolean }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {collapsed ? <polyline points="9 18 15 12 9 6" /> : <polyline points="15 18 9 12 15 6" />}
    </svg>
  );
}

function IconLogout({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

const COMERCIAL_ITEMS = [
  { href: '/upload', label: 'Upload de base' },
  { href: '/templates', label: 'Templates' },
  { href: '/pipeline', label: 'Pipeline' },
  { href: '/contacts', label: 'Contatos' },
  { href: '/extrair', label: 'Extrair' },
  { href: '/resultados', label: 'Resultados' },
];

const SETTINGS_ITEMS = [
  { href: '/connect', label: 'Conectar Gmail' },
  { href: '/monitor', label: 'Monitor' },
];

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

export default function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [comercialOpen, setComercialOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const isComercialActive = COMERCIAL_ITEMS.some(i => pathname === i.href);
  const isSettingsActive = SETTINGS_ITEMS.some(i => pathname === i.href);

  useEffect(() => {
    fetch('/api/session').then(r => r.json()).then(d => setCurrentUser(d.user)).catch(() => {});
  }, []);

  // Auto-open group if a child is active
  useEffect(() => {
    if (isComercialActive) setComercialOpen(true);
    if (isSettingsActive) setSettingsOpen(true);
  }, [isComercialActive, isSettingsActive]);

  const navItemClass = (active: boolean) =>
    `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
      active
        ? 'bg-miia-500 text-white shadow-sm shadow-miia-500/25'
        : 'text-slate-600 hover:bg-slate-50 hover:text-miia-500'
    }`;

  const subItemClass = (active: boolean) =>
    `block pl-9 pr-4 py-2 rounded-lg text-xs font-medium transition-all ${
      active
        ? 'text-miia-600 bg-miia-50'
        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
    }`;

  if (collapsed) {
    return (
      <aside className="fixed left-0 top-0 h-screen w-16 bg-white border-r border-slate-200 flex flex-col z-50">
        <div className="px-3 py-5 flex justify-center border-b border-slate-100">
          <div className="w-9 h-9 rounded-xl bg-miia-500 flex items-center justify-center">
            <span className="text-white font-bold font-display">M</span>
          </div>
        </div>
        <nav className="flex-1 py-4 px-2 space-y-1">
          {[
            { href: '/', Icon: IconDashboard, label: 'Dashboard' },
            { href: '/settings', Icon: IconPainel, label: 'Painel' },
            { href: '/upload', Icon: IconComercial, label: 'Comercial' },
            { href: '/chats', Icon: IconChats, label: 'Chats' },
            { href: '/copilot', Icon: IconCopilot, label: 'Copiloto' },
            { href: '/connect', Icon: IconSettings, label: 'Settings' },
          ].map(({ href, Icon, label }) => {
            const active = pathname === href || (href === '/upload' && isComercialActive) || (href === '/connect' && isSettingsActive);
            return (
              <Link key={href} href={href} title={label}
                className={`flex justify-center py-3 rounded-xl transition-all ${active ? 'bg-miia-500' : 'hover:bg-slate-50'}`}>
                <Icon className={`w-5 h-5 ${active ? 'text-white' : 'text-slate-400'}`} />
              </Link>
            );
          })}
        </nav>
        <div className="px-2 py-4 border-t border-slate-100 flex flex-col items-center gap-2">
          <a href="/api/auth/logout" title="Sair" className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
            <IconLogout className="w-4 h-4" />
          </a>
          {onToggle && (
            <button onClick={onToggle} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
              <IconCollapse className="w-4 h-4" collapsed={collapsed} />
            </button>
          )}
        </div>
      </aside>
    );
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-white border-r border-slate-200 flex flex-col z-50">
      {/* Header */}
      <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-miia-500 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold font-display">M</span>
          </div>
          <div>
            <h1 className="font-display font-bold text-miia-500 text-base leading-tight">MIIA</h1>
            <p className="text-[10px] text-slate-400 leading-tight">Email Automation</p>
          </div>
        </div>
        {onToggle && (
          <button onClick={onToggle} className="p-1.5 rounded-lg text-slate-300 hover:text-slate-500 hover:bg-slate-100 transition-colors">
            <IconCollapse className="w-4 h-4" collapsed={collapsed} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {/* Dashboard */}
        <Link href="/" className={navItemClass(pathname === '/')}>
          <IconDashboard className="w-4 h-4 flex-shrink-0" />
          Dashboard
        </Link>

        {/* Painel */}
        <Link href="/settings" className={navItemClass(pathname === '/settings')}>
          <IconPainel className="w-4 h-4 flex-shrink-0" />
          Painel
        </Link>

        {/* Comercial (expandable) */}
        <div>
          <button
            onClick={() => setComercialOpen(o => !o)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              isComercialActive && !comercialOpen
                ? 'bg-miia-50 text-miia-600'
                : 'text-slate-600 hover:bg-slate-50 hover:text-miia-500'
            }`}>
            <IconComercial className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1 text-left">Comercial</span>
            <IconChevronDown className="w-3.5 h-3.5" open={comercialOpen} />
          </button>
          {comercialOpen && (
            <div className="mt-1 space-y-0.5">
              {COMERCIAL_ITEMS.map(item => (
                <Link key={item.href} href={item.href} className={subItemClass(pathname === item.href)}>
                  {item.label}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Chats */}
        <Link href="/chats" className={navItemClass(pathname === '/chats' || pathname.startsWith('/chats'))}>
          <IconChats className="w-4 h-4 flex-shrink-0" />
          Chats
        </Link>

        {/* Copiloto */}
        <Link href="/copilot" className={navItemClass(pathname === '/copilot')}>
          <IconCopilot className="w-4 h-4 flex-shrink-0" />
          Copiloto
        </Link>

        {/* Settings (expandable) */}
        <div>
          <button
            onClick={() => setSettingsOpen(o => !o)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              isSettingsActive && !settingsOpen
                ? 'bg-miia-50 text-miia-600'
                : 'text-slate-600 hover:bg-slate-50 hover:text-miia-500'
            }`}>
            <IconSettings className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1 text-left">Settings</span>
            <IconChevronDown className="w-3.5 h-3.5" open={settingsOpen} />
          </button>
          {settingsOpen && (
            <div className="mt-1 space-y-0.5">
              {SETTINGS_ITEMS.map(item => (
                <Link key={item.href} href={item.href} className={subItemClass(pathname === item.href)}>
                  {item.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-slate-100">
        {currentUser && (
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-full bg-miia-100 flex items-center justify-center flex-shrink-0">
              <span className="text-miia-600 font-bold text-xs">{currentUser[0].toUpperCase()}</span>
            </div>
            <span className="text-xs text-slate-500 truncate flex-1">{currentUser}</span>
            <a href="/api/auth/logout" title="Sair" className="p-1 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0">
              <IconLogout className="w-3.5 h-3.5" />
            </a>
          </div>
        )}
        <a
          href={'https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/edit'}
          target="_blank"
          rel="noopener"
          className="text-xs text-slate-300 hover:text-miia-400 transition-colors"
        >
          Abrir Planilha
        </a>
      </div>
    </aside>
  );
}
