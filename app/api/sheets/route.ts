import { NextRequest, NextResponse } from 'next/server';
import { readPainel, readTemplates, readContatos, writeSheet, appendSheet, clearContactsByCategory } from '@/lib/sheets';

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

**Ctrl+S**. Agora abre o `app/templates/page.tsx`. Acha a funcao `handleCreate` e troca o bloco do `fetch` dentro dela. Procura isso:
```
      const rowIndex = templates.length + 2;
      const res = await fetch('/api/sheets', {
        method: 'PUT',
```

E troca por:
```
      const res = await fetch('/api/sheets', {
        method: 'POST',
```

E apaga a linha `const rowIndex = templates.length + 2;` e o `rowIndex: rowIndex,` do body.

Na verdade, mais facil — abre o `app/templates/page.tsx`, acha a funcao `handleCreate` e substitui o bloco `try` inteiro por:

Procura:
```
      const rowIndex = templates.length + 2;
      const res = await fetch('/api/sheets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'templates',
          rowIndex: rowIndex,
          values: [newTemplate.category, newTemplate.assunto, newTemplate.corpo, newTemplate.fup1Assunto, newTemplate.fup1Corpo, newTemplate.fup2Assunto, newTemplate.fup2Corpo],
        }),
      });
```

Troca por:
```
      const res = await fetch('/api/sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'templates',
          values: [newTemplate.category, newTemplate.assunto, newTemplate.corpo, newTemplate.fup1Assunto, newTemplate.fup1Corpo, newTemplate.fup2Assunto, newTemplate.fup2Corpo],
        }),
      });
```

Faz o mesmo no `app/settings/page.tsx` — acha `handleCreateCategory`, procura:
```
      const rowIndex = painel.length + 2;
      await fetch('/api/sheets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'painel',
          rowIndex: rowIndex,
          values: [newCat.category, newCat.responsavel, newCat.nomeRemetente, newCat.emailsHora, newCat.diasFup1, newCat.diasFup2, newCat.ativo ? 'SIM' : 'NAO', newCat.cc],
        }),
      });
```

Troca por:
```
      await fetch('/api/sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'painel',
          values: [newCat.category, newCat.responsavel, newCat.nomeRemetente, newCat.emailsHora, newCat.diasFup1, newCat.diasFup2, newCat.ativo ? 'SIM' : 'NAO', newCat.cc],
        }),
      });