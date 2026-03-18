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
      totalCat: number;
      email1Ok: number;
      email1Pendentes: number;
      fup1Ok: number;
      fup1Respondido: number;
      fup2Ok: number;
      respondidos: number;
      bounced: number;
      checkReplyTargets: number;
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

      // Contagens gerais para status
      const totalCat = catContacts.length;
      const email1Ok = catContacts.filter(c => c.email1Enviado.startsWith('OK')).length;
      const email1Bounce = catContacts.filter(c => c.email1Enviado.startsWith('BOUNCE')).length;
      const email1Pendentes = catContacts.filter(c => (!c.email1Enviado || c.email1Enviado.startsWith('ERRO')) && c.email).length;
      const fup1Ok = catContacts.filter(c => c.fup1Enviado.startsWith('OK')).length;
      const fup1Respondido = catContacts.filter(c => c.fup1Enviado === 'RESPONDIDO').length;
      const fup2Ok = catContacts.filter(c => c.fup2Enviado.startsWith('OK')).length;
      const fup2Respondido = catContacts.filter(c => c.fup2Enviado === 'RESPONDIDO').length;
      const respondidos = catContacts.filter(c => c.fup1Enviado === 'RESPONDIDO' || c.fup2Enviado === 'RESPONDIDO').length;
      const bounced = catContacts.filter(c => c.email1Enviado.startsWith('BOUNCE') || c.fup1Enviado === 'BOUNCE' || c.fup2Enviado === 'BOUNCE').length;
      const checkReplyTargets = catContacts.filter(c =>
        c.email1Enviado.startsWith('OK') && c.threadId &&
        !c.fup1Enviado.includes('RESPONDIDO') && !c.fup2Enviado.includes('RESPONDIDO') &&
        !c.fup1Enviado.includes('BOUNCE') && !c.fup2Enviado.includes('BOUNCE')
      ).length;

      fupForecast[cat.category] = {
        fup1Aguardando: candidatosFup1.length,
        fup1ProximaData,
        fup1Prontos,
        fup2Aguardando: candidatosFup2.length,
        fup2ProximaData,
        fup2Prontos,
        // Extra stats for monitor status
        totalCat,
        email1Ok,
        email1Pendentes,
        fup1Ok,
        fup1Respondido,
        fup2Ok,
        respondidos,
        bounced,
        checkReplyTargets,
      };
    }

    return NextResponse.json({ logs, fupForecast }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
