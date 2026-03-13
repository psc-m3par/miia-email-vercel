import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/gmail';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { senderEmail, spreadsheetId, toEmail, note, contactName, contactCompany, forwardedBody } = await req.json();
    if (!senderEmail || !toEmail || !forwardedBody) {
      return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 });
    }

    const subject = `${contactName || 'Prospect'}${contactCompany ? ' · ' + contactCompany : ''} — o que você responderia?`;

    const htmlBody = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#333">
      ${note ? `<p>${note.replace(/\n/g, '<br>')}</p><hr style="border:none;border-top:1px solid #eee;margin:16px 0">` : ''}
      <p style="color:#888;font-size:12px;margin-bottom:8px">Mensagem recebida de <strong>${contactName || 'prospect'}${contactCompany ? ' (' + contactCompany + ')' : ''}</strong>:</p>
      <div style="background:#f8f8f8;border-left:3px solid #6366f1;padding:12px 16px;border-radius:0 8px 8px 0;white-space:pre-wrap;font-size:13px">${forwardedBody}</div>
    </div>`;

    const result = await sendEmail(senderEmail, toEmail, subject, htmlBody, undefined, spreadsheetId);
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
