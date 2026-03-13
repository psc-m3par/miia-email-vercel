import { NextRequest, NextResponse } from 'next/server';
import { getValidAccessToken } from '@/lib/tokens';
import { sendReply } from '@/lib/gmail';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const { senderEmail, senderName, to, threadId, body, spreadsheetId } = await req.json();

    const accessToken = await getValidAccessToken(senderEmail, spreadsheetId);
    if (!accessToken) {
      return NextResponse.json({ error: 'Token não encontrado para ' + senderEmail }, { status: 400 });
    }

    // Fetch thread to get original subject and message-id for proper threading
    let subject = 'Re: ';
    let originalMessageId = '';
    try {
      const res = await fetch(
        'https://gmail.googleapis.com/gmail/v1/users/me/threads/' + threadId + '?format=metadata&metadataHeaders=Subject&metadataHeaders=Message-ID',
        { headers: { Authorization: 'Bearer ' + accessToken } }
      );
      if (res.ok) {
        const data = await res.json();
        const firstMsg = data.messages?.[0];
        const subjectHeader = firstMsg?.payload?.headers?.find((h: any) => h.name.toLowerCase() === 'subject');
        const msgIdHeader = firstMsg?.payload?.headers?.find((h: any) => h.name.toLowerCase() === 'message-id');
        if (subjectHeader?.value) subject = 'Re: ' + subjectHeader.value.replace(/^Re:\s*/i, '');
        if (msgIdHeader?.value) originalMessageId = msgIdHeader.value;
      }
    } catch {}

    const htmlBody = body.replace(/\n/g, '<br>');
    const result = await sendReply(senderEmail, to, subject, htmlBody, threadId, originalMessageId, undefined, spreadsheetId, senderName || undefined);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
