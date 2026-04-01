import { NextResponse } from 'next/server';
import { readLogs, readPainel, readContatos, getAllSpreadsheetIds, FUP_CONFIG, anyFupHasStatus, anyFupIncludes } from '@/lib/sheets';

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

    // Build dynamic type for fupForecast
    const fupForecast: Record<string, any> = {};

    for (const cat of painel) {
      const catContacts = contacts.filter(c =>
        c.category.normalize('NFC') === cat.category.normalize('NFC')
      );

      const forecast: any = {};

      // Per-FUP forecast using FUP_CONFIG loop
      for (const f of FUP_CONFIG) {
        const diasKey = f.diasField as keyof typeof cat;
        const dias = (cat as any)[diasKey] || 3;

        const candidatos = catContacts.filter(c => {
          const prev = (c[f.prevField] || '').toString();
          const cur = (c[f.curField] || '').toString();
          return prev.startsWith('OK') && !cur && c.threadId;
        });

        let proximaData: string | null = null;
        let prontos = 0;

        for (const c of candidatos) {
          const prevVal = (c[f.prevField] || '').toString();
          const dataEnvio = prevVal.replace('OK ', '');
          const elegivel = new Date(new Date(dataEnvio).getTime() + dias * 86400000);
          if (elegivel <= hoje) {
            prontos++;
          } else if (!proximaData || elegivel.toISOString() < proximaData) {
            proximaData = elegivel.toISOString();
          }
        }

        forecast[`fup${f.n}Aguardando`] = candidatos.length;
        forecast[`fup${f.n}ProximaData`] = proximaData;
        forecast[`fup${f.n}Prontos`] = prontos;
      }

      // Contagens gerais para status
      const totalCat = catContacts.length;
      const email1Ok = catContacts.filter(c => c.email1Enviado.startsWith('OK')).length;
      const email1Pendentes = catContacts.filter(c => (!c.email1Enviado || c.email1Enviado.startsWith('ERRO')) && c.email).length;

      // Per-FUP Ok counts
      for (const f of FUP_CONFIG) {
        forecast[`fup${f.n}Ok`] = catContacts.filter(c => (c[f.curField] || '').startsWith('OK')).length;
        forecast[`fup${f.n}Respondido`] = catContacts.filter(c => (c[f.curField] || '') === 'RESPONDIDO').length;
      }

      const respondidos = catContacts.filter(c => anyFupHasStatus(c, 'RESPONDIDO')).length;
      const bounced = catContacts.filter(c =>
        c.email1Enviado.startsWith('BOUNCE') || anyFupHasStatus(c, 'BOUNCE')
      ).length;
      const checkReplyTargets = catContacts.filter(c =>
        c.email1Enviado.startsWith('OK') && c.threadId &&
        !anyFupIncludes(c, 'RESPONDIDO') &&
        !anyFupIncludes(c, 'BOUNCE')
      ).length;

      fupForecast[cat.category] = {
        ...forecast,
        totalCat,
        email1Ok,
        email1Pendentes,
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
