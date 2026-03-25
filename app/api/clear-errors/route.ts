import { NextResponse } from 'next/server';
import { readContatos, writeSheet, getAllSpreadsheetIds } from '@/lib/sheets';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const { category } = await request.json();
    const spreadsheetId = getAllSpreadsheetIds()[0];
    const { contacts } = await readContatos(spreadsheetId);

    const errorContacts = contacts.filter(c => {
      if (category && c.category.normalize('NFC') !== category.normalize('NFC')) return false;
      return c.email1Enviado.startsWith('ERRO');
    });

    if (errorContacts.length === 0) {
      return NextResponse.json({ removed: 0, message: 'Nenhum erro encontrado' });
    }

    // Clear each error row completely
    for (const c of errorContacts) {
      await writeSheet(
        `Contatos!A${c.rowIndex}:N${c.rowIndex}`,
        [['', '', '', '', '', '', '', '', '', '', '', '', '', '']],
        spreadsheetId
      );
    }

    return NextResponse.json({ removed: errorContacts.length, category: category || 'todas' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
