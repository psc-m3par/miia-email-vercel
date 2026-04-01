import { NextResponse } from 'next/server';
import { readPainel, readContatos, writeSheet, appendLog, getAllSpreadsheetIds, FUP_CONFIG, anyFupIncludes } from '@/lib/sheets';
import { checkReplies } from '@/lib/gmail';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST() {
  const allIds = getAllSpreadsheetIds();
  const deadline = Date.now() + 270_000;
  let totalCorrigidos = 0;
  let totalVerificados = 0;

  try {
    for (const spreadsheetId of allIds) {
      const [painel, { contacts }] = await Promise.all([
        readPainel(spreadsheetId),
        readContatos(spreadsheetId),
      ]);

      // Build category -> responsavel map
      const catMap = new Map<string, string>();
      for (const cat of painel) {
        catMap.set(cat.category.normalize('NFC'), cat.responsavel);
      }

      // Find all contacts marked as RESPONDIDO that have a threadId
      const respondidos = contacts.filter(c =>
        c.threadId && anyFupIncludes(c, 'RESPONDIDO')
      );

      for (const contato of respondidos) {
        if (Date.now() > deadline) break;

        const responsavel = catMap.get(contato.category.normalize('NFC'));
        if (!responsavel) continue;

        let result;
        try {
          result = await checkReplies(responsavel, contato.threadId, spreadsheetId);
        } catch {
          continue;
        }

        totalVerificados++;

        // If re-check detects it's actually a bounce, fix it
        if (result.hasReply && result.isBounce) {
          // Find all FUP columns with RESPONDIDO and write BOUNCE
          const respondidoFups = FUP_CONFIG.filter(f =>
            (contato[f.curField] || '').includes('RESPONDIDO')
          );

          for (const f of respondidoFups) {
            await writeSheet(
              `Contatos!${f.col}${contato.rowIndex}`,
              [['BOUNCE']],
              spreadsheetId
            );
          }

          if (respondidoFups.length > 0) {
            totalCorrigidos++;
            // Longer pause after writes to avoid Sheets quota
            await new Promise(r => setTimeout(r, 1500));
          }
        } else {
          await new Promise(r => setTimeout(r, 200));
        }
      }

      await appendLog('Recheck Respondidos', 'TODOS', totalCorrigidos, 'ok',
        `${totalCorrigidos} corrigidos de ${totalVerificados} verificados (total respondidos: ${respondidos.length})`,
        spreadsheetId);
    }

    return NextResponse.json({
      ok: true,
      corrigidos: totalCorrigidos,
      verificados: totalVerificados,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[recheck-respondidos]', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
