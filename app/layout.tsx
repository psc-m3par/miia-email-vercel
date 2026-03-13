import './globals.css';
import type { Metadata } from 'next';
import SidebarLayout from '@/components/SidebarLayout';

export const metadata: Metadata = {
  title: 'MIIA Email Automation',
  description: 'Sistema de automação de emails da MIIA',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="flex min-h-screen bg-slate-50">
        <SidebarLayout>{children}</SidebarLayout>
      </body>
    </html>
  );
}
