import { NextRequest, NextResponse } from 'next/server';
import { readPainel, readContatos, writeSheet, writePipeline, getAllSpreadsheetIds, appendLog, readTeses, updateTese, appendSheet } from '@/lib/sheets';
import { checkReplies, sendEmail, getReplyText } from '@/lib/gmail';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Previne notificações duplicadas na mesma execução do servidor
const notifiedContacts = new Set<string>();

async function runCheckReplies(category?: string) {
  const allIds = getAllSpreadsheetIds();
  let totalRespondidos = 0;
  const deadline = Date.now() + 270_000; // 270s (4.5min) para garantir que dá tempo de logar antes do timeout

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

    // Divide tempo igualmente entre categorias (250s disponível para processar)
    const timePerCat = activeCats.length > 0 ? Math.floor(250_000 / activeCats.length) : 0;

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
                // Só notifica se não notificou esse contato recentemente
                const notifKey = contato.email + '||' + contato.threadId;
                if (!notifiedContacts.has(notifKey)) {
                  notifiedContacts.add(notifKey);
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

  // ── Check Teses approval replies ──
  try {
    const teses = await readTeses(allIds[0]);
    const pendingTeses = teses.filter(t => (t.status === 'APROVACAO' || t.status === 'AJUSTE') && t.threadId && t.aprovador);

    for (const tese of pendingTeses) {
      if (Date.now() > deadline) break;

      try {
        // Use senderEmail (who actually sent), fallback to criadoPor, then aprovador
        const readerEmail = tese.senderEmail || tese.criadoPor || tese.aprovador;
        const replyResult = await checkReplies(readerEmail, tese.threadId, allIds[0]);
        if (!replyResult.hasReply) continue;

        // Get the actual reply text
        const replyText = await getReplyText(readerEmail, tese.threadId, allIds[0]);
        const replyLower = replyText.toLowerCase().trim();

        // Check if it's an approval
        const approvalWords = ['ok', 'aprovado', 'aprovada', 'sim', 'pode seguir', 'autorizado', 'autorizada', 'go ahead', 'approved'];
        const isApproval = approvalWords.some(w => {
          // Match if reply starts with the word or is just the word (with punctuation)
          const cleaned = replyLower.replace(/[!.,;:\s]+/g, ' ').trim();
          return cleaned === w || cleaned.startsWith(w + ' ') || cleaned.startsWith(w + '\n');
        });

        if (isApproval && tese.categoria) {
          // Auto-approve: create category + template
          await appendSheet('Painel!A:K', [[
            tese.categoria, tese.criadoPor || '', tese.nomeRemetente || '',
            20, 3, 7, 'FALSE', '', '', 8, 21,
          ]], allIds[0]);

          await appendSheet('Templates!A:G', [[
            tese.categoria,
            `Proposta para {{firstName}}`,
            tese.template || tese.tese,
            `Re: Proposta para {{firstName}}`,
            `Olá {{firstName}}, gostaria de retomar nosso contato.`,
            `Re: Proposta para {{firstName}}`,
            `{{firstName}}, esta é nossa última tentativa de contato.`,
          ]], allIds[0]);

          await updateTese(tese.rowIndex, {
            status: 'APROVADA',
            comentarios: [...tese.comentarios, {
              autor: tese.aprovador,
              texto: `Aprovado automaticamente. Resposta: "${replyText.slice(0, 100)}"`,
              timestamp: new Date().toISOString(),
            }],
          }, allIds[0]);

          await appendLog('Check Replies', 'Teses', 1, 'ok',
            `Tese "${tese.categoria}" aprovada automaticamente por ${tese.aprovador}`, allIds[0]);
        } else {
          // It's an adjustment comment — mark as AJUSTE so it's not re-processed
          await updateTese(tese.rowIndex, {
            status: 'AJUSTE',
            comentarios: [...tese.comentarios, {
              autor: tese.aprovador,
              texto: replyText.slice(0, 500) || '(resposta sem texto)',
              timestamp: new Date().toISOString(),
            }],
          }, allIds[0]);

          await appendLog('Check Replies', 'Teses', 0, 'ok',
            `Comentário do aprovador em "${tese.categoria}": ${replyText.slice(0, 80)}`, allIds[0]);
        }
      } catch { /* skip individual tese errors */ }
    }
  } catch { /* skip teses check errors */ }

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
