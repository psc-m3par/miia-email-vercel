import { getValidAccessToken } from './tokens';

function sanitizeEmail(email: string): string {
  // Extract just the email address, stripping any extra data
  const trimmed = email.trim();
  // If it contains angle brackets like "Name <email@x.com>", extract the email
  const angleMatch = trimmed.match(/<([^>]+)>/);
  if (angleMatch) return angleMatch[1].trim();
  // If it contains @ somewhere, extract the email-like part
  const emailMatch = trimmed.match(/[\w.+-]+@[\w.-]+\.\w+/);
  if (emailMatch) return emailMatch[0];
  return trimmed;
}

function createRawEmail(from: string, to: string, subject: string, htmlBody: string, cc?: string, threadId?: string, messageId?: string): string {
  const cleanTo = sanitizeEmail(to);
  const boundary = 'boundary_' + Date.now();
  let headers = [
    'From: ' + from,
    'To: ' + cleanTo,
    'Subject: =?UTF-8?B?' + Buffer.from(subject, 'utf-8').toString('base64') + '?=',
    'MIME-Version: 1.0',
    'Content-Type: multipart/alternative; boundary="' + boundary + '"',
  ];
  if (cc) headers.push('Cc: ' + sanitizeEmail(cc));
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

const UNSUBSCRIBE_KEYWORDS = [
  'não tenho interesse', 'nao tenho interesse',
  'não temos interesse', 'nao temos interesse',
  'sem interesse', 'não é o momento', 'nao é o momento',
  'não faz sentido', 'nao faz sentido',
  'não tenho interesse', 'não estamos interessados', 'nao estamos interessados',
  'unsubscribe', 'remova', 'descadastrar', 'descadastre', 'me descadastre', 'me remova',
  'não quero', 'nao quero', 'para de mandar', 'pare de mandar', 'parar de receber',
  'não me contate', 'nao me contate', 'não entre em contato', 'nao entre em contato',
  'please remove', 'remove me', 'stop sending', 'opt out', 'opt-out',
];

export async function checkReplies(
  senderEmail: string,
  threadId: string,
  spreadsheetId?: string
): Promise<{ hasReply: boolean; isBounce?: boolean; isUnsubscribe?: boolean; error?: string }> {
  const accessToken = await getValidAccessToken(senderEmail, spreadsheetId);
  if (!accessToken) {
    return { hasReply: false, error: 'Token nao encontrado para ' + senderEmail };
  }

  const abort1 = new AbortController();
  const t1 = setTimeout(() => abort1.abort(), 5000);
  let res: Response;
  try {
    res = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/threads/' + threadId + '?format=metadata&metadataHeaders=From&metadataHeaders=Subject',
      { headers: { Authorization: 'Bearer ' + accessToken }, signal: abort1.signal }
    );
  } catch {
    return { hasReply: false, error: 'Gmail API timeout' };
  } finally {
    clearTimeout(t1);
  }

  if (!res.ok) {
    return { hasReply: false, error: 'Gmail API error ' + res.status };
  }

  const data = await res.json();
  const messages = data.messages || [];

  if (messages.length <= 1) return { hasReply: false };

  const BOUNCE_FROM_PATTERNS = ['mailer-daemon', 'postmaster', 'mail delivery subsystem', 'delivery status notification', 'microsoftexchange', 'noreply', 'no-reply', 'auto-reply', 'autoreply', 'automated'];
  const BOUNCE_SUBJECT_PATTERNS = [
    'undeliverable', 'undelivered', 'delivery failed', 'delivery failure', 'mail delivery failed',
    'failure notice', 'returned mail', 'address not found', 'user unknown',
    'mailbox unavailable', 'mailbox not found', 'recipient rejected', 'does not exist',
    'no such user', 'account not found', 'recipient not found', 'invalid recipient',
    'não entregue', 'nao entregue',
    'endereço não encontrado', 'endereco nao encontrado',
    'destinatário não encontrado', 'destinatario nao encontrado',
    'caixa de correio não encontrada', 'caixa de correio nao encontrada',
    'conta não encontrada', 'conta nao encontrada',
    'não foi possível entregar', 'nao foi possivel entregar',
    'mensagem não entregue', 'mensagem nao entregue',
    'falha na entrega', 'erro de entrega',
  ];
  const BOUNCE_BODY_PATTERNS = [
    'address not found', 'user unknown', 'mailbox not found', 'does not exist',
    'no such user', 'recipient rejected', 'mailbox unavailable', 'account not found',
    'endereço não encontrado', 'endereco nao encontrado',
    'destinatário não encontrado', 'destinatario nao encontrado',
    'caixa de correio não encontrada', 'caixa de correio nao encontrada',
    'não foi possível entregar', 'nao foi possivel entregar',
    'mensagem não entregue', 'mensagem nao entregue',
    'falha na entrega', 'erro de entrega',
    'this message was created automatically', 'delivery has failed',
    'delivery status notification', 'undeliverable',
    'the email account that you tried to reach does not exist',
    'conta não encontrada', 'conta nao encontrada',
  ];

  for (const msg of messages) {
    const headers = msg.payload?.headers || [];
    const fromHeader = headers.find((h: any) => h.name.toLowerCase() === 'from');
    const subjectHeader = headers.find((h: any) => h.name.toLowerCase() === 'subject');
    if (!fromHeader) continue;
    const fromVal = fromHeader.value.toLowerCase();
    if (senderEmail && fromVal.includes(senderEmail.toLowerCase())) continue;
    const subjectVal = (subjectHeader?.value || '').toLowerCase();
    const isBounceHeader =
      BOUNCE_FROM_PATTERNS.some(p => fromVal.includes(p)) ||
      BOUNCE_SUBJECT_PATTERNS.some(p => subjectVal.includes(p));
    if (isBounceHeader) return { hasReply: true, isBounce: true };

    // Fetch message body to check for bounce and unsubscribe keywords
    let isUnsubscribe = false;
    let isBounceBody = false;
    try {
      const abort2 = new AbortController();
      const t2 = setTimeout(() => abort2.abort(), 5000);
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
        { headers: { Authorization: 'Bearer ' + accessToken }, signal: abort2.signal }
      );
      clearTimeout(t2);
      if (msgRes.ok) {
        const msgData = await msgRes.json();
        const body = extractTextBody(msgData.payload).toLowerCase().slice(0, 2000);
        isBounceBody = BOUNCE_BODY_PATTERNS.some(p => body.includes(p));
        if (!isBounceBody) {
          isUnsubscribe = UNSUBSCRIBE_KEYWORDS.some(k => body.includes(k));
        }
      }
    } catch { /* ignore body fetch errors */ }

    if (isBounceBody) return { hasReply: true, isBounce: true };
    return { hasReply: true, isBounce: false, isUnsubscribe };
  }

  return { hasReply: false };
}

function extractTextBody(payload: any): string {
  if (!payload) return '';
  if (payload.body?.data) {
    try { return Buffer.from(payload.body.data, 'base64url').toString('utf-8'); } catch { return ''; }
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        try { return Buffer.from(part.body.data, 'base64url').toString('utf-8'); } catch { continue; }
      }
    }
    for (const part of payload.parts) {
      const t = extractTextBody(part);
      if (t) return t;
    }
  }
  return '';
}

export interface ThreadMessage {
  id: string;
  from: string;
  fromName: string;
  date: string;
  body: string;
  isMine: boolean;
}

export async function getFullThread(
  senderEmail: string,
  threadId: string,
  spreadsheetId?: string
): Promise<ThreadMessage[]> {
  try {
    const accessToken = await getValidAccessToken(senderEmail, spreadsheetId);
    if (!accessToken) return [];
    const res = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/threads/' + threadId + '?format=full',
      { headers: { Authorization: 'Bearer ' + accessToken } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const messages: any[] = data.messages || [];
    return messages.map(msg => {
      const headers = msg.payload?.headers || [];
      const fromHeader = headers.find((h: any) => h.name.toLowerCase() === 'from');
      const dateHeader = headers.find((h: any) => h.name.toLowerCase() === 'date');
      const fromVal = fromHeader?.value || '';
      const nameMatch = fromVal.match(/^([^<]+)</);
      const fromName = nameMatch ? nameMatch[1].trim() : fromVal;
      const isMine = fromVal.toLowerCase().includes(senderEmail.toLowerCase());
      const body = extractTextBody(msg.payload).slice(0, 3000);
      return { id: msg.id, from: fromVal, fromName, date: dateHeader?.value || '', body, isMine };
    });
  } catch { return []; }
}

export async function getReplyText(
  senderEmail: string,
  threadId: string,
  spreadsheetId?: string
): Promise<string> {
  try {
    const accessToken = await getValidAccessToken(senderEmail, spreadsheetId);
    if (!accessToken) return '';
    const res = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/threads/' + threadId + '?format=full',
      { headers: { Authorization: 'Bearer ' + accessToken } }
    );
    if (!res.ok) return '';
    const data = await res.json();
    const messages = data.messages || [];
    for (const msg of messages) {
      const fromHeader = msg.payload?.headers?.find((h: any) => h.name.toLowerCase() === 'from');
      if (!fromHeader) continue;
      if (fromHeader.value.toLowerCase().includes(senderEmail.toLowerCase())) continue;
      const text = extractTextBody(msg.payload);
      if (text) return text.slice(0, 2000);
    }
    return '';
  } catch { return ''; }
}