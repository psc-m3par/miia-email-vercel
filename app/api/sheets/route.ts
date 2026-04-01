import { NextRequest, NextResponse } from 'next/server';
import { readPainel, readTemplates, readContatos, writeSheet, appendSheet, clearContactsByCategory, deleteCategoryFromPainel, deleteCategoryFromTemplates, getAllSpreadsheetIds, getSpreadsheetIdForResponsavel } from '@/lib/sheets';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type');
  const spreadsheetId = req.nextUrl.searchParams.get('spreadsheetId') || undefined;

  try {
    if (type === 'painel') {
      const allIds = getAllSpreadsheetIds();
      let allPainel: any[] = [];
      for (const id of allIds) {
        try {
          const data = await readPainel(id);
          allPainel = allPainel.concat(data);
        } catch (e) {}
      }
      return NextResponse.json(allPainel);
    }
    if (type === 'templates') {
      const allIds = getAllSpreadsheetIds();
      let allTemplates: any[] = [];
      for (const id of allIds) {
        try {
          const data = await readTemplates(id);
          allTemplates = allTemplates.concat(data);
        } catch (e) {}
      }
      return NextResponse.json(allTemplates);
    }
    if (type === 'contacts') {
      const allIds = getAllSpreadsheetIds();
      let allContacts: any[] = [];
      for (const id of allIds) {
        try {
          const { contacts } = await readContatos(id);
          allContacts = allContacts.concat(contacts);
        } catch (e) {}
      }
      return NextResponse.json({ headers: ['First Name', 'Last Name', 'Company Name', 'Email', 'Mobile Phone', 'Person Linkedin Url', 'Category', 'EMAIL1_ENVIADO', 'FUP1_ENVIADO', 'FUP2_ENVIADO', 'THREAD_ID'], contacts: allContacts });
    }
    return NextResponse.json({ error: 'Type invalido' }, { status: 400 });
  } catch (error: any) {
    console.error('Sheets read error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, values, responsavel } = body;

    const spreadsheetId = responsavel ? getSpreadsheetIdForResponsavel(responsavel) : undefined;

    if (type === 'painel') {
      await appendSheet('Painel!A:S', [values], spreadsheetId);
      return NextResponse.json({ success: true });
    }
    if (type === 'templates') {
      await appendSheet('Templates!A:W', [values], spreadsheetId);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Type invalido' }, { status: 400 });
  } catch (error: any) {
    console.error('Sheets append error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, rowIndex, values, responsavel } = body;

    let spreadsheetId: string | undefined;
    if (responsavel) {
      spreadsheetId = getSpreadsheetIdForResponsavel(responsavel);
    } else {
      const category = values?.[0];
      if (category) {
        const allIds = getAllSpreadsheetIds();
        for (const id of allIds) {
          try {
            const painel = await readPainel(id);
            const match = painel.find((p: any) => p.category.toLowerCase() === category.toLowerCase());
            if (match) { spreadsheetId = id; break; }
          } catch (e) {}
        }
      }
    }

    if (type === 'painel') {
      const range = 'Painel!A' + rowIndex + ':S' + rowIndex;
      await writeSheet(range, [values], spreadsheetId);
      return NextResponse.json({ success: true });
    }
    if (type === 'templates') {
      const range = 'Templates!A' + rowIndex + ':W' + rowIndex;
      await writeSheet(range, [values], spreadsheetId);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Type invalido' }, { status: 400 });
  } catch (error: any) {
    console.error('Sheets write error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { category, deleteFromPainel, deleteFromTemplates } = body;

    if (!category) {
      return NextResponse.json({ error: 'Category obrigatoria' }, { status: 400 });
    }

    let targetSpreadsheet: string | undefined;
    const allIds = getAllSpreadsheetIds();
    for (const id of allIds) {
      try {
        const painel = await readPainel(id);
        const match = painel.find((p: any) => p.category.toLowerCase() === category.toLowerCase());
        if (match) { targetSpreadsheet = id; break; }
      } catch (e) {}
    }

    let deletedContacts = 0;
    let deletedPainel = 0;
    let deletedTemplates = 0;

    deletedContacts = await clearContactsByCategory(category, targetSpreadsheet);

    if (deleteFromPainel) {
      deletedPainel = await deleteCategoryFromPainel(category, targetSpreadsheet);
    }

    if (deleteFromTemplates) {
      deletedTemplates = await deleteCategoryFromTemplates(category, targetSpreadsheet);
    }

    return NextResponse.json({ success: true, deleted: deletedContacts, deletedPainel, deletedTemplates });
  } catch (error: any) {
    console.error('Delete error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}