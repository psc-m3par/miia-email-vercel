import { NextResponse } from 'next/server';
import { getSheets, getAllSpreadsheetIds } from '@/lib/sheets';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function parseCorrupted(raw: string) {
  const parts = raw.split(';');
  const emailPart = parts.find(p => p.includes('@')) || '';
  return {
    firstName: (parts[0] || '').trim(),
    lastName: (parts[1] || '').trim(),
    companyName: (parts[2] || '').trim(),
    email: emailPart.trim(),
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const execute = url.searchParams.get('execute') === 'true';

  const sheets = getSheets();
  const spreadsheetId = getAllSpreadsheetIds()[0];

  // Read only columns A:G (up to category) to find the FUP rows
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Contatos!A:G',
  });
  const rows = res.data.values || [];

  // Find rows where category contains "fup" and "respondido", and firstName contains ";"
  const corrupted: { rowIndex: number; firstName: string }[] = [];
  for (let i = 1; i < rows.length; i++) {
    const cat = (rows[i][6] || '').toString().toLowerCase();
    const firstName = (rows[i][0] || '').toString();
    if (cat.includes('fup') && cat.includes('respondido') && firstName.includes(';') && firstName.includes('@')) {
      corrupted.push({ rowIndex: i + 1, firstName });
    }
  }

  if (!execute) {
    const preview = corrupted.slice(0, 5).map(c => ({
      row: c.rowIndex,
      before: c.firstName.slice(0, 70),
      after: parseCorrupted(c.firstName),
    }));
    return NextResponse.json({
      totalRows: rows.length - 1,
      corrupted: corrupted.length,
      preview,
      note: 'Adicione ?execute=true para executar',
    });
  }

  if (corrupted.length === 0) {
    return NextResponse.json({ fixed: 0, message: 'Nenhum corrompido' });
  }

  // Build batch update data
  const data = corrupted.map(c => {
    const parsed = parseCorrupted(c.firstName);
    return {
      range: 'Contatos!A' + c.rowIndex + ':D' + c.rowIndex,
      values: [[parsed.firstName, parsed.lastName, parsed.companyName, parsed.email]],
    };
  });

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: 'USER_ENTERED', data },
  });

  return NextResponse.json({
    fixed: corrupted.length,
    message: corrupted.length + ' contatos corrigidos',
  });
}
