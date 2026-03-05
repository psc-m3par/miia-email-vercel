import { NextRequest, NextResponse } from 'next/server';
import { appendContacts, readPainel, writeSheet } from '@/lib/sheets';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { contacts, category } = body;

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return NextResponse.json({ error: 'Nenhum contato valido' }, { status: 400 });
    }

    const painel = await readPainel();
    const catExists = painel.some(p => p.category.toLowerCase() === category.toLowerCase());

    if (!catExists) {
      return NextResponse.json({
        error: 'Category "' + category + '" nao existe no Painel. Categories disponiveis: ' + painel.map(p => p.category).join(', '),
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

    await appendContacts(validRows);

    await writeSheet('Painel!J1', [['ENVIAR']]);

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