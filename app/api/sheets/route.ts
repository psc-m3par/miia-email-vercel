import { NextRequest, NextResponse } from 'next/server';
import { readPainel, readTemplates, writeSheet, readContatos } from '@/lib/sheets';

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
    return NextResponse.json({ error: 'Type inválido' }, { status: 400 });
  } catch (error: any) {
    console.error('Sheets read error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, rowIndex, values } = body;

    if (type === 'painel') {
      const range = `Painel!A${rowIndex}:H${rowIndex}`;
      await writeSheet(range, [values]);
      return NextResponse.json({ success: true });
    }
    if (type === 'templates') {
      const range = `Templates!A${rowIndex}:G${rowIndex}`;
      await writeSheet(range, [values]);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Type inválido' }, { status: 400 });
  } catch (error: any) {
    console.error('Sheets write error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
