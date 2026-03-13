import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const response = NextResponse.redirect(new URL('/login', req.url));
  response.cookies.set('miia_user', '', { maxAge: 0, path: '/' });
  return response;
}
