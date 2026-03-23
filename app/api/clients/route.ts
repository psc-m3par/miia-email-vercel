import { NextRequest, NextResponse } from 'next/server';
import { readClientes, writeClientes, getAllSpreadsheetIds } from '@/lib/sheets';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const allIds = getAllSpreadsheetIds();
    const clients = await readClientes(allIds[0]);
    return NextResponse.json(clients);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { clients } = await req.json();
    const allIds = getAllSpreadsheetIds();
    const rows = clients.map((c: any) => [c.empresa || '', c.email || '']);
    await writeClientes(rows, allIds[0]);
    return NextResponse.json({ ok: true, count: rows.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
