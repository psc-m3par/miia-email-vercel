import { NextResponse } from 'next/server';
import { readLogs, readPainel, readContatos, getAllSpreadsheetIds } from '@/lib/sheets';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const allIds = getAllSpreadsheetIds();
    const spreadsheetId = allIds[0];
    const [logs, painel, { contacts }] = await Promise.all([
      readLogs(spreadsheetId, 1000),
      readPainel(spreadsheetId),
      readContatos(spreadsheetId),
    ]);

    const hoje = new Date();

    // Previsão de FUPs por categoria
    const fupForecast: Record<string, {
      fup1Aguardando: number;
      fup1ProximaData: string | null;
      fup1Prontos: number;
      fup2Aguardando: number;
      fup2ProximaData: string | null;
      fup2Prontos: number;
    }> = {};

    for (const cat of painel) {
      const catContacts = contacts.filter(c =>
        c.category.normalize('NFC') === cat.category.normalize('NFC')
      );

      // FUP1: contatos com OK email1, sem fup1, com thread
      const candidatosFup1 = catContacts.filter(c =>
        c.email1Enviado.startsWith('OK') && !c.fup1Enviado && c.threadId
      );
      const diasFup1 = cat.diasFup1 || 3;
      let fup1ProximaData: string | null = null;
      let fup1Prontos = 0;

      for (const c of candidatosFup1) {
        const dataEnvio = c.email1Enviado.replace('OK ', '');
        const elegivel = new Date(new Date(dataEnvio).getTime() + diasFup1 * 86400000);
        if (elegivel <= hoje) {
          fup1Prontos++;
        } else if (!fup1ProximaData || elegivel.toISOString() < fup1ProximaData) {
          fup1ProximaData = elegivel.toISOString();
        }
      }

      // FUP2: contatos com OK fup1, sem fup2, com thread, sem RESPONDIDO
      const candidatosFup2 = catContacts.filter(c =>
        c.fup1Enviado.startsWith('OK') && !c.fup2Enviado && c.threadId &&
        !c.fup1Enviado.includes('RESPONDIDO')
      );
      const diasFup2 = cat.diasFup2 || 7;
      let fup2ProximaData: string | null = null;
      let fup2Prontos = 0;

      for (const c of candidatosFup2) {
        const dataFup1 = c.fup1Enviado.replace('OK ', '');
        const elegivel = new Date(new Date(dataFup1).getTime() + diasFup2 * 86400000);
        if (elegivel <= hoje) {
          fup2Prontos++;
        } else if (!fup2ProximaData || elegivel.toISOString() < fup2ProximaData) {
          fup2ProximaData = elegivel.toISOString();
        }
      }

      fupForecast[cat.category] = {
        fup1Aguardando: candidatosFup1.length,
        fup1ProximaData,
        fup1Prontos,
        fup2Aguardando: candidatosFup2.length,
        fup2ProximaData,
        fup2Prontos,
      };
    }

    return NextResponse.json({ logs, fupForecast }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
