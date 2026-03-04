import { NextRequest, NextResponse } from 'next/server';
import { readPainel, readTemplates, readContatos, writeSheet, clearContactsByCategory } from '@/lib/sheets';

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
    const { category } = body;

    if (!category) {
      return NextResponse.json({ error: 'Category obrigatoria' }, { status: 400 });
    }

    const deleted = await clearContactsByCategory(category);
    return NextResponse.json({ success: true, deleted });
  } catch (error: any) {
    console.error('Delete error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

**Ctrl+S**. Agora verifica que salvou certo:
```
Select-String "className" app/api/sheets/route.ts