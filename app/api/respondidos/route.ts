import { NextRequest, NextResponse } from 'next/server';
import { readContatos, readPainel, getAllSpreadsheetIds, writeAtendido, writePipeline, writeNota } from '@/lib/sheets';
import { getFullThread } from '@/lib/gmail';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const threadId = searchParams.get('threadId');
  const responsavel = searchParams.get('responsavel');
  const spreadsheetId = searchParams.get('spreadsheetId') || undefined;

  // Full thread fetch mode
  if (threadId && responsavel) {
    const messages = await getFullThread(responsavel, threadId, spreadsheetId);
    return NextResponse.json({ messages });
  }

  // List respondidos
  const allIds = getAllSpreadsheetIds();
  const respondidos: any[] = [];

  for (const sid of allIds) {
    try {
      const [{ contacts }, painel] = await Promise.all([
        readContatos(sid),
        readPainel(sid),
      ]);
      const painelMap: Record<string, { responsavel: string; nomeRemetente: string }> = {};
      for (const p of painel) painelMap[p.category] = { responsavel: p.responsavel, nomeRemetente: p.nomeRemetente };

      for (const c of contacts) {
        const isRespondido = c.fup1Enviado === 'RESPONDIDO' || c.fup2Enviado === 'RESPONDIDO';
        if (!isRespondido) continue;
        respondidos.push({
          rowIndex: c.rowIndex,
          spreadsheetId: sid,
          firstName: c.firstName,
          lastName: c.lastName,
          companyName: c.companyName,
          email: c.email,
          category: c.category,
          threadId: c.threadId,
          atendido: c.atendido,
          pipeline: c.pipeline || 'NOVO',
          nota: c.nota || '',
          responsavel: painelMap[c.category]?.responsavel || '',
          nomeRemetente: painelMap[c.category]?.nomeRemetente || '',
        });
      }
    } catch (e) {
      console.error('Error reading sheet', sid, e);
    }
  }

  return NextResponse.json({ respondidos });
}

export async function POST(req: NextRequest) {
  try {
    const { firstName, lastName, companyName, email, mobilePhone, category, pipeline, nota } = await req.json();
    if (!firstName) {
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });
    }
    const allIds = getAllSpreadsheetIds();
    const spreadsheetId = allIds[0];
    const { appendSheet } = await import('@/lib/sheets');
    // Append to Contatos sheet: A=firstName, B=lastName, C=company, D=email, E=phone, F=linkedin, G=category, H=email1, I=fup1(RESPONDIDO), J=fup2, K=threadId, L=atendido, M=pipeline, N=nota
    await appendSheet('Contatos!A:N', [[
      firstName, lastName || '', companyName || '', email, mobilePhone || '', '', category || '',
      '', 'RESPONDIDO', '', '', '', pipeline || 'NOVO', nota || ''
    ]], spreadsheetId);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { rowIndex, atendido, pipeline, nota, spreadsheetId } = await req.json();
    if (atendido !== undefined) {
      await writeAtendido(rowIndex, atendido ? 'SIM' : '', spreadsheetId);
    }
    if (pipeline !== undefined) {
      await writePipeline(rowIndex, pipeline, spreadsheetId);
    }
    if (nota !== undefined) {
      await writeNota(rowIndex, nota, spreadsheetId);
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
