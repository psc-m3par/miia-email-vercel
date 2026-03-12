import { getValidAccessToken } from './tokens';

function createRawEmail(from: string, to: string, subject: string, htmlBody: string, cc?: string, threadId?: string, messageId?: string): string {
  const boundary = 'boundary_' + Date.now();
  let headers = [
    'From: ' + from,
    'To: ' + to,
    'Subject: ' + subject,
    'MIME-Version: 1.0',
    'Content-Type: multipart/alternative; boundary="' + boundary + '"',
  ];
  if (cc) headers.push('Cc: ' + cc);
  if (messageId) headers.push('In-Reply-To: ' + messageId, 'References: ' + messageId);

  const body = [
    headers.join('\r\n'),
    '',
    '--' + boundary,
    'Content-Type: text/html; charset="UTF-8"',
    '',
    htmlBody,
    '--' + boundary + '--',
  ].join('\r\n');

  return Buffer.from(body).toString('base64url');
}

export async function sendEmail(
  senderEmail: string,
  to: string,
  subject: string,
  htmlBody: string,
  cc?: string,
  spreadsheetId?: string,
  senderName?: string
): Promise<{ success: boolean; threadId?: string; messageId?: string; error?: string }> {
  const accessToken = await getValidAccessToken(senderEmail, spreadsheetId);
  if (!accessToken) {
    return { success: false, error: 'Token nao encontrado para ' + senderEmail + '. Precisa fazer login.' };
  }

  const from = senderName ? senderName + ' <' + senderEmail + '>' : senderEmail;
  const raw = createRawEmail(from, to, subject, htmlBody, cc);

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return { success: false, error: err.error?.message || 'Gmail API error ' + res.status };
  }

  const data = await res.json();
  return { success: true, threadId: data.threadId, messageId: data.id };
}

export async function sendReply(
  senderEmail: string,
  to: string,
  subject: string,
  htmlBody: string,
  threadId: string,
  originalMessageId: string,
  cc?: string,
  spreadsheetId?: string,
  senderName?: string
): Promise<{ success: boolean; error?: string }> {
  const accessToken = await getValidAccessToken(senderEmail, spreadsheetId);
  if (!accessToken) {
    return { success: false, error: 'Token nao encontrado para ' + senderEmail };
  }

  const from = senderName ? senderName + ' <' + senderEmail + '>' : senderEmail;
  const raw = createRawEmail(from, to, subject, htmlBody, cc, threadId, originalMessageId);

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw, threadId }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return { success: false, error: err.error?.message || 'Gmail API error ' + res.status };
  }

  return { success: true };
}

export async function checkReplies(
  senderEmail: string,
  threadId: string,
  spreadsheetId?: string
): Promise<{ hasReply: boolean; isBounce?: boolean; error?: string }> {
  const accessToken = await getValidAccessToken(senderEmail, spreadsheetId);
  if (!accessToken) {
    return { hasReply: false, error: 'Token nao encontrado para ' + senderEmail };
  }

  const res = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/threads/' + threadId,
    { headers: { Authorization: 'Bearer ' + accessToken } }
  );

  if (!res.ok) {
    return { hasReply: false, error: 'Gmail API error ' + res.status };
  }

  const data = await res.json();
  const messages = data.messages || [];

  if (messages.length <= 1) return { hasReply: false };

  const BOUNCE_PATTERNS = ['mailer-daemon', 'postmaster', 'mail delivery subsystem', 'delivery status notification', 'mailer-daemon@'];

  for (const msg of messages) {
    const fromHeader = msg.payload?.headers?.find((h: any) => h.name.toLowerCase() === 'from');
    if (!fromHeader) continue;
    const fromVal = fromHeader.value.toLowerCase();
    if (fromVal.includes(senderEmail.toLowerCase())) continue;
    if (BOUNCE_PATTERNS.some(p => fromVal.includes(p))) {
      return { hasReply: true, isBounce: true };
    }
    return { hasReply: true, isBounce: false };
  }

  return { hasReply: false };
}