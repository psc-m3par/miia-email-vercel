import { NextRequest, NextResponse } from 'next/server';
import { readInternalChats, appendInternalChat, markChatRead } from '@/lib/sheets';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = req.cookies.get('miia_user')?.value;
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  const messages = await readInternalChats(user);
  return NextResponse.json({ messages });
}

export async function POST(req: NextRequest) {
  const user = req.cookies.get('miia_user')?.value;
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  const { para, mensagem, prospectRef } = await req.json();
  if (!para || !mensagem) return NextResponse.json({ error: 'para e mensagem obrigatórios' }, { status: 400 });
  const id = await appendInternalChat(user, para, mensagem, prospectRef || '');
  return NextResponse.json({ ok: true, id });
}

export async function PUT(req: NextRequest) {
  const user = req.cookies.get('miia_user')?.value;
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  const { fromEmail } = await req.json();
  await markChatRead(user, fromEmail);
  return NextResponse.json({ ok: true });
}
