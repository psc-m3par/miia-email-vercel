import { NextRequest, NextResponse } from 'next/server';
import { saveToken } from '@/lib/tokens';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  if (!code) {
    return NextResponse.json({ error: 'Código não encontrado' }, { status: 400 });
  }

  const redirectUri = `${req.nextUrl.origin}/api/auth/callback`;

  // Trocar o code por tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  const tokenData = await tokenRes.json();

  if (!tokenData.access_token) {
    return NextResponse.json({ error: 'Falha ao obter token', details: tokenData }, { status: 400 });
  }

  // Pegar o email do usuário
  const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const userData = await userRes.json();
  const email = userData.email;

  if (!email) {
    return NextResponse.json({ error: 'Não conseguiu obter email' }, { status: 400 });
  }

  // Salvar token na planilha
  const expiry = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();
  await saveToken({
    email,
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token || '',
    expiry,
  });

  // Setar cookie de sessão e redirecionar
  const response = NextResponse.redirect(`${req.nextUrl.origin}/chats`);
  response.cookies.set('miia_user', email, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
    sameSite: 'lax',
  });
  return response;
}