import { NextRequest, NextResponse } from 'next/server';
import { readPainel, readContatos, writeSheet, writePipeline, getAllSpreadsheetIds, appendLog } from '@/lib/sheets';
import { checkReplies, sendEmail } from '@/lib/gmail';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function runCheckReplies(category?: string) {
  const allIds = getAllSpreadsheetIds();
  let totalRespondidos = 0;
  const deadline = Date.now() + 45_000; // 45s para garantir que dá tempo de logar antes do timeout

  for (const spreadsheetId of allIds) {
    const [painel, { contacts }] = await Promise.all([
      readPainel(spreadsheetId),
      readContatos(spreadsheetId),
    ]);

    // Filtra categorias ativas
    const activeCats = painel.filter(c => {
      if (!category && !c.ativo) return false;
      if (category && c.category.normalize('NFC') !== category.normalize('NFC')) return false;
      return true;
    });

    // Divide tempo igualmente entre categorias
    const timePerCat = activeCats.length > 0 ? Math.floor(40_000 / activeCats.length) : 0;

    for (const cat of activeCats) {
      const catDeadline = Math.min(Date.now() + timePerCat, deadline);

      const enviados = contacts.filter(c =>
        c.category.normalize('NFC') === cat.category.normalize('NFC') &&
        c.email1Enviado.startsWith('OK') &&
        c.threadId &&
        !c.fup1Enviado.includes('RESPONDIDO') &&
        !c.fup2Enviado.includes('RESPONDIDO') &&
        !c.fup1Enviado.includes('BOUNCE') &&
        !c.fup2Enviado.includes('BOUNCE')
      );

      let respondidosCat = 0;
      let verificados = 0;
      const deadlineHit = Date.now() > deadline;

      if (!deadlineHit) {
        for (const contato of enviados) {
          if (Date.now() > catDeadline) break;
          verificados++;
          let result: { hasReply: boolean; isBounce?: boolean; isUnsubscribe?: boolean; error?: string };
          try {
            result = await checkReplies(cat.responsavel, contato.threadId, spreadsheetId);
          } catch {
            continue;
          }

          if (result.hasReply) {
            const marcador = result.isBounce ? 'BOUNCE' : 'RESPONDIDO';
            const isBlacklist = !result.isBounce && result.isUnsubscribe;

            if (!contato.fup1Enviado) {
              await writeSheet(
                'Contatos!I' + contato.rowIndex + ':J' + contato.rowIndex,
                [[marcador, marcador]],
                spreadsheetId
              );
            } else if (contato.fup1Enviado.startsWith('OK') && !contato.fup2Enviado) {
              await writeSheet(
                'Contatos!J' + contato.rowIndex,
                [[marcador]],
                spreadsheetId
              );
            } else if (contato.fup2Enviado.startsWith('OK')) {
              await writeSheet(
                'Contatos!J' + contato.rowIndex,
                [[marcador]],
                spreadsheetId
              );
            }

            if (!result.isBounce) {
              if (isBlacklist) {
                await writePipeline(contato.rowIndex, 'PERDIDO', spreadsheetId);
                await appendLog('Check Replies', cat.category, 0, 'ok',
                  `Blacklist: ${contato.email} pediu remoção`, spreadsheetId);
              } else {
                totalRespondidos++;
                respondidosCat++;
                const nome = [contato.firstName, contato.lastName].filter(Boolean).join(' ') || contato.email;
                const empresa = contato.companyName ? ` · ${contato.companyName}` : '';
                await sendEmail(
                  cat.responsavel,
                  cat.responsavel,
                  `Nova resposta: ${nome}${empresa}`,
                  `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#333">
                    <p><strong>${nome}</strong> respondeu ao seu email de prospecção.</p>
                    <p><strong>Empresa:</strong> ${contato.companyName || '—'}<br>
                    <strong>Email:</strong> ${contato.email}<br>
                    <strong>Categoria:</strong> ${cat.category}</p>
                    <p><a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://miia-email-frontend.vercel.app'}/chats" style="background:#6366f1;color:white;padding:8px 16px;border-radius:8px;text-decoration:none;font-weight:600">Ver conversa →</a></p>
                  </div>`,
                  undefined,
                  spreadsheetId
                ).catch(() => {});
              }
            }
          }

          await new Promise(r => setTimeout(r, 100));
        }
      }

      await appendLog('Check Replies', cat.category, respondidosCat, 'ok',
        respondidosCat > 0
          ? `${respondidosCat} resposta(s) detectada(s)`
          : `${verificados}/${enviados.length} verificados${deadlineHit ? ' (timeout)' : ''}`,
        spreadsheetId);
    }
  }

  return { ok: true, respondidos: totalRespondidos };
}

export async function GET() {
  try {
    const result = await runCheckReplies();
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[check-replies GET]', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = await runCheckReplies(body.category);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
