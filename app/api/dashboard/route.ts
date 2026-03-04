import { NextResponse } from 'next/server';
import { getDashboardStats } from '@/lib/sheets';

export async function GET() {
  try {
    const data = await getDashboardStats();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Dashboard error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
