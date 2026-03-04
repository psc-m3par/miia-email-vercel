import { google } from 'googleapis';

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

function getSheets() {
  return google.sheets({ version: 'v4', auth: getAuth() });
}

const SPREADSHEET_ID = process.env.SPREADSHEET_ID!;

// ── READ ──
export async function readSheet(range: string) {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range,
  });
  return res.data.values || [];
}

// ── WRITE ──
export async function writeSheet(range: string, values: any[][]) {
  const sheets = getSheets();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  });
}

// ── APPEND ──
export async function appendSheet(range: string, values: any[][]) {
  const sheets = getSheets();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values },
  });
}

// ── CLEAR ──
export async function clearSheet(range: string) {
  const sheets = getSheets();
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range,
  });
}

// ── HIGH-LEVEL: Read Painel ──
export async function readPainel() {
  const rows = await readSheet('Painel!A:H');
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).filter(r => r[0]).map(r => ({
    category: r[0] || '',
    responsavel: r[1] || '',
    nomeRemetente: r[2] || '',
    emailsHora: parseInt(r[3]) || 20,
    diasFup1: parseInt(r[4]) || 3,
    diasFup2: parseInt(r[5]) || 7,
    ativo: (r[6] || '').toString().toUpperCase() === 'SIM',
    cc: r[7] || '',
  }));
}

// ── HIGH-LEVEL: Read Templates ──
export async function readTemplates() {
  const rows = await readSheet('Templates!A:G');
  if (rows.length < 2) return [];
  return rows.slice(1).filter(r => r[0]).map(r => ({
    category: r[0] || '',
    assunto: r[1] || '',
    corpo: r[2] || '',
    fup1Assunto: r[3] || '',
    fup1Corpo: r[4] || '',
    fup2Assunto: r[5] || '',
    fup2Corpo: r[6] || '',
  }));
}

// ── HIGH-LEVEL: Read Contatos with stats ──
export async function readContatos() {
  const rows = await readSheet('Contatos!A:K');
  if (rows.length < 2) return { headers: rows[0] || [], contacts: [] };
  const headers = rows[0];
  const contacts = rows.slice(1).filter(r => r[0] || r[3]).map((r, i) => ({
    rowIndex: i + 2,
    firstName: r[0] || '',
    lastName: r[1] || '',
    companyName: r[2] || '',
    email: r[3] || '',
    mobilePhone: r[4] || '',
    linkedinUrl: r[5] || '',
    category: r[6] || '',
    email1Enviado: r[7] || '',
    fup1Enviado: r[8] || '',
    fup2Enviado: r[9] || '',
    threadId: r[10] || '',
  }));
  return { headers, contacts };
}

// ── HIGH-LEVEL: Dashboard stats ──
export async function getDashboardStats() {
  const [painel, templates, { contacts }] = await Promise.all([
    readPainel(),
    readTemplates(),
    readContatos(),
  ]);

  const hoje = new Date().toISOString().split('T')[0];
  const stats: Record<string, any> = {};
  let totalGeral = { total: 0, pendentes: 0, email1: 0, fup1: 0, fup2: 0, respondidos: 0, erros: 0, semThread: 0, hojeEmail1: 0, hojeFup1: 0, hojeFup2: 0 };

  for (const c of contacts) {
    const cat = c.category;
    if (!cat) continue;
    if (!stats[cat]) {
      stats[cat] = { total: 0, pendentes: 0, email1: 0, fup1: 0, fup2: 0, respondidos: 0, erros: 0, semThread: 0, hojeEmail1: 0, hojeFup1: 0, hojeFup2: 0 };
    }
    stats[cat].total++;
    totalGeral.total++;

    const e1 = c.email1Enviado.toString();
    const f1 = c.fup1Enviado.toString();
    const f2 = c.fup2Enviado.toString();

    if (e1.startsWith('OK')) { stats[cat].email1++; totalGeral.email1++; }
    else if (e1.startsWith('ERRO')) { stats[cat].erros++; totalGeral.erros++; }
    else { stats[cat].pendentes++; totalGeral.pendentes++; }

    if (f1.startsWith('OK')) { stats[cat].fup1++; totalGeral.fup1++; }
    if (f2.startsWith('OK')) { stats[cat].fup2++; totalGeral.fup2++; }
    if (f2 === 'RESPONDIDO') { stats[cat].respondidos++; totalGeral.respondidos++; }
    if (e1.startsWith('OK') && !c.threadId) { stats[cat].semThread++; totalGeral.semThread++; }

    if (e1.includes(hoje)) { stats[cat].hojeEmail1++; totalGeral.hojeEmail1++; }
    if (f1.includes(hoje)) { stats[cat].hojeFup1++; totalGeral.hojeFup1++; }
    if (f2.includes(hoje)) { stats[cat].hojeFup2++; totalGeral.hojeFup2++; }
  }

  return { painel, templates, stats, totalGeral, totalContatos: contacts.length };
}

// ── HIGH-LEVEL: Append contacts from Apollo CSV ──
export async function appendContacts(contacts: any[][]) {
  await appendSheet('Contatos!A:G', contacts);
}

// ── HIGH-LEVEL: Update Painel row ──
export async function updatePainelRow(rowIndex: number, values: any[]) {
  const range = `Painel!A${rowIndex}:H${rowIndex}`;
  await writeSheet(range, [values]);
}

// ── HIGH-LEVEL: Update Template row ──
export async function updateTemplateRow(rowIndex: number, values: any[]) {
  const range = `Templates!A${rowIndex}:G${rowIndex}`;
  await writeSheet(range, [values]);
}
