import { NextResponse } from 'next/server';
import { readContatos, getAllSpreadsheetIds, getSheetId, getSheets } from '@/lib/sheets';

export const dynamic = 'force-dynamic';

export async function GET() {
  const allIds = getAllSpreadsheetIds();
  const spreadsheetId = allIds[0];
  const { contacts } = await readContatos(spreadsheetId);

  const rhEmails = new Set(
    contacts
      .filter(c => c.category.normalize('NFC') === 'RH Grandes empresas'.normalize('NFC'))
      .map(c => c.email.toLowerCase().trim())
      .filter(Boolean)
  );

  // Find the FUP category by partial match
  const allCats = Array.from(new Set(contacts.map(c => c.category)));
  const fupCatName = allCats.find(cat =>
    cat.toLowerCase().includes('fup') && cat.toLowerCase().includes('respondido')
  ) || allCats.find(cat =>
    cat.toLowerCase().includes('fup 1')
  );

  if (!fupCatName) {
    return NextResponse.json({
      error: 'Categoria FUP nao encontrada',
      allCategories: allCats,
    });
  }

  const fupContacts = contacts.filter(c =>
    c.category.normalize('NFC') === fupCatName.normalize('NFC')
  );

  // Data is corrupted: all fields contain the full row like "Name;;Company;Category;status;;email@domain.com"
  // Extract the real email from any field, and check if original category contains "RH"
  const extractInfo = (c: any) => {
    const raw = (c.firstName || c.email || '').toString();
    const emailMatch = raw.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const realEmail = emailMatch ? emailMatch[0].toLowerCase() : '';
    const parts = raw.split(';');
    // Format: Name;LastName;Company;OriginalCategory;status;;email
    const origCategory = parts[3] || '';
    return { realEmail, origCategory, raw };
  };

  const toRemove = fupContacts.filter(c => {
    const info = extractInfo(c);
    // Match by email in RH set OR by original category being "RH Grandes empresas"
    return rhEmails.has(info.realEmail) || info.origCategory.trim() === 'RH Grandes empresas';
  });
  const toKeep = fupContacts.filter(c => {
    const info = extractInfo(c);
    return !rhEmails.has(info.realEmail) && info.origCategory.trim() !== 'RH Grandes empresas';
  });

  return NextResponse.json({
    rhEmailsCount: rhEmails.size,
    fupCategory: fupCatName,
    fupTotal: fupContacts.length,
    toRemoveCount: toRemove.length,
    toKeepCount: toKeep.length,
    toRemovePreview: toRemove.slice(0, 15).map(c => {
      const info = extractInfo(c);
      return { realEmail: info.realEmail, origCategory: info.origCategory, row: c.rowIndex };
    }),
    sampleFupData: fupContacts.slice(0, 5).map(c => {
      const info = extractInfo(c);
      return { realEmail: info.realEmail, origCategory: info.origCategory, raw: info.raw.slice(0, 80) };
    }),
    note: 'Use POST para executar a limpeza',
  });
}

export async function POST() {
  const allIds = getAllSpreadsheetIds();
  const spreadsheetId = allIds[0];
  const { contacts } = await readContatos(spreadsheetId);

  const rhEmails = new Set(
    contacts
      .filter(c => c.category.normalize('NFC') === 'RH Grandes empresas'.normalize('NFC'))
      .map(c => c.email.toLowerCase().trim())
      .filter(Boolean)
  );

  const allCats = Array.from(new Set(contacts.map(c => c.category)));
  const fupCatName = allCats.find(cat =>
    cat.toLowerCase().includes('fup') && cat.toLowerCase().includes('respondido')
  ) || allCats.find(cat =>
    cat.toLowerCase().includes('fup 1')
  );

  if (!fupCatName) {
    return NextResponse.json({ error: 'Categoria FUP nao encontrada' }, { status: 400 });
  }

  const extractInfo = (c: any) => {
    const raw = (c.firstName || c.email || '').toString();
    const emailMatch = raw.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const realEmail = emailMatch ? emailMatch[0].toLowerCase() : '';
    const parts = raw.split(';');
    const origCategory = parts[3] || '';
    return { realEmail, origCategory };
  };

  const rowsToDelete = contacts
    .filter(c => {
      if (c.category.normalize('NFC') !== fupCatName.normalize('NFC')) return false;
      const info = extractInfo(c);
      return rhEmails.has(info.realEmail) || info.origCategory.trim() === 'RH Grandes empresas';
    })
    .map(c => c.rowIndex)
    .sort((a, b) => b - a);

  if (rowsToDelete.length === 0) {
    return NextResponse.json({ removed: 0, message: 'Nenhum contato de RH encontrado na base FUP' });
  }

  const sheetId = await getSheetId('Contatos', spreadsheetId);
  if (sheetId === null) {
    return NextResponse.json({ error: 'Sheet Contatos nao encontrada' }, { status: 500 });
  }

  const sheets = getSheets();
  const requests = rowsToDelete.map(rowIndex => ({
    deleteDimension: {
      range: {
        sheetId: sheetId,
        dimension: 'ROWS' as const,
        startIndex: rowIndex - 1,
        endIndex: rowIndex,
      },
    },
  }));

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });

  return NextResponse.json({
    removed: rowsToDelete.length,
    message: `${rowsToDelete.length} contatos de "RH Grandes empresas" removidos da base "${fupCatName}"`,
  });
}
