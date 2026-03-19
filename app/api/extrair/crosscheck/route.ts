import { NextRequest, NextResponse } from 'next/server';
import { readContatos, getAllSpreadsheetIds } from '@/lib/sheets';

export const dynamic = 'force-dynamic';

function getStatus(c: any): string {
  if (c.fup1Enviado === 'RESPONDIDO' || c.fup2Enviado === 'RESPONDIDO') return 'respondido';
  if (c.fup1Enviado === 'BOUNCE' || c.fup2Enviado === 'BOUNCE' || c.email1Enviado.startsWith('BOUNCE')) return 'bounced';
  if (c.email1Enviado.startsWith('ERRO') || c.fup1Enviado.startsWith('ERRO') || c.fup2Enviado.startsWith('ERRO')) return 'erro';
  if (c.fup2Enviado.startsWith('OK')) return 'fup2_enviado';
  if (c.fup1Enviado.startsWith('OK')) return 'fup1_enviado';
  if (c.email1Enviado.startsWith('OK')) return 'email1_enviado';
  if (!c.email1Enviado) return 'pendente';
  return 'outro';
}

export async function POST(req: NextRequest) {
  try {
    const { exactContacts } = await req.json();

    if (!exactContacts || !Array.isArray(exactContacts)) {
      return NextResponse.json({ error: 'Nenhum contato enviado' }, { status: 400 });
    }

    // Read existing contacts from sheet
    const spreadsheetId = getAllSpreadsheetIds()[0];
    const { contacts: sheetContacts } = await readContatos(spreadsheetId);

    // Build lookup by email (lowercase, trimmed)
    const emailLookup: Record<string, any> = {};
    for (const c of sheetContacts) {
      if (c.email) {
        const key = c.email.toLowerCase().trim();
        if (!emailLookup[key]) {
          emailLookup[key] = {
            status: getStatus(c),
            pipeline: c.pipeline || '',
            email1Enviado: c.email1Enviado,
            fup1Enviado: c.fup1Enviado,
            fup2Enviado: c.fup2Enviado,
            category: c.category,
          };
        }
      }
    }

    // Enrich exact contacts with sheet data
    const enriched = exactContacts.map((ec: any) => {
      const match = ec.email ? emailLookup[ec.email.toLowerCase().trim()] : null;
      return {
        ...ec,
        matched: !!match,
        status: match?.status || 'nao_encontrado',
        pipeline: match?.pipeline || '',
        sheetCategory: match?.category || '',
      };
    });

    const totalMatched = enriched.filter((c: any) => c.matched).length;
    const totalUnmatched = enriched.filter((c: any) => !c.matched).length;

    return NextResponse.json({
      contacts: enriched,
      stats: {
        total: enriched.length,
        matched: totalMatched,
        unmatched: totalUnmatched,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
