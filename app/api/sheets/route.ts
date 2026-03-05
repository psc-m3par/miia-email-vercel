import { NextRequest, NextResponse } from 'next/server';
import { readPainel, readTemplates, readContatos, writeSheet, appendSheet, clearContactsByCategory, deleteCategoryFromPainel, deleteCategoryFromTemplates } from '@/lib/sheets';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type');

  try {
    if (type === 'painel') {
      const data = await readPainel();
      return NextResponse.json(data);
    }
    if (type === 'templates') {
      const data = await readTemplates();
      return NextResponse.json(data);
    }
    if (type === 'contacts') {
      const data = await readContatos();
      return NextResponse.json(data);
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
    const { type, values } = body;

    if (type === 'painel') {
      await appendSheet('Painel!A:H', [values]);
      return NextResponse.json({ success: true });
    }
    if (type === 'templates') {
      await appendSheet('Templates!A:G', [values]);
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
    const { type, rowIndex, values } = body;

    if (type === 'painel') {
      const range = 'Painel!A' + rowIndex + ':H' + rowIndex;
      await writeSheet(range, [values]);
      return NextResponse.json({ success: true });
    }
    if (type === 'templates') {
      const range = 'Templates!A' + rowIndex + ':G' + rowIndex;
      await writeSheet(range, [values]);
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

    let deletedContacts = 0;
    let deletedPainel = 0;
    let deletedTemplates = 0;

    deletedContacts = await clearContactsByCategory(category);

    if (deleteFromPainel) {
      deletedPainel = await deleteCategoryFromPainel(category);
    }

    if (deleteFromTemplates) {
      deletedTemplates = await deleteCategoryFromTemplates(category);
    }

    return NextResponse.json({ success: true, deleted: deletedContacts, deletedPainel, deletedTemplates });
  } catch (error: any) {
    console.error('Delete error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}