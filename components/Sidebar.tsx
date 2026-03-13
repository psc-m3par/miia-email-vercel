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

function IconCopilot({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function IconPipeline({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="4" height="18" rx="1" />
      <rect x="9" y="7" width="4" height="14" rx="1" />
      <rect x="16" y="11" width="4" height="10" rx="1" />
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

function IconLogout({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function IconChevron({ className, collapsed }: { className?: string; collapsed: boolean }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {collapsed
        ? <polyline points="9 18 15 12 9 6" />
        : <polyline points="15 18 9 12 15 6" />}
    </svg>
  );
}

const NAV = [
  { href: '/', label: 'Dashboard', Icon: IconDashboard },
  { href: '/chats', label: 'Chats', Icon: IconChats },
  { href: '/monitor', label: 'Monitor', Icon: IconMonitor },
  { href: '/pipeline', label: 'Pipeline', Icon: IconPipeline },
  { href: '/copilot', label: 'Copiloto', Icon: IconCopilot },
  { href: '/upload', label: 'Upload Apollo', Icon: IconUpload },
  { href: '/templates', label: 'Templates', Icon: IconTemplates },
  { href: '/contacts', label: 'Contatos', Icon: IconContatos },
  { href: '/settings', label: 'Painel', Icon: IconPainel },
  { href: '/connect', label: 'Conectar Gmail', Icon: IconGmail },
];

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

export default function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [unreadChats, setUnreadChats] = useState(0);

  useEffect(() => {
    fetch('/api/session').then(r => r.json()).then(d => setCurrentUser(d.user)).catch(() => {});
  }, []);

  useEffect(() => {
    const fetchUnread = () => {
      fetch('/api/internal-chat', { cache: 'no-store' })
        .then(r => r.json())
        .then(d => {
          const count = d.messages?.filter((m: any) => m.para === currentUser && m.lido !== 'SIM').length || 0;
          setUnreadChats(count);
        })
        .catch(() => {});
    };
    if (currentUser) {
      fetchUnread();
      const interval = setInterval(fetchUnread, 20000);
      return () => clearInterval(interval);
    }
  }, [currentUser]);

  const allNav = NAV.map(item =>
    item.href === '/chats' && unreadChats > 0
      ? { ...item, badge: unreadChats }
      : item
  );

  return (
    <aside className={`fixed left-0 top-0 h-screen bg-white border-r border-slate-200 flex flex-col z-50 transition-all duration-200 ${collapsed ? 'w-16' : 'w-64'}`}>
      {/* Header */}
      <div className={`border-b border-slate-100 flex items-center ${collapsed ? 'px-3 py-6 justify-center' : 'px-6 py-6 justify-between'}`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-miia-500 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold font-display text-lg">M</span>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="font-display font-bold text-miia-500 text-lg leading-tight">MIIA</h1>
              <p className="text-xs text-slate-400 leading-tight">Email Automation</p>
            </div>
          )}
        </div>
        {!collapsed && onToggle && (
          <button onClick={onToggle} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors flex-shrink-0">
            <IconChevron className="w-4 h-4" collapsed={collapsed} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className={`flex-1 py-4 space-y-1 ${collapsed ? 'px-2' : 'px-3'}`}>
        {allNav.map((item) => {
          const isActive = pathname === item.href;
          const badge = (item as any).badge;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`flex items-center rounded-xl text-sm font-medium transition-all ${
                collapsed ? 'justify-center px-0 py-3' : 'gap-3 px-4 py-3'
              } ${
                isActive
                  ? 'bg-miia-500 text-white shadow-lg shadow-miia-500/25'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-miia-500'
              }`}
            >
              <div className="relative flex-shrink-0">
                <item.Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                {collapsed && badge ? (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-400 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                    {badge > 9 ? '9+' : badge}
                  </span>
                ) : null}
              </div>
              {!collapsed && (
                <>
                  <span className="flex-1">{item.label}</span>
                  {badge ? (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'}`}>
                      {badge}
                    </span>
                  ) : null}
                </>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      {collapsed ? (
        <div className="px-2 py-4 border-t border-slate-100 flex flex-col items-center gap-2">
          <a href="/api/auth/logout" title="Sair" className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
            <IconLogout className="w-4 h-4" />
          </a>
          {onToggle && (
            <button onClick={onToggle} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
              <IconChevron className="w-4 h-4" collapsed={collapsed} />
            </button>
          )}
        </div>
      ) : (
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
      )}
    </aside>
  );
}
