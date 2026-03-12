import { NextResponse } from 'next/server';
import { readLogs, getDashboardStats, getAllSpreadsheetIds } from '@/lib/sheets';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const allIds = getAllSpreadsheetIds();
    const [logs, dashData] = await Promise.all([
      readLogs(allIds[0], 150),
      getDashboardStats(),
    ]);
    return NextResponse.json({ logs, ...dashData }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
