import { NextRequest, NextResponse } from 'next/server';
import { appendContacts, readPainel, writeSheet, getSpreadsheetIdForResponsavel, getAllSpreadsheetIds } from '@/lib/sheets';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { contacts, category } = body;

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return NextResponse.json({ error: 'Nenhum contato valido' }, { status: 400 });
    }

    let targetSpreadsheet: string | undefined;
    let foundCategory = false;

    const allIds = getAllSpreadsheetIds();
    for (const id of allIds) {
      try {
        const painel = await readPainel(id);
        const match = painel.find(p => p.category.toLowerCase() === category.toLowerCase());
        if (match) {
          targetSpreadsheet = id;
          foundCategory = true;
          break;
        }
      } catch (e) {}
    }

    if (!foundCategory || !targetSpreadsheet) {
      return NextResponse.json({
        error: 'Category "' + category + '" nao encontrada em nenhuma planilha.',
      }, { status: 400 });
    }

    const rows = contacts.map((c: any) => [
      c.firstName || c['First Name'] || '',
      c.lastName || c['Last Name'] || '',
      c.companyName || c['Company Name'] || '',
      c.email || c['Email'] || '',
      c.mobilePhone || c['Mobile Phone'] || '',
      c.linkedinUrl || c['Person Linkedin Url'] || '',
      category,
    ]);

    const validRows = rows.filter((r: any[]) => r[3] && r[3].toString().includes('@'));

    if (validRows.length === 0) {
      return NextResponse.json({ error: 'Nenhum contato com email valido' }, { status: 400 });
    }

    await appendContacts(validRows, targetSpreadsheet);

    return NextResponse.json({
      success: true,
      total: contacts.length,
      valid: validRows.length,
      invalid: contacts.length - validRows.length,
      category,
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}