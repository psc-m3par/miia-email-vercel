import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = req.cookies.get('miia_user')?.value || null;
  return NextResponse.json({ user });
}
