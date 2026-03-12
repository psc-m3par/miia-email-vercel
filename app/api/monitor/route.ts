import { NextResponse } from 'next/server';
import { readLogs, getAllSpreadsheetIds } from '@/lib/sheets';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const allIds = getAllSpreadsheetIds();
    const logs = await readLogs(allIds[0], 200);
    return NextResponse.json({ logs }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
