import { NextRequest, NextResponse } from 'next/server';
import { readPainel, readTemplates, readContatos, writeSheet, getAllSpreadsheetIds, appendLog } from '@/lib/sheets';
import { sendEmail } from '@/lib/gmail';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MINUTOS_ENTRE_LOTES = 55;

async function runSendEmails(category?: string, force = false) {
  const allIds = getAllSpreadsheetIds();
  let totalEnviados = 0;
  let erros: string[] = [];
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

      // Rate limiting: skip if last send was less than 55 minutes ago (cron protection)
      if (!force && cat.ultimoEnvio) {
        const minutosSinceLastSend = (Date.now() - new Date(cat.ultimoEnvio).getTime()) / 60000;
        if (minutosSinceLastSend < MINUTOS_ENTRE_LOTES) {
          const proxEnvio = Math.ceil(MINUTOS_ENTRE_LOTES - minutosSinceLastSend);
          pulados.push(`"${cat.category}" aguardando ${proxEnvio}min para próximo lote`);
          continue;
        }
      }

      const template = templates.find(t => t.category.normalize('NFC') === cat.category.normalize('NFC'));
      if (!template) continue;

      const pendentes = contacts.filter(c =>
        c.category.normalize('NFC') === cat.category.normalize('NFC') && !c.email1Enviado && c.email
      );

      const lote = pendentes.slice(0, cat.emailsHora || 20);
      if (lote.length === 0) continue;
      let enviadosCat = 0;
      let errosCat = 0;

      // Grava ultimoEnvio ANTES do loop para bloquear chamadas concorrentes imediatamente
      await writeSheet('Painel!I' + cat.rowIndex, [[new Date().toISOString()]], spreadsheetId);

      for (const contato of lote) {
        const assunto = template.assunto
          .replace(/\{firstName\}|\[First Name\]/gi, contato.firstName)
          .replace(/\{lastName\}|\[Last Name\]/gi, contato.lastName)
          .replace(/\{companyName\}|\[Company\]/gi, contato.companyName)
          .replace(/\[Sender Name\]/gi, cat.nomeRemetente)
          .replace(/\[Category\]/gi, cat.category)
          .replace(/\r?\n/g, ' ').trim();

        const corpoRaw = template.corpo
          .replace(/\{firstName\}|\[First Name\]/gi, contato.firstName)
          .replace(/\{lastName\}|\[Last Name\]/gi, contato.lastName)
          .replace(/\{companyName\}|\[Company\]/gi, contato.companyName)
          .replace(/\[Sender Name\]/gi, cat.nomeRemetente)
          .replace(/\[Category\]/gi, cat.category);
        const corpo = corpoRaw
          .replace(/\r\n/g, '\n')
          .replace(/\n\n+/g, '</p><p>')
          .replace(/\n/g, '<br>');
        const htmlBody = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6"><p>${corpo}</p></div>`;

        const result = await sendEmail(
          cat.responsavel,
          contato.email,
          assunto,
          htmlBody,
          cat.cc,
          spreadsheetId,
          cat.nomeRemetente
        );

        const hoje = new Date().toISOString().split('T')[0];

        if (result.success) {
          await writeSheet(
            'Contatos!H' + contato.rowIndex + ':K' + contato.rowIndex,
            [['OK ' + hoje, '', '', result.threadId || '']],
            spreadsheetId
          );
          totalEnviados++;
        } else {
          await writeSheet(
            'Contatos!H' + contato.rowIndex,
            [['ERRO ' + hoje + ': ' + result.error]],
            spreadsheetId
          );
          erros.push(contato.email + ': ' + result.error);
          errosCat++;
        }

        await new Promise(r => setTimeout(r, 500));
        if (result.success) enviadosCat++;
      }

      if (enviadosCat > 0) {
        await appendLog('Email 1', cat.category, enviadosCat, 'ok', `${enviadosCat} emails enviados (${pendentes.length - enviadosCat} restantes)`, spreadsheetId);
      }
      if (errosCat > 0) {
        await appendLog('Email 1', cat.category, errosCat, 'erro', `${errosCat} falhas: ${erros.slice(-errosCat).join('; ')}`, spreadsheetId);
      }
    }
  }

  return { ok: true, enviados: totalEnviados, erros, pulados };
}

export async function GET(req: NextRequest) {
  const result = await runSendEmails(undefined, false);
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // Manual "Enviar Agora" button always forces send (bypasses rate limit)
    const result = await runSendEmails(body.category, true);
    return NextResponse.json(result);
  } catch {
    const result = await runSendEmails(undefined, true);
    return NextResponse.json(result);
  }
}