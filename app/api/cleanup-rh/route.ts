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

  // Match by email OR by checking if any RH email appears inside the contact's fields
  // (handles corrupted imports where all fields are in one cell)
  const matchesRH = (c: any) => {
    const emailLower = (c.email || '').toLowerCase().trim();
    if (emailLower && rhEmails.has(emailLower)) return true;
    // Check if any RH email appears in firstName/lastName/email/companyName (corrupted data)
    const allFields = [c.firstName, c.lastName, c.companyName, c.email].join(' ').toLowerCase();
    for (const rhEmail of Array.from(rhEmails)) {
      if (allFields.includes(rhEmail)) return true;
    }
    return false;
  };

  const toRemove = fupContacts.filter(matchesRH);
  const toKeep = fupContacts.filter(c => !matchesRH(c));

  return NextResponse.json({
    rhEmailsCount: rhEmails.size,
    fupCategory: fupCatName,
    fupTotal: fupContacts.length,
    toRemoveCount: toRemove.length,
    toKeepCount: toKeep.length,
    toRemovePreview: toRemove.slice(0, 10).map(c => ({ email: c.email, name: c.firstName + ' ' + c.lastName, row: c.rowIndex })),
    sampleFupContact: fupContacts.slice(0, 3).map(c => ({ firstName: c.firstName, lastName: c.lastName, email: c.email, company: c.companyName })),
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

  const rhEmailArr = Array.from(rhEmails);
  const matchesRH = (c: any) => {
    const emailLower = (c.email || '').toLowerCase().trim();
    if (emailLower && rhEmails.has(emailLower)) return true;
    const allFields = [c.firstName, c.lastName, c.companyName, c.email].join(' ').toLowerCase();
    for (const rhEmail of rhEmailArr) {
      if (allFields.includes(rhEmail)) return true;
    }
    return false;
  };

  const rowsToDelete = contacts
    .filter(c =>
      c.category.normalize('NFC') === fupCatName.normalize('NFC') &&
      matchesRH(c)
    )
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
