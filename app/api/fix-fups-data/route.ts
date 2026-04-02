import { NextResponse } from 'next/server';
import { readContatos, getAllSpreadsheetIds, getSheets } from '@/lib/sheets';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Parse corrupted field: "Name;LastName;Company;OrigCategory;status;;email@domain.com"
function parseCorrupted(raw: string) {
  const parts = raw.split(';');
  // Find email (has @)
  const emailPart = parts.find(p => p.includes('@')) || '';
  const firstName = (parts[0] || '').trim();
  const lastName = (parts[1] || '').trim();
  const companyName = (parts[2] || '').trim();
  const origCategory = (parts[3] || '').trim();
  const status = (parts[4] || '').trim();
  return { firstName, lastName, companyName, origCategory, status, email: emailPart.trim() };
}

function isCorrupted(c: any): boolean {
  const raw = (c.firstName || '').toString();
  return raw.includes(';') && raw.includes('@');
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const execute = url.searchParams.get('execute') === 'true';

  const allIds = getAllSpreadsheetIds();
  const spreadsheetId = allIds[0];
  const { contacts } = await readContatos(spreadsheetId);

  const fupContacts = contacts.filter(c =>
    c.category.toLowerCase().includes('fup') && c.category.toLowerCase().includes('respondido')
  );

  const corrupted = fupContacts.filter(isCorrupted);

  if (!execute) {
    const clean = fupContacts.filter(c => !isCorrupted(c));
    const preview = corrupted.slice(0, 10).map(c => {
      const parsed = parseCorrupted(c.firstName);
      return {
        row: c.rowIndex,
        before: { firstName: c.firstName.slice(0, 60), email: c.email.slice(0, 40) },
        after: parsed,
      };
    });
    return NextResponse.json({
      category: fupContacts[0]?.category || 'not found',
      totalFup: fupContacts.length,
      corrupted: corrupted.length,
      alreadyClean: clean.length,
      preview,
      note: 'Adicione ?execute=true na URL para executar a correcao',
    });
  }

  // Execute the fix using batchUpdate for speed
  if (corrupted.length === 0) {
    return NextResponse.json({ fixed: 0, message: 'Nenhum contato corrompido encontrado' });
  }

  const sheets = getSheets();
  const data = corrupted.map(c => {
    const parsed = parseCorrupted(c.firstName);
    return {
      range: 'Contatos!A' + c.rowIndex + ':D' + c.rowIndex,
      values: [[parsed.firstName, parsed.lastName, parsed.companyName, parsed.email]],
    };
  });

  try {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: { valueInputOption: 'USER_ENTERED', data },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }

  return NextResponse.json({
    fixed: corrupted.length,
    total: corrupted.length,
    message: corrupted.length + ' contatos corrigidos na planilha',
  });
}

export async function POST() {
  const allIds = getAllSpreadsheetIds();
  const spreadsheetId = allIds[0];
  const { contacts } = await readContatos(spreadsheetId);

  const fupContacts = contacts.filter(c =>
    c.category.toLowerCase().includes('fup') && c.category.toLowerCase().includes('respondido')
  );

  const corrupted = fupContacts.filter(isCorrupted);

  if (corrupted.length === 0) {
    return NextResponse.json({ fixed: 0, message: 'Nenhum contato corrompido encontrado' });
  }

  let fixed = 0;
  const errors: string[] = [];

  // Process in batches to avoid quota limits
  for (const c of corrupted) {
    try {
      const parsed = parseCorrupted(c.firstName);
      // Write corrected: A=firstName, B=lastName, C=companyName, D=email
      await writeSheet(
        'Contatos!A' + c.rowIndex + ':D' + c.rowIndex,
        [[parsed.firstName, parsed.lastName, parsed.companyName, parsed.email]],
        spreadsheetId
      );
      fixed++;
      // Small delay to avoid quota
      if (fixed % 20 === 0) {
        await new Promise(r => setTimeout(r, 1000));
      }
    } catch (e: any) {
      errors.push(`Row ${c.rowIndex}: ${e.message}`);
    }
  }

  return NextResponse.json({
    fixed,
    total: corrupted.length,
    errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
    message: `${fixed}/${corrupted.length} contatos corrigidos na planilha`,
  });
}
