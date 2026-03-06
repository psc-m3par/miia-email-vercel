import { NextRequest, NextResponse } from 'next/server';
import { readPainel, readTemplates, readContatos, writeSheet, getAllSpreadsheetIds } from '@/lib/sheets';
import { sendReply } from '@/lib/gmail';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const allIds = getAllSpreadsheetIds();
    let totalFups = 0;

    for (const spreadsheetId of allIds) {
      const [painel, templates, { contacts }] = await Promise.all([
        readPainel(spreadsheetId),
        readTemplates(spreadsheetId),
        readContatos(spreadsheetId),
      ]);

      for (const cat of painel) {
        if (!cat.ativo) continue;

        const template = templates.find(t => t.category === cat.category);
        if (!template) continue;

        const hoje = new Date();

        // FUP1
        const prontosFup1 = contacts.filter(c => {
          if (c.category !== cat.category) return false;
          if (!c.email1Enviado.startsWith('OK')) return false;
          if (c.fup1Enviado) return false;
          if (!c.threadId) return false;
          const dataEnvio = c.email1Enviado.replace('OK ', '');
          const diff = Math.floor((hoje.getTime() - new Date(dataEnvio).getTime()) / 86400000);
          return diff >= cat.diasFup1;
        });

        for (const contato of prontosFup1) {
          const assunto = (template.fup1Assunto || template.assunto)
            .replace(/\{firstName\}/gi, contato.firstName)
            .replace(/\{lastName\}/gi, contato.lastName)
            .replace(/\{companyName\}/gi, contato.companyName);

          const corpo = template.fup1Corpo
            .replace(/\{firstName\}/gi, contato.firstName)
            .replace(/\{lastName\}/gi, contato.lastName)
            .replace(/\{companyName\}/gi, contato.companyName);

          const result = await sendReply(
            cat.responsavel, contato.email, assunto, corpo,
            contato.threadId, contato.threadId,
            cat.cc, spreadsheetId
          );

          const hojeStr = hoje.toISOString().split('T')[0];
          await writeSheet(
            `Contatos!I${contato.rowIndex}`,
            [[result.success ? `OK ${hojeStr}` : `ERRO ${hojeStr}: ${result.error}`]],
            spreadsheetId
          );
          if (result.success) totalFups++;
          await new Promise(r => setTimeout(r, 2000));
        }

        // FUP2
        const prontosFup2 = contacts.filter(c => {
          if (c.category !== cat.category) return false;
          if (!c.fup1Enviado.startsWith('OK')) return false;
          if (c.fup2Enviado) return false;
          if (!c.threadId) return false;
          if (c.fup1Enviado.includes('RESPONDIDO')) return false;
          const dataFup1 = c.fup1Enviado.replace('OK ', '');
          const diff = Math.floor((hoje.getTime() - new Date(dataFup1).getTime()) / 86400000);
          return diff >= cat.diasFup2;
        });

        for (const contato of prontosFup2) {
          const assunto = (template.fup2Assunto || template.assunto)
            .replace(/\{firstName\}/gi, contato.firstName)
            .replace(/\{lastName\}/gi, contato.lastName)
            .replace(/\{companyName\}/gi, contato.companyName);

          const corpo = template.fup2Corpo
            .replace(/\{firstName\}/gi, contato.firstName)
            .replace(/\{lastName\}/gi, contato.lastName)
            .replace(/\{companyName\}/gi, contato.companyName);

          const result = await sendReply(
            cat.responsavel, contato.email, assunto, corpo,
            contato.threadId, contato.threadId,
            cat.cc, spreadsheetId
          );

          const hojeStr = hoje.toISOString().split('T')[0];
          await writeSheet(
            `Contatos!J${contato.rowIndex}`,
            [[result.success ? `OK ${hojeStr}` : `ERRO ${hojeStr}: ${result.error}`]],
            spreadsheetId
          );
          if (result.success) totalFups++;
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    }

    return NextResponse.json({ ok: true, fups: totalFups });
  } catch (error: any) {
    console.error('Send FUPs error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}