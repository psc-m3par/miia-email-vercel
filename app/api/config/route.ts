import { NextRequest, NextResponse } from 'next/server';
import { readConfig, writeConfig, getAllSpreadsheetIds } from '@/lib/sheets';

export const dynamic = 'force-dynamic';

export async function GET() {
  const id = getAllSpreadsheetIds()[0];
  const config = await readConfig(id);
  return NextResponse.json(config);
}

export async function PUT(req: NextRequest) {
  const { key, value } = await req.json();
  const id = getAllSpreadsheetIds()[0];
  await writeConfig(key, value, id);
  return NextResponse.json({ ok: true });
}
