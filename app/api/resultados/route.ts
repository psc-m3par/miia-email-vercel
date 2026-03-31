import { NextResponse } from 'next/server';
import { readPainel, readContatos, getAllSpreadsheetIds } from '@/lib/sheets';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Respondido {
  nome: string;
  email: string;
  empresa: string;
  pipeline: string;
}

interface CategoryResult {
  category: string;
  totalContatos: number;
  email1Enviados: number;
  fup1Enviados: number;
  fup2Enviados: number;
  respondidos: Respondido[];
  bounced: number;
  taxaRespostas: number;
  taxaConversao: number;
  isComplete: boolean;
  email1Pendentes: number;
  fup1Aguardando: number;
  fup2Aguardando: number;
}

export async function GET() {
  try {
    const allIds = getAllSpreadsheetIds();
    const spreadsheetId = allIds[0];
    const [painel, { contacts }] = await Promise.all([
      readPainel(spreadsheetId),
      readContatos(spreadsheetId),
    ]);

    const results: CategoryResult[] = [];

    for (const cat of painel) {
      const catContacts = contacts.filter(
        c => c.category.normalize('NFC') === cat.category.normalize('NFC')
      );

      const totalContatos = catContacts.length;
      const email1Enviados = catContacts.filter(c => c.email1Enviado.startsWith('OK')).length;
      const fup1Enviados = catContacts.filter(c => c.fup1Enviado.startsWith('OK')).length;
      const fup2Enviados = catContacts.filter(c => c.fup2Enviado.startsWith('OK')).length;

      const respondidosList: Respondido[] = catContacts
        .filter(c => c.fup1Enviado === 'RESPONDIDO' || c.fup2Enviado === 'RESPONDIDO')
        .map(c => ({
          nome: [c.firstName, c.lastName].filter(Boolean).join(' '),
          email: c.email,
          empresa: c.companyName,
          pipeline: c.pipeline || 'NOVO',
        }));

      const bounced = catContacts.filter(
        c =>
          c.email1Enviado.startsWith('BOUNCE') ||
          c.fup1Enviado === 'BOUNCE' ||
          c.fup2Enviado === 'BOUNCE'
      ).length;

      const taxaRespostas = email1Enviados > 0 ? respondidosList.length / email1Enviados : 0;
      const conversoes = respondidosList.filter(r => r.pipeline === 'REUNIAO' || r.pipeline === 'GANHO').length;
      const taxaConversao = email1Enviados > 0 ? conversoes / email1Enviados : 0;

      // isComplete: no pending email1, no pending fup1, no pending fup2
      const email1Pendentes = catContacts.filter(
        c => (!c.email1Enviado || c.email1Enviado.startsWith('ERRO')) && c.email
      ).length;

      const fup1Aguardando = catContacts.filter(
        c =>
          c.email1Enviado.startsWith('OK') &&
          !c.fup1Enviado
      ).length;

      const fup2Aguardando = catContacts.filter(
        c =>
          c.fup1Enviado.startsWith('OK') &&
          !c.fup2Enviado &&
          c.fup1Enviado !== 'RESPONDIDO'
      ).length;

      // Count contacts that had their fup1 resolved (OK, RESPONDIDO, or BOUNCE)
      const fup1Resolvidos = catContacts.filter(c =>
        c.fup1Enviado.startsWith('OK') || c.fup1Enviado === 'RESPONDIDO' || c.fup1Enviado === 'BOUNCE'
      ).length;
      const fup2Resolvidos = catContacts.filter(c =>
        c.fup2Enviado.startsWith('OK') || c.fup2Enviado === 'RESPONDIDO' || c.fup2Enviado === 'BOUNCE'
      ).length;

      // Contacts that need fup1: had E1 OK but no bounce on E1
      const needFup1 = catContacts.filter(c =>
        c.email1Enviado.startsWith('OK') && !c.email1Enviado.startsWith('BOUNCE')
      ).length;
      // Contacts that need fup2: had FUP1 OK (not RESPONDIDO/BOUNCE at fup1 stage)
      const needFup2 = fup1Enviados;

      const isComplete =
        totalContatos > 0 &&
        email1Pendentes === 0 &&
        email1Enviados > 0 &&
        fup1Resolvidos >= needFup1 &&
        fup2Resolvidos >= needFup2;

      results.push({
        category: cat.category,
        totalContatos,
        email1Enviados,
        fup1Enviados,
        fup2Enviados,
        respondidos: respondidosList,
        bounced,
        taxaRespostas,
        taxaConversao,
        isComplete,
        email1Pendentes,
        fup1Aguardando,
        fup2Aguardando,
      });
    }

    return NextResponse.json({ results }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
