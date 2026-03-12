import { NextRequest, NextResponse } from 'next/server';
import { readPainel, readContatos, writeSheet, getAllSpreadsheetIds, appendLog } from '@/lib/sheets';
import { checkReplies } from '@/lib/gmail';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_POR_RODADA = 20;

async function runCheckReplies(category?: string) {
  const allIds = getAllSpreadsheetIds();
  let totalRespondidos = 0;

  for (const spreadsheetId of allIds) {
    const [painel, { contacts }] = await Promise.all([
      readPainel(spreadsheetId),
      readContatos(spreadsheetId),
    ]);

    for (const cat of painel) {
      if (!category && !cat.ativo) continue;
      if (category && cat.category.normalize('NFC') !== category.normalize('NFC')) continue;

      const enviados = contacts.filter(c =>
        c.category.normalize('NFC') === cat.category.normalize('NFC') &&
        c.email1Enviado.startsWith('OK') &&
        c.threadId &&
        !c.fup1Enviado.includes('RESPONDIDO') &&
        !c.fup2Enviado.includes('RESPONDIDO')
      );

      // Limite por categoria (não global) para não estourar o timeout de 60s
      let processadosCat = 0;
      let respondidosCat = 0;

      for (const contato of enviados) {
        if (processadosCat >= MAX_POR_RODADA) break;

        const result = await checkReplies(cat.responsavel, contato.threadId, spreadsheetId);

        if (result.hasReply) {
          // Marca RESPONDIDO em todas as colunas pendentes (I e J)
          // para bloquear qualquer follow-up futuro
          if (!contato.fup1Enviado) {
            // Respondeu após Email 1 — marca FUP1 e FUP2 como RESPONDIDO
            await writeSheet(
              'Contatos!I' + contato.rowIndex + ':J' + contato.rowIndex,
              [['RESPONDIDO', 'RESPONDIDO']],
              spreadsheetId
            );
          } else if (contato.fup1Enviado.startsWith('OK') && !contato.fup2Enviado) {
            // Respondeu após FUP1 — marca FUP2 como RESPONDIDO
            await writeSheet(
              'Contatos!J' + contato.rowIndex,
              [['RESPONDIDO']],
              spreadsheetId
            );
          } else if (contato.fup2Enviado.startsWith('OK')) {
            // Respondeu após FUP2 — marca FUP2 como RESPONDIDO
            await writeSheet(
              'Contatos!J' + contato.rowIndex,
              [['RESPONDIDO']],
              spreadsheetId
            );
          }
          totalRespondidos++;
          respondidosCat++;
        }

        processadosCat++;
        await new Promise(r => setTimeout(r, 300));
      }

      if (respondidosCat > 0) {
        await appendLog('Check Replies', cat.category, respondidosCat, 'ok', `${respondidosCat} resposta(s) detectada(s)`, spreadsheetId);
      }
    }
  }

  return { ok: true, respondidos: totalRespondidos };
}

export async function GET() {
  const result = await runCheckReplies();
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await runCheckReplies(body.category);
    return NextResponse.json(result);
  } catch {
    const result = await runCheckReplies();
    return NextResponse.json(result);
  }
}
