import { NextRequest, NextResponse } from 'next/server';
import { readPainel, readTemplates, readContatos, writeSheet, getAllSpreadsheetIds, appendLog } from '@/lib/sheets';
import { sendReply, checkReplies } from '@/lib/gmail';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;


async function runSendFups(category?: string, force = false) {
  const allIds = getAllSpreadsheetIds();
  let totalFups = 0;
  const pulados: string[] = [];

  for (const spreadsheetId of allIds) {
    const [painel, templates, { contacts }] = await Promise.all([
      readPainel(spreadsheetId),
      readTemplates(spreadsheetId),
      readContatos(spreadsheetId),
    ]);

    for (const cat of painel) {
      if (!cat.ativo) continue;
      if (category && cat.category.normalize('NFC') !== category.normalize('NFC')) continue;

      // Janela de horário: só roda entre horaInicio e horaFim (hora local de Brasília)
      if (!force) {
        const horaBrasilia = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hour12: false });
        const horaAtual = parseInt(horaBrasilia);
        if (horaAtual < cat.horaInicio || horaAtual >= cat.horaFim) {
          pulados.push(`"${cat.category}" fora da janela (${cat.horaInicio}h-${cat.horaFim}h, agora ${horaAtual}h)`);
          continue;
        }
      }

      const limite = cat.emailsHora || 20;

      const template = templates.find(t => t.category.normalize('NFC') === cat.category.normalize('NFC'));
      if (!template) continue;

      const pendentes = contacts.filter(c =>
        c.category.normalize('NFC') === cat.category.normalize('NFC') &&
        !c.email1Enviado &&
        c.email
      );
      if (pendentes.length > 0) continue;

      const hoje = new Date();
      const hojeSpDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(hoje);
      let enviadosCat = 0;

      const prontosFup1 = contacts.filter(c => {
        if (c.category.normalize('NFC') !== cat.category.normalize('NFC')) return false;
        if (!c.email1Enviado.startsWith('OK')) return false;
        if (c.fup1Enviado) return false;
        if (!c.threadId) return false;
        const dataEnvio = c.email1Enviado.replace('OK ', '');
        const diffDias = Math.floor((hoje.getTime() - new Date(dataEnvio).getTime()) / 86400000);
        return diffDias >= (cat.diasFup1 || 3);
      });

      const prontosFup2 = contacts.filter(c => {
        if (c.category.normalize('NFC') !== cat.category.normalize('NFC')) return false;
        if (!c.fup1Enviado.startsWith('OK')) return false;
        if (c.fup2Enviado) return false;
        if (!c.threadId) return false;
        if (c.fup1Enviado.includes('RESPONDIDO')) return false;
        const dataFup1 = c.fup1Enviado.replace('OK ', '');
        const diffDias = Math.floor((hoje.getTime() - new Date(dataFup1).getTime()) / 86400000);
        return diffDias >= (cat.diasFup2 || 7);
      });

      if (prontosFup1.length === 0 && prontosFup2.length === 0) continue;

      for (const contato of prontosFup1) {
        if (enviadosCat >= limite) break;

        const replyCheck = await checkReplies(cat.responsavel, contato.threadId, spreadsheetId);
        if (replyCheck.hasReply) {
          await writeSheet(
            'Contatos!I' + contato.rowIndex + ':J' + contato.rowIndex,
            [['RESPONDIDO', 'RESPONDIDO']],
            spreadsheetId
          );
          continue;
        }

        const assunto = (template.fup1Assunto || template.assunto)
          .replace(/\{firstName\}|\[First Name\]/gi, contato.firstName)
          .replace(/\{lastName\}|\[Last Name\]/gi, contato.lastName)
          .replace(/\{companyName\}|\[Company\]/gi, contato.companyName)
          .replace(/\[Sender Name\]/gi, cat.nomeRemetente)
          .replace(/\[Category\]/gi, cat.category)
          .replace(/\r?\n/g, ' ').trim();

        const corpoFup1Raw = template.fup1Corpo
          .replace(/\{firstName\}|\[First Name\]/gi, contato.firstName)
          .replace(/\{lastName\}|\[Last Name\]/gi, contato.lastName)
          .replace(/\{companyName\}|\[Company\]/gi, contato.companyName)
          .replace(/\[Sender Name\]/gi, cat.nomeRemetente)
          .replace(/\[Category\]/gi, cat.category);
        const htmlBodyFup1 = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6"><p>${corpoFup1Raw.replace(/\r\n/g, '\n').replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br>')}</p></div>`;

        const result = await sendReply(
          cat.responsavel, contato.email, assunto, htmlBodyFup1,
          contato.threadId, contato.threadId,
          cat.cc, spreadsheetId, cat.nomeRemetente
        );

        const hojeStr = hojeSpDate;
        await writeSheet(
          'Contatos!I' + contato.rowIndex,
          [[result.success ? 'OK ' + hojeStr : 'ERRO ' + hojeStr + ': ' + result.error]],
          spreadsheetId
        );
        if (result.success) { totalFups++; enviadosCat++; }
        await new Promise(r => setTimeout(r, 500));
      }

      for (const contato of prontosFup2) {
        if (enviadosCat >= limite) break;

        const replyCheck2 = await checkReplies(cat.responsavel, contato.threadId, spreadsheetId);
        if (replyCheck2.hasReply) {
          await writeSheet(
            'Contatos!J' + contato.rowIndex,
            [['RESPONDIDO']],
            spreadsheetId
          );
          continue;
        }

        const assunto = (template.fup2Assunto || template.assunto)
          .replace(/\{firstName\}|\[First Name\]/gi, contato.firstName)
          .replace(/\{lastName\}|\[Last Name\]/gi, contato.lastName)
          .replace(/\{companyName\}|\[Company\]/gi, contato.companyName)
          .replace(/\[Sender Name\]/gi, cat.nomeRemetente)
          .replace(/\[Category\]/gi, cat.category)
          .replace(/\r?\n/g, ' ').trim();

        const corpoFup2Raw = template.fup2Corpo
          .replace(/\{firstName\}|\[First Name\]/gi, contato.firstName)
          .replace(/\{lastName\}|\[Last Name\]/gi, contato.lastName)
          .replace(/\{companyName\}|\[Company\]/gi, contato.companyName)
          .replace(/\[Sender Name\]/gi, cat.nomeRemetente)
          .replace(/\[Category\]/gi, cat.category);
        const htmlBodyFup2 = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6"><p>${corpoFup2Raw.replace(/\r\n/g, '\n').replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br>')}</p></div>`;

        const result = await sendReply(
          cat.responsavel, contato.email, assunto, htmlBodyFup2,
          contato.threadId, contato.threadId,
          cat.cc, spreadsheetId, cat.nomeRemetente
        );

        const hojeStr = hojeSpDate;
        await writeSheet(
          'Contatos!J' + contato.rowIndex,
          [[result.success ? 'OK ' + hojeStr : 'ERRO ' + hojeStr + ': ' + result.error]],
          spreadsheetId
        );
        if (result.success) { totalFups++; enviadosCat++; }
        await new Promise(r => setTimeout(r, 500));
      }

      if (enviadosCat > 0) {
        const fup1Sent = prontosFup1.filter((_: any, i: number) => i < enviadosCat).length;
        const fup2Sent = enviadosCat - fup1Sent;
        if (fup1Sent > 0) await appendLog('FUP1', cat.category, fup1Sent, 'ok', `${fup1Sent} FUP1s enviados`, spreadsheetId);
        if (fup2Sent > 0) await appendLog('FUP2', cat.category, fup2Sent, 'ok', `${fup2Sent} FUP2s enviados`, spreadsheetId);
      }
    }
  }

  return { ok: true, fups: totalFups, pulados };
}

export async function GET() {
  const result = await runSendFups();
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await runSendFups(body.category, true);
    return NextResponse.json(result);
  } catch {
    const result = await runSendFups(undefined, true);
    return NextResponse.json(result);
  }
}
