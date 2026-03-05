import { NextResponse } from 'next/server';
import { getDashboardStats } from '@/lib/sheets';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const data = await getDashboardStats();
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    });
  } catch (error: any) {
    console.error('Dashboard error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}