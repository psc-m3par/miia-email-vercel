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

export function getAllSpreadsheetIds(): string[] {
  return [SPREADSHEET_ID];
}

export function getSpreadsheetIdForResponsavel(email: string): string {
  return SPREADSHEET_ID;
}

export async function readSheet(range: string, spreadsheetId?: string) {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId || SPREADSHEET_ID, range });
  return res.data.values || [];
}

export async function writeSheet(range: string, values: any[][], spreadsheetId?: string) {
  const sheets = getSheets();
  await sheets.spreadsheets.values.update({
    spreadsheetId: spreadsheetId || SPREADSHEET_ID, range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  });
}

export async function appendSheet(range: string, values: any[][], spreadsheetId?: string) {
  const sheets = getSheets();
  await sheets.spreadsheets.values.append({
    spreadsheetId: spreadsheetId || SPREADSHEET_ID, range,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values },
  });
}

export async function readPainel(spreadsheetId?: string) {
  const rows = await readSheet('Painel!A:K', spreadsheetId);
  if (rows.length < 2) return [];
  return rows.slice(1).filter(r => r[0]).map((r, i) => ({
    rowIndex: i + 2,
    category: r[0] || '',
    responsavel: r[1] || '',
    nomeRemetente: r[2] || '',
    emailsHora: parseInt(r[3]) || 20,
    diasFup1: parseInt(r[4]) || 3,
    diasFup2: parseInt(r[5]) || 7,
    ativo: (r[6] || '').toString().toUpperCase() === 'SIM',
    cc: r[7] || '',
    ultimoEnvio: r[8] || '',
    horaInicio: parseInt(r[9]) || 0,
    horaFim: parseInt(r[10]) || 24,
  }));
}

export async function readTemplates(spreadsheetId?: string) {
  const rows = await readSheet('Templates!A:G', spreadsheetId);
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

export async function readContatos(spreadsheetId?: string) {
  const rows = await readSheet('Contatos!A:N', spreadsheetId);
  if (rows.length < 2) return { headers: rows[0] || [], contacts: [] };
  const headers = rows[0];
  const contacts = rows.slice(1).map((r, i) => ({ r, actualRow: i + 2 })).filter(({ r }) => r[0] || r[3]).map(({ r, actualRow }) => ({
    rowIndex: actualRow,
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
    atendido: r[11] || '',
    pipeline: r[12] || '',
    nota: r[13] || '',
  }));
  return { headers, contacts };
}

export async function writePipeline(rowIndex: number, value: string, spreadsheetId?: string): Promise<void> {
  await writeSheet('Contatos!M' + rowIndex, [[value]], spreadsheetId);
}

export async function writeNota(rowIndex: number, value: string, spreadsheetId?: string): Promise<void> {
  await writeSheet('Contatos!N' + rowIndex, [[value]], spreadsheetId);
}

export async function getDashboardStats() {
  const allIds = getAllSpreadsheetIds();
  let allPainel: any[] = [];
  let allTemplates: any[] = [];
  let allContacts: any[] = [];

  for (const id of allIds) {
    try {
      const [painel, templates, { contacts }] = await Promise.all([
        readPainel(id), readTemplates(id), readContatos(id),
      ]);
      allPainel = allPainel.concat(painel);
      allTemplates = allTemplates.concat(templates);
      allContacts = allContacts.concat(contacts);
    } catch (e) {
      console.error('Error reading spreadsheet ' + id, e);
    }
  }

  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const stats: Record<string, any> = {};
  const emptyStats = {
    total: 0, pendentes: 0, email1: 0, fup1: 0, fup2: 0,
    respondidos: 0, bounced: 0, erros: 0, semThread: 0,
    hojeEmail1: 0, hojeFup1: 0, hojeFup2: 0,
    // Per-stage breakdown
    e1Respondidos: 0, e1Bounced: 0,
    fup1Respondidos: 0, fup1Bounced: 0,
    fup2Respondidos: 0, fup2Bounced: 0,
    // Conversion: contacts with pipeline REUNIAO or GANHO
    conversoes: 0,
  };
  let totalGeral = { ...emptyStats };

  for (const c of allContacts) {
    const cat = c.category;
    if (!cat) continue;
    if (!stats[cat]) stats[cat] = { ...emptyStats };
    stats[cat].total++; totalGeral.total++;

    const e1 = c.email1Enviado.toString();
    const f1 = c.fup1Enviado.toString();
    const f2 = c.fup2Enviado.toString();

    if (e1.startsWith('OK')) { stats[cat].email1++; totalGeral.email1++; }
    else if (e1.startsWith('ERRO')) { stats[cat].erros++; totalGeral.erros++; }
    else if (e1.startsWith('BOUNCE')) { stats[cat].e1Bounced++; totalGeral.e1Bounced++; stats[cat].bounced++; totalGeral.bounced++; }
    else { stats[cat].pendentes++; totalGeral.pendentes++; }

    if (f1.startsWith('OK')) { stats[cat].fup1++; totalGeral.fup1++; }
    if (f2.startsWith('OK')) { stats[cat].fup2++; totalGeral.fup2++; }

    // Per-stage respondidos/bounced
    // E1 stage: responded/bounced before FUP1 was sent (fup1Enviado = RESPONDIDO/BOUNCE)
    if (f1 === 'RESPONDIDO') { stats[cat].e1Respondidos++; totalGeral.e1Respondidos++; }
    if (f1 === 'BOUNCE') { stats[cat].e1Bounced++; totalGeral.e1Bounced++; }
    // FUP1 stage: FUP1 sent (OK), response before FUP2 (fup2 = RESPONDIDO/BOUNCE, not OK)
    if (f1.startsWith('OK') && f2 === 'RESPONDIDO') { stats[cat].fup1Respondidos++; totalGeral.fup1Respondidos++; }
    if (f1.startsWith('OK') && f2 === 'BOUNCE') { stats[cat].fup1Bounced++; totalGeral.fup1Bounced++; }
    // FUP2 stage: hard to distinguish from FUP1 stage in current data model, tracked together above

    // Totals (backward compat)
    if (f1 === 'RESPONDIDO' || f2 === 'RESPONDIDO') { stats[cat].respondidos++; totalGeral.respondidos++; }
    if (f1 === 'BOUNCE' || f2 === 'BOUNCE') { stats[cat].bounced++; totalGeral.bounced++; }
    // Conversion: pipeline is REUNIAO or GANHO
    const pipe = (c.pipeline || '').toUpperCase();
    if (pipe === 'REUNIAO' || pipe === 'GANHO') { stats[cat].conversoes++; totalGeral.conversoes++; }
    if (e1.startsWith('OK') && !c.threadId) { stats[cat].semThread++; totalGeral.semThread++; }
    if (e1.includes(hoje)) { stats[cat].hojeEmail1++; totalGeral.hojeEmail1++; }
    if (f1.includes(hoje)) { stats[cat].hojeFup1++; totalGeral.hojeFup1++; }
    if (f2.includes(hoje)) { stats[cat].hojeFup2++; totalGeral.hojeFup2++; }
  }

  return { painel: allPainel, templates: allTemplates, stats, totalGeral, totalContatos: allContacts.length };
}

export async function readConfig(spreadsheetId?: string): Promise<Record<string, string>> {
  try {
    const rows = await readSheet('Config!A:B', spreadsheetId);
    const config: Record<string, string> = {};
    for (const row of rows) {
      if (row[0]) config[row[0]] = row[1] || '';
    }
    return config;
  } catch { return {}; }
}

export async function writeConfig(key: string, value: string, spreadsheetId?: string): Promise<void> {
  const sid = spreadsheetId || SPREADSHEET_ID;
  const doWrite = async () => {
    const rows = await readSheet('Config!A:B', sid);
    for (let i = 0; i < rows.length; i++) {
      if ((rows[i][0] || '') === key) {
        await writeSheet('Config!A' + (i + 1) + ':B' + (i + 1), [[key, value]], sid);
        return;
      }
    }
    await appendSheet('Config!A:B', [[key, value]], sid);
  };
  try {
    await doWrite();
  } catch {
    try {
      const sheets = getSheets();
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: sid,
        requestBody: { requests: [{ addSheet: { properties: { title: 'Config' } } }] },
      });
      await writeSheet('Config!A1:B1', [['key', 'value']], sid);
      await appendSheet('Config!A:B', [[key, value]], sid);
    } catch { /* best-effort */ }
  }
}

export async function appendContacts(contacts: any[][], spreadsheetId?: string) {
  await appendSheet('Contatos!A:G', contacts, spreadsheetId);
}

export async function appendLog(
  rotina: string, categoria: string, quantidade: number,
  status: 'ok' | 'erro', detalhes: string, spreadsheetId?: string
) {
  const sid = spreadsheetId || SPREADSHEET_ID;
  const now = new Date();
  const spStr = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(now).replace('T', ' ');
  const ts = spStr; // format: "2026-03-16 16:57:01"
  const row = [[ts, rotina, categoria, quantidade, status, detalhes]];
  try {
    await appendSheet('Logs!A:F', row, sid);
  } catch {
    try {
      const sheets = getSheets();
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: sid,
        requestBody: { requests: [{ addSheet: { properties: { title: 'Logs' } } }] },
      });
      await writeSheet('Logs!A1:F1', [['Timestamp', 'Rotina', 'Categoria', 'Qtd', 'Status', 'Detalhes']], sid);
      await appendSheet('Logs!A:F', row, sid);
    } catch { /* best-effort */ }
  }
}

export async function readLogs(spreadsheetId?: string, limit = 150) {
  try {
    const rows = await readSheet('Logs!A:F', spreadsheetId);
    if (rows.length < 2) return [];
    return rows.slice(1)
      .filter((r: any[]) => r[0])
      .map((r: any[]) => ({
        timestamp: r[0] || '',
        rotina: r[1] || '',
        categoria: r[2] || '',
        quantidade: parseInt(r[3]) || 0,
        status: r[4] || '',
        detalhes: r[5] || '',
      }))
      .slice(-limit)
      .reverse();
  } catch {
    return [];
  }
}

async function getSheetId(sheetName: string, spreadsheetId?: string): Promise<number | null> {
  const sheets = getSheets();
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: spreadsheetId || SPREADSHEET_ID });
  const sheet = spreadsheet.data.sheets?.find(
    (s: any) => s.properties?.title === sheetName
  );
  return sheet?.properties?.sheetId ?? null;
}

async function deleteRowsByCategory(sheetName: string, category: string, spreadsheetId?: string): Promise<number> {
  const sheets = getSheets();
  const sid = spreadsheetId || SPREADSHEET_ID;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sid,
    range: sheetName + '!A:K',
  });
  const rows = res.data.values || [];
  if (rows.length < 2) return 0;

  const header = rows[0];
  const catColIndex = header.findIndex((h: string) => h.toString().toUpperCase() === 'CATEGORY');
  if (catColIndex === -1) return 0;

  const rowsToDelete: number[] = [];
  for (let i = rows.length - 1; i >= 1; i--) {
    const rowCat = (rows[i][catColIndex] || '').toString().trim();
    if (rowCat.toLowerCase() === category.toLowerCase()) {
      rowsToDelete.push(i);
    }
  }

  if (rowsToDelete.length === 0) return 0;

  const sheetId = await getSheetId(sheetName, sid);
  if (sheetId === null) return 0;

  const requests = rowsToDelete.map(rowIndex => ({
    deleteDimension: {
      range: {
        sheetId: sheetId,
        dimension: 'ROWS' as const,
        startIndex: rowIndex,
        endIndex: rowIndex + 1,
      },
    },
  }));

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sid,
    requestBody: { requests },
  });

  return rowsToDelete.length;
}

async function deleteRowsByFirstColumn(sheetName: string, value: string, spreadsheetId?: string): Promise<number> {
  const sheets = getSheets();
  const sid = spreadsheetId || SPREADSHEET_ID;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sid,
    range: sheetName + '!A:A',
  });
  const rows = res.data.values || [];
  if (rows.length < 2) return 0;

  const rowsToDelete: number[] = [];
  for (let i = rows.length - 1; i >= 1; i--) {
    const cellValue = (rows[i]?.[0] || '').toString().trim();
    if (cellValue.toLowerCase() === value.toLowerCase()) {
      rowsToDelete.push(i);
    }
  }

  if (rowsToDelete.length === 0) return 0;

  const sheetId = await getSheetId(sheetName, sid);
  if (sheetId === null) return 0;

  const requests = rowsToDelete.map(rowIndex => ({
    deleteDimension: {
      range: {
        sheetId: sheetId,
        dimension: 'ROWS' as const,
        startIndex: rowIndex,
        endIndex: rowIndex + 1,
      },
    },
  }));

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sid,
    requestBody: { requests },
  });

  return rowsToDelete.length;
}

export async function clearContactsByCategory(category: string, spreadsheetId?: string): Promise<number> {
  return deleteRowsByCategory('Contatos', category, spreadsheetId);
}

export async function deleteCategoryFromPainel(category: string, spreadsheetId?: string): Promise<number> {
  return deleteRowsByFirstColumn('Painel', category, spreadsheetId);
}

export async function deleteCategoryFromTemplates(category: string, spreadsheetId?: string): Promise<number> {
  return deleteRowsByFirstColumn('Templates', category, spreadsheetId);
}

export async function writeAtendido(rowIndex: number, value: string, spreadsheetId?: string): Promise<void> {
  await writeSheet('Contatos!L' + rowIndex, [[value]], spreadsheetId);
}

// ── Clientes (base de clientes atuais) ───────────────────────────────────────

export async function readClientes(spreadsheetId?: string): Promise<{ empresa: string; email: string }[]> {
  try {
    const rows = await readSheet('Clientes!A:B', spreadsheetId);
    if (rows.length < 2) return [];
    return rows.slice(1).filter(r => r[0] || r[1]).map(r => ({
      empresa: (r[0] || '').trim(),
      email: (r[1] || '').trim(),
    }));
  } catch { return []; }
}

export async function writeClientes(clients: string[][], spreadsheetId?: string): Promise<void> {
  const sid = spreadsheetId || SPREADSHEET_ID;
  const data = [['Empresa', 'Email'], ...clients];
  try {
    await writeSheet('Clientes!A1', data, sid);
  } catch {
    const sheets = getSheets();
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sid,
      requestBody: { requests: [{ addSheet: { properties: { title: 'Clientes' } } }] },
    });
    await writeSheet('Clientes!A1', data, sid);
  }
}

// ── Internal Chat ─────────────────────────────────────────────────────────────

export interface InternalMessage {
  id: string;
  de: string;
  para: string;
  mensagem: string;
  timestamp: string;
  lido: string;
  prospectRef: string;
}

export async function readInternalChats(userEmail: string): Promise<InternalMessage[]> {
  try {
    const rows = await readSheet('Chat!A:G');
    if (rows.length < 2) return [];
    return rows.slice(1)
      .filter((r: any[]) => r[1] === userEmail || r[2] === userEmail)
      .map((r: any[]) => ({
        id: r[0] || '',
        de: r[1] || '',
        para: r[2] || '',
        mensagem: r[3] || '',
        timestamp: r[4] || '',
        lido: r[5] || 'NAO',
        prospectRef: r[6] || '',
      }));
  } catch { return []; }
}

export async function appendInternalChat(
  de: string, para: string, mensagem: string, prospectRef = ''
): Promise<string> {
  const id = Date.now().toString();
  const timestamp = new Date().toISOString();
  try {
    await appendSheet('Chat!A:G', [[id, de, para, mensagem, timestamp, 'NAO', prospectRef]]);
  } catch {
    // create sheet if it doesn't exist
    const sheets = getSheets();
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: 'Chat' } } }] },
    });
    await writeSheet('Chat!A1:G1', [['id', 'de', 'para', 'mensagem', 'timestamp', 'lido', 'prospectRef']]);
    await appendSheet('Chat!A:G', [[id, de, para, mensagem, timestamp, 'NAO', prospectRef]]);
  }
  return id;
}

export async function markChatRead(userEmail: string, fromEmail: string): Promise<void> {
  try {
    const rows = await readSheet('Chat!A:G');
    if (rows.length < 2) return;
    const sheets = getSheets();
    const updates: any[] = [];
    rows.slice(1).forEach((r: any[], i: number) => {
      if (r[2] === userEmail && r[1] === fromEmail && r[5] !== 'SIM') {
        updates.push({ range: `Chat!F${i + 2}`, values: [['SIM']] });
      }
    });
    if (updates.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: { valueInputOption: 'USER_ENTERED', data: updates },
      });
    }
  } catch { /* best-effort */ }
}

// ── Teses ──────────────────────────────────────────────────────────────────────

export interface Tese {
  id: string;
  rowIndex: number;
  tese: string;
  template: string;
  potenciaisClientes: string;
  status: 'NOVA' | 'APROVACAO' | 'APROVADA' | 'AJUSTE';
  criadoPor: string;
  nomeRemetente: string;
  aprovador: string;
  threadId: string;
  comentarios: { autor: string; texto: string; timestamp: string }[];
  dataCriacao: string;
  categoria: string;
  senderEmail: string;
}

export async function readTeses(spreadsheetId?: string): Promise<Tese[]> {
  try {
    const rows = await readSheet('Teses!A:M', spreadsheetId);
    if (rows.length < 2) return [];
    return rows.slice(1).map((r, i) => ({ r, actualRow: i + 2 })).filter(({ r }) => r[0]).map(({ r, actualRow }) => {
      let comentarios: { autor: string; texto: string; timestamp: string }[] = [];
      try { comentarios = JSON.parse(r[9] || '[]'); } catch { comentarios = []; }
      return {
        id: r[0] || '',
        rowIndex: actualRow,
        tese: r[1] || '',
        template: r[2] || '',
        potenciaisClientes: r[3] || '',
        status: (r[4] || 'NOVA') as Tese['status'],
        criadoPor: r[5] || '',
        nomeRemetente: r[6] || '',
        aprovador: r[7] || '',
        threadId: r[8] || '',
        comentarios,
        dataCriacao: r[10] || '',
        categoria: r[11] || '',
        senderEmail: r[12] || '',
      };
    });
  } catch { return []; }
}

export async function appendTese(
  tese: Omit<Tese, 'id' | 'rowIndex'>,
  spreadsheetId?: string
): Promise<string> {
  const sid = spreadsheetId || SPREADSHEET_ID;
  const id = Date.now().toString();
  const row = [
    id,
    tese.tese,
    tese.template,
    tese.potenciaisClientes,
    tese.status || 'NOVA',
    tese.criadoPor,
    tese.nomeRemetente,
    tese.aprovador,
    tese.threadId,
    JSON.stringify(tese.comentarios || []),
    tese.dataCriacao || new Date().toISOString(),
    tese.categoria || '',
  ];
  try {
    await appendSheet('Teses!A:L', [row], sid);
  } catch {
    const sheets = getSheets();
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sid,
      requestBody: { requests: [{ addSheet: { properties: { title: 'Teses' } } }] },
    });
    await writeSheet('Teses!A1:L1', [['ID', 'Tese', 'Template', 'PotenciaisClientes', 'Status', 'CriadoPor', 'NomeRemetente', 'Aprovador', 'ThreadId', 'Comentarios', 'DataCriacao', 'Categoria']], sid);
    await appendSheet('Teses!A:L', [row], sid);
  }
  return id;
}

export async function updateTese(
  rowIndex: number,
  fields: Partial<{
    tese: string;
    template: string;
    potenciaisClientes: string;
    status: string;
    criadoPor: string;
    nomeRemetente: string;
    aprovador: string;
    threadId: string;
    comentarios: { autor: string; texto: string; timestamp: string }[];
    dataCriacao: string;
    categoria: string;
    senderEmail: string;
  }>,
  spreadsheetId?: string
): Promise<void> {
  const sid = spreadsheetId || SPREADSHEET_ID;
  const sheets = getSheets();
  const updates: { range: string; values: any[][] }[] = [];

  const colMap: Record<string, string> = {
    tese: 'B', template: 'C', potenciaisClientes: 'D', status: 'E',
    criadoPor: 'F', nomeRemetente: 'G', aprovador: 'H', threadId: 'I',
    comentarios: 'J', dataCriacao: 'K', categoria: 'L', senderEmail: 'M',
  };

  for (const [key, val] of Object.entries(fields)) {
    const col = colMap[key];
    if (!col) continue;
    const value = key === 'comentarios' ? JSON.stringify(val) : val;
    updates.push({ range: `Teses!${col}${rowIndex}`, values: [[value]] });
  }

  if (updates.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: sid,
      requestBody: { valueInputOption: 'USER_ENTERED', data: updates },
    });
  }
}