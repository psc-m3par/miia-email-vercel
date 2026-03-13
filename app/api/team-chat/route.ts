import { NextRequest, NextResponse } from 'next/server';
import { getValidAccessToken } from '@/lib/tokens';
import { getFullThread, sendEmail, sendReply } from '@/lib/gmail';

export const dynamic = 'force-dynamic';

function getHeader(headers: any[], name: string) {
  return headers?.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';
}

export async function GET(req: NextRequest) {
  const user = req.cookies.get('miia_user')?.value;
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  const threadId = req.nextUrl.searchParams.get('threadId');

  if (threadId) {
    const messages = await getFullThread(user, threadId);
    return NextResponse.json({ messages });
  }

  // List internal email threads
  const token = await getValidAccessToken(user);
  if (!token) return NextResponse.json({ threads: [] });

  const domain = user.split('@')[1];
  const query = encodeURIComponent(`from:@${domain} to:@${domain}`);

  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads?q=${query}&maxResults=30`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const listData = await listRes.json();
  const rawThreads: { id: string; snippet: string }[] = listData.threads || [];

  const threads = (await Promise.all(
    rawThreads.slice(0, 20).map(async (t) => {
      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/threads/${t.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      const msgs = data.messages || [];
      const lastMsg = msgs[msgs.length - 1];
      const headers = lastMsg?.payload?.headers || [];
      const from = getHeader(headers, 'from');
      const to = getHeader(headers, 'to');
      const date = getHeader(headers, 'date');
      const subject = getHeader(headers, 'subject');
      const fromEmail = (from.match(/<(.+)>/) || [null, from])[1] || from;
      const toEmail = (to.match(/<(.+)>/) || [null, to])[1] || to;
      const isMine = fromEmail.toLowerCase() === user.toLowerCase();
      const colleague = isMine ? toEmail : fromEmail;
      if (!colleague || colleague.toLowerCase() === user.toLowerCase()) return null;
      return { id: t.id, colleague, snippet: t.snippet || '', date, subject };
    })
  )).filter(Boolean) as { id: string; colleague: string; snippet: string; date: string; subject: string }[];

  return NextResponse.json({ threads });
}

export async function POST(req: NextRequest) {
  const user = req.cookies.get('miia_user')?.value;
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  const { to, subject, body, threadId, lastMessageId } = await req.json();
  if (!to || !body) return NextResponse.json({ error: 'to e body obrigatórios' }, { status: 400 });

  const htmlBody = body.replace(/\n/g, '<br>');

  let result;
  if (threadId && lastMessageId) {
    result = await sendReply(user, to, subject || 'Re: Consulta MIIA', htmlBody, threadId, lastMessageId);
  } else {
    result = await sendEmail(user, to, subject || 'Consulta MIIA', htmlBody);
  }

  if (!result.success) {
    console.error('[team-chat] sendEmail failed:', result.error);
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, threadId: (result as any).threadId });
}
