import { NextRequest, NextResponse } from 'next/server';
import { readPainel, readTemplates, readContatos, readSheet, writeSheet, getAllSpreadsheetIds, appendLog } from '@/lib/sheets';
import { sendReply, checkReplies } from '@/lib/gmail';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Previne execuções concorrentes
let lastRunTime = 0;
const MIN_INTERVAL = 55_000; // 55 segundos entre execuções

async function runSendFups(category?: string, force = false) {
  const now = Date.now();
  if (!force && now - lastRunTime < MIN_INTERVAL) {
    return { fups: 0, pulados: ['Aguardando intervalo mínimo entre execuções'] };
  }
  lastRunTime = now;
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
      if (!cat.ativo) {
        pulados.push(`"${cat.category}" inativo`);
        continue;
      }
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
      if (!template) {
        pulados.push(`"${cat.category}" sem template`);
        if (force) await appendLog('FUP1', cat.category, 0, 'erro', 'Template nao encontrado para categoria', spreadsheetId);
        continue;
      }

      const pendentes = contacts.filter(c =>
        c.category.normalize('NFC') === cat.category.normalize('NFC') &&
        (!c.email1Enviado || c.email1Enviado.startsWith('ERRO')) &&
        c.email
      );
      if (pendentes.length > 0) {
        pulados.push(`"${cat.category}" bloqueado: ${pendentes.length} pendente(s) de Email 1`);
        if (force) await appendLog('FUP1', cat.category, 0, 'ok', `Aguardando ${pendentes.length} pendente(s) de Email 1`, spreadsheetId);
        continue;
      }

      const hoje = new Date();
      const hojeSpDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(hoje);
      let enviadosCat = 0;

      // Diagnóstico detalhado para filtro de FUP1
      const catContacts = contacts.filter(c => c.category.normalize('NFC') === cat.category.normalize('NFC'));
      const comOk = catContacts.filter(c => c.email1Enviado.startsWith('OK'));
      const semFup1 = comOk.filter(c => !c.fup1Enviado);
      const comThread = semFup1.filter(c => c.threadId);
      const comDias = comThread.filter(c => {
        const dataEnvio = c.email1Enviado.replace('OK ', '');
        const diffDias = Math.floor((hoje.getTime() - new Date(dataEnvio).getTime()) / 86400000);
        return diffDias >= (cat.diasFup1 || 3);
      });

      const prontosFup1 = comDias;

      // Diagnóstico detalhado para filtro de FUP2
      const comFup1Ok = catContacts.filter(c => c.fup1Enviado.startsWith('OK'));
      const semFup2 = comFup1Ok.filter(c => !c.fup2Enviado);
      const semFup2ComThread = semFup2.filter(c => c.threadId);
      const semRespondido = semFup2ComThread.filter(c => !c.fup1Enviado.includes('RESPONDIDO'));
      const comDiasFup2 = semRespondido.filter(c => {
        const dataFup1 = c.fup1Enviado.replace('OK ', '');
        const diffDias = Math.floor((hoje.getTime() - new Date(dataFup1).getTime()) / 86400000);
        return diffDias >= (cat.diasFup2 || 7);
      });

      const prontosFup2 = comDiasFup2;

      if (prontosFup1.length === 0 && prontosFup2.length === 0) {
        const diagFup1 = `FUP1: ${catContacts.length} total, ${comOk.length} c/OK, ${semFup1.length} s/fup1, ${comThread.length} c/thread, ${comDias.length} c/dias>=${cat.diasFup1 || 3}`;
        const diagFup2 = `FUP2: ${comFup1Ok.length} c/fup1OK, ${semFup2.length} s/fup2, ${semFup2ComThread.length} c/thread, ${semRespondido.length} s/resp, ${comDiasFup2.length} c/dias>=${cat.diasFup2 || 7}`;
        pulados.push(`"${cat.category}" sem elegíveis: ${diagFup1} | ${diagFup2}`);
        // Só loga na planilha quando forçado (POST), não no scheduler automático
        if (force) {
          await appendLog('FUP1', cat.category, 0, 'ok', diagFup1, spreadsheetId);
          await appendLog('FUP2', cat.category, 0, 'ok', diagFup2, spreadsheetId);
        }
        continue;
      }

      for (const contato of prontosFup1) {
        if (enviadosCat >= limite) break;

        // Guard: re-verificar se fup1 já foi enviado (previne duplicatas entre execuções)
        try {
          const cellCheck = await readSheet('Contatos!I' + contato.rowIndex, spreadsheetId);
          if (cellCheck[0]?.[0]) {
            continue; // Já tem valor em fup1Enviado, pular
          }
        } catch { /* se falhar a leitura, continua normalmente */ }

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
        try {
          await writeSheet(
            'Contatos!I' + contato.rowIndex,
            [[result.success ? 'OK ' + hojeStr : 'ERRO ' + hojeStr + ': ' + result.error]],
            spreadsheetId
          );
        } catch (writeErr: any) {
          await appendLog('FUP1', cat.category, 0, 'erro',
            `WRITE FALHOU row ${contato.rowIndex} ${contato.email}: ${writeErr.message}`, spreadsheetId);
        }
        if (result.success) { totalFups++; enviadosCat++; }
        await new Promise(r => setTimeout(r, 500));
      }

      for (const contato of prontosFup2) {
        if (enviadosCat >= limite) break;

        // Guard: re-verificar se fup2 já foi enviado
        try {
          const cellCheck2 = await readSheet('Contatos!J' + contato.rowIndex, spreadsheetId);
          if (cellCheck2[0]?.[0]) {
            continue;
          }
        } catch { /* continua normalmente */ }

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
        try {
          await writeSheet(
            'Contatos!J' + contato.rowIndex,
            [[result.success ? 'OK ' + hojeStr : 'ERRO ' + hojeStr + ': ' + result.error]],
            spreadsheetId
          );
        } catch (writeErr: any) {
          await appendLog('FUP2', cat.category, 0, 'erro',
            `WRITE FALHOU row ${contato.rowIndex} ${contato.email}: ${writeErr.message}`, spreadsheetId);
        }
        if (result.success) { totalFups++; enviadosCat++; }
        await new Promise(r => setTimeout(r, 500));
      }

      const fup1Sent = Math.min(prontosFup1.length, enviadosCat);
      const fup2Sent = enviadosCat - fup1Sent;
      await appendLog('FUP1', cat.category, fup1Sent, 'ok',
        fup1Sent > 0 ? `${fup1Sent} FUP1(s) enviados` : `${prontosFup1.length} verificados, nenhum pendente no prazo`,
        spreadsheetId);
      if (prontosFup2.length > 0 || fup2Sent > 0) {
        await appendLog('FUP2', cat.category, fup2Sent, 'ok',
          fup2Sent > 0 ? `${fup2Sent} FUP2(s) enviados` : `${prontosFup2.length} verificados, nenhum pendente no prazo`,
          spreadsheetId);
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
