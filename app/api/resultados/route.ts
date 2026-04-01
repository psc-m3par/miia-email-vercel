import { NextResponse } from 'next/server';
import { readPainel, readContatos, getAllSpreadsheetIds, FUP_CONFIG, anyFupHasStatus } from '@/lib/sheets';

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
  fup3Enviados: number;
  fup4Enviados: number;
  fup5Enviados: number;
  fup6Enviados: number;
  fup7Enviados: number;
  fup8Enviados: number;
  fup9Enviados: number;
  fup10Enviados: number;
  respondidos: Respondido[];
  bounced: number;
  taxaRespostas: number;
  taxaConversao: number;
  isComplete: boolean;
  email1Pendentes: number;
  fup1Aguardando: number;
  fup2Aguardando: number;
  fup3Aguardando: number;
  fup4Aguardando: number;
  fup5Aguardando: number;
  fup6Aguardando: number;
  fup7Aguardando: number;
  fup8Aguardando: number;
  fup9Aguardando: number;
  fup10Aguardando: number;
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

      // Count enviados for each FUP
      const fupEnviados: Record<string, number> = {};
      for (const f of FUP_CONFIG) {
        fupEnviados[`fup${f.n}Enviados`] = catContacts.filter(c => (c[f.curField] || '').startsWith('OK')).length;
      }

      const respondidosList: Respondido[] = catContacts
        .filter(c => anyFupHasStatus(c, 'RESPONDIDO'))
        .map(c => ({
          nome: [c.firstName, c.lastName].filter(Boolean).join(' '),
          email: c.email,
          empresa: c.companyName,
          pipeline: c.pipeline || 'NOVO',
        }));

      const bounced = catContacts.filter(
        c =>
          c.email1Enviado.startsWith('BOUNCE') ||
          anyFupHasStatus(c, 'BOUNCE')
      ).length;

      const taxaRespostas = email1Enviados > 0 ? respondidosList.length / email1Enviados : 0;
      const conversoes = respondidosList.filter(r => r.pipeline === 'REUNIAO' || r.pipeline === 'GANHO').length;
      const taxaConversao = email1Enviados > 0 ? conversoes / email1Enviados : 0;

      // isComplete: no pending email1, and every contact either got fup10 sent (OK),
      // or got RESPONDIDO/BOUNCE at some stage
      const email1Pendentes = catContacts.filter(
        c => (!c.email1Enviado || c.email1Enviado.startsWith('ERRO')) && c.email
      ).length;

      // Count aguardando for each FUP
      const fupAguardando: Record<string, number> = {};
      for (const f of FUP_CONFIG) {
        fupAguardando[`fup${f.n}Aguardando`] = catContacts.filter(c => {
          const prev = (c[f.prevField] || '').toString();
          const cur = (c[f.curField] || '').toString();
          return prev.startsWith('OK') && !cur;
        }).length;
      }

      // isComplete: a contact is complete when fup10 has been sent (OK), or they got RESPONDIDO/BOUNCE at any stage
      const isComplete =
        totalContatos > 0 &&
        email1Pendentes === 0 &&
        email1Enviados > 0 &&
        catContacts.every(c => {
          // Not yet sent email1? Not complete
          if (!c.email1Enviado || c.email1Enviado.startsWith('ERRO')) return !c.email;
          // Bounced at email1
          if (c.email1Enviado.startsWith('BOUNCE')) return true;
          // Got RESPONDIDO or BOUNCE at any FUP stage
          if (anyFupHasStatus(c, 'RESPONDIDO') || anyFupHasStatus(c, 'BOUNCE')) return true;
          // fup10 sent OK
          if ((c.fup10Enviado || '').startsWith('OK')) return true;
          return false;
        });

      results.push({
        category: cat.category,
        totalContatos,
        email1Enviados,
        fup1Enviados: fupEnviados.fup1Enviados,
        fup2Enviados: fupEnviados.fup2Enviados,
        fup3Enviados: fupEnviados.fup3Enviados,
        fup4Enviados: fupEnviados.fup4Enviados,
        fup5Enviados: fupEnviados.fup5Enviados,
        fup6Enviados: fupEnviados.fup6Enviados,
        fup7Enviados: fupEnviados.fup7Enviados,
        fup8Enviados: fupEnviados.fup8Enviados,
        fup9Enviados: fupEnviados.fup9Enviados,
        fup10Enviados: fupEnviados.fup10Enviados,
        respondidos: respondidosList,
        bounced,
        taxaRespostas,
        taxaConversao,
        isComplete,
        email1Pendentes,
        fup1Aguardando: fupAguardando.fup1Aguardando,
        fup2Aguardando: fupAguardando.fup2Aguardando,
        fup3Aguardando: fupAguardando.fup3Aguardando,
        fup4Aguardando: fupAguardando.fup4Aguardando,
        fup5Aguardando: fupAguardando.fup5Aguardando,
        fup6Aguardando: fupAguardando.fup6Aguardando,
        fup7Aguardando: fupAguardando.fup7Aguardando,
        fup8Aguardando: fupAguardando.fup8Aguardando,
        fup9Aguardando: fupAguardando.fup9Aguardando,
        fup10Aguardando: fupAguardando.fup10Aguardando,
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
