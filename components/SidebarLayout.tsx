'use client';
import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';

export default function SidebarLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved !== null) setCollapsed(saved === 'true');
  }, []);

  const toggle = () => {
    setCollapsed(v => {
      localStorage.setItem('sidebar-collapsed', String(!v));
      return !v;
    });
  };

  return (
    <>
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <main className={`flex-1 p-8 transition-all duration-200 ${collapsed ? 'ml-16' : 'ml-64'}`}>
        {children}
      </main>
    </>
  );
}
