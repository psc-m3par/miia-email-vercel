import { NextRequest, NextResponse } from 'next/server';
import { readPainel, readTemplates, readContatos, readSheet, writeSheet, getAllSpreadsheetIds, appendLog, FUP_CONFIG, anyFupIncludes } from '@/lib/sheets';
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

      const catContacts = contacts.filter(c => c.category.normalize('NFC') === cat.category.normalize('NFC'));

      // Build eligible lists and diagnostics for each FUP
      const fupEligible: { fupConfig: typeof FUP_CONFIG[number]; prontos: typeof catContacts; diag: string }[] = [];

      for (const fupConfig of FUP_CONFIG) {
        const defaultDias = fupConfig.n <= 2 ? (fupConfig.n === 1 ? 3 : 7) : 7;

        const comPrevOk = catContacts.filter(c => ((c as any)[fupConfig.prevField] || '').startsWith('OK'));
        const semCur = comPrevOk.filter(c => !(c as any)[fupConfig.curField]);
        const comThread = semCur.filter(c => c.threadId);
        const semRespondido = comThread.filter(c => !anyFupIncludes(c, 'RESPONDIDO'));
        const comDias = semRespondido.filter(c => {
          const dataEnvio = ((c as any)[fupConfig.prevField] || '').replace('OK ', '');
          const diffDias = Math.floor((hoje.getTime() - new Date(dataEnvio).getTime()) / 86400000);
          return diffDias >= ((cat as any)[fupConfig.diasField] || defaultDias);
        });

        const diasUsed = (cat as any)[fupConfig.diasField] || defaultDias;
        const diag = `FUP${fupConfig.n}: ${catContacts.length} total, ${comPrevOk.length} c/prevOK, ${semCur.length} s/cur, ${comThread.length} c/thread, ${semRespondido.length} s/resp, ${comDias.length} c/dias>=${diasUsed}`;

        fupEligible.push({ fupConfig, prontos: comDias, diag });
      }

      const totalEligible = fupEligible.reduce((sum, f) => sum + f.prontos.length, 0);
      if (totalEligible === 0) {
        const diagAll = fupEligible.map(f => f.diag).join(' | ');
        pulados.push(`"${cat.category}" sem elegíveis: ${diagAll}`);
        if (force) {
          for (const f of fupEligible) {
            await appendLog('FUP' + f.fupConfig.n, cat.category, 0, 'ok', f.diag, spreadsheetId);
          }
        }
        continue;
      }

      // Track how many were sent per FUP for logging
      const sentPerFup: Record<number, number> = {};
      for (const fupConfig of FUP_CONFIG) sentPerFup[fupConfig.n] = 0;

      for (const { fupConfig, prontos } of fupEligible) {
        for (const contato of prontos) {
          if (enviadosCat >= limite) break;

          // Guard: re-verificar se a célula já foi preenchida (previne duplicatas entre execuções)
          try {
            const cellCheck = await readSheet('Contatos!' + fupConfig.col + contato.rowIndex, spreadsheetId);
            if (cellCheck[0]?.[0]) {
              continue; // Já tem valor, pular
            }
          } catch { /* se falhar a leitura, continua normalmente */ }

          // Check for replies before sending
          const replyCheck = await checkReplies(cat.responsavel, contato.threadId, spreadsheetId);
          if (replyCheck.hasReply) {
            // Mark current FUP and ALL subsequent FUP columns as RESPONDIDO
            const fupIdx = FUP_CONFIG.findIndex(f => f.n === fupConfig.n);
            for (let i = fupIdx; i < FUP_CONFIG.length; i++) {
              const subsequentCol = FUP_CONFIG[i].col;
              await writeSheet(
                'Contatos!' + subsequentCol + contato.rowIndex,
                [['RESPONDIDO']],
                spreadsheetId
              );
            }
            continue;
          }

          const assunto = ((template as any)[fupConfig.subjectField] || template.assunto)
            .replace(/\{firstName\}|\[First Name\]/gi, contato.firstName)
            .replace(/\{lastName\}|\[Last Name\]/gi, contato.lastName)
            .replace(/\{companyName\}|\[Company\]/gi, contato.companyName)
            .replace(/\[Sender Name\]/gi, cat.nomeRemetente)
            .replace(/\[Category\]/gi, cat.category)
            .replace(/\r?\n/g, ' ').trim();

          const corpoRaw = ((template as any)[fupConfig.bodyField] || '')
            .replace(/\{firstName\}|\[First Name\]/gi, contato.firstName)
            .replace(/\{lastName\}|\[Last Name\]/gi, contato.lastName)
            .replace(/\{companyName\}|\[Company\]/gi, contato.companyName)
            .replace(/\[Sender Name\]/gi, cat.nomeRemetente)
            .replace(/\[Category\]/gi, cat.category);
          const htmlBody = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6"><p>${corpoRaw.replace(/\r\n/g, '\n').replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br>')}</p></div>`;

          const result = await sendReply(
            cat.responsavel, contato.email, assunto, htmlBody,
            contato.threadId, contato.threadId,
            cat.cc, spreadsheetId, cat.nomeRemetente
          );

          const hojeStr = hojeSpDate;
          try {
            await writeSheet(
              'Contatos!' + fupConfig.col + contato.rowIndex,
              [[result.success ? 'OK ' + hojeStr : 'ERRO ' + hojeStr + ': ' + result.error]],
              spreadsheetId
            );
          } catch (writeErr: any) {
            await appendLog('FUP' + fupConfig.n, cat.category, 0, 'erro',
              `WRITE FALHOU row ${contato.rowIndex} ${contato.email}: ${writeErr.message}`, spreadsheetId);
          }
          if (result.success) { totalFups++; enviadosCat++; sentPerFup[fupConfig.n]++; }
          await new Promise(r => setTimeout(r, 500));
        }
      }

      // Log results per FUP
      for (const { fupConfig, prontos } of fupEligible) {
        const sent = sentPerFup[fupConfig.n];
        if (prontos.length > 0 || sent > 0) {
          await appendLog('FUP' + fupConfig.n, cat.category, sent, 'ok',
            sent > 0 ? `${sent} FUP${fupConfig.n}(s) enviados` : `${prontos.length} verificados, nenhum pendente no prazo`,
            spreadsheetId);
        }
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
