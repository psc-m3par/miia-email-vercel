import { NextResponse } from 'next/server';
import { writeSheet, getAllSpreadsheetIds } from '@/lib/sheets';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const sid = getAllSpreadsheetIds()[0];
    // Clear everything and write fresh header
    const emptyRows = [];
    for (let i = 0; i < 99; i++) {
      emptyRows.push(['', '', '', '', '', '', '', '', '', '', '', '', '']);
    }
    await writeSheet('Teses!A1:M100', [
      ['ID', 'Tese', 'Template', 'PotenciaisClientes', 'Status', 'CriadoPor', 'NomeRemetente', 'Aprovador', 'ThreadId', 'Comentarios', 'DataCriacao', 'Categoria', 'SenderEmail'],
      ...emptyRows
    ], sid);
    return NextResponse.json({ ok: true, message: 'Teses sheet reset with header' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
