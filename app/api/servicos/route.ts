import { NextResponse } from 'next/server';
import { readSheet, writeSheet, getAllSpreadsheetIds } from '@/lib/sheets';
import { google } from 'googleapis';

export const dynamic = 'force-dynamic';

interface Servico {
  rowIndex: number;
  id: string;
  nome: string;
  descricao: string;
  detalhes: string;
  dataCriacao: string;
}

async function ensureHeader(sid: string) {
  try {
    const rows = await readSheet('Servicos!A1:E1', sid);
    if (!rows || rows.length === 0 || rows[0][0] !== 'ID') {
      await writeSheet('Servicos!A1:E1', [['ID', 'Nome', 'Descricao', 'Detalhes', 'DataCriacao']], sid);
    }
  } catch {
    // Sheet doesn't exist, create it
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sid,
      requestBody: { requests: [{ addSheet: { properties: { title: 'Servicos' } } }] },
    });
    await writeSheet('Servicos!A1:E1', [['ID', 'Nome', 'Descricao', 'Detalhes', 'DataCriacao']], sid);
  }
}

export async function GET() {
  try {
    const sid = getAllSpreadsheetIds()[0];
    await ensureHeader(sid);
    const rows = await readSheet('Servicos!A:E', sid).catch(() => []);
    const servicos: Servico[] = rows.slice(1).filter((r: any[]) => r[0]).map((r: any[], i: number) => ({
      rowIndex: i + 2,
      id: r[0] || '',
      nome: r[1] || '',
      descricao: r[2] || '',
      detalhes: r[3] || '',
      dataCriacao: r[4] || '',
    }));
    return NextResponse.json(servicos);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { nome, descricao, detalhes } = await request.json();
    if (!nome) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });
    const sid = getAllSpreadsheetIds()[0];
    await ensureHeader(sid);
    const id = Date.now().toString();
    const dataCriacao = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
    const rows = await readSheet('Servicos!A:A', sid).catch(() => []);
    const nextRow = rows.length + 1;
    await writeSheet(`Servicos!A${nextRow}:E${nextRow}`, [[id, nome, descricao || '', detalhes || '', dataCriacao]], sid);
    return NextResponse.json({ ok: true, id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { rowIndex, nome, descricao, detalhes } = await request.json();
    if (!rowIndex || !nome) return NextResponse.json({ error: 'rowIndex e nome são obrigatórios' }, { status: 400 });
    const sid = getAllSpreadsheetIds()[0];
    await writeSheet(`Servicos!B${rowIndex}:D${rowIndex}`, [[nome, descricao || '', detalhes || '']], sid);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { rowIndex } = await request.json();
    if (!rowIndex) return NextResponse.json({ error: 'rowIndex é obrigatório' }, { status: 400 });
    const sid = getAllSpreadsheetIds()[0];
    await writeSheet(`Servicos!A${rowIndex}:E${rowIndex}`, [['', '', '', '', '']], sid);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
