import { NextRequest, NextResponse } from 'next/server';
import { readContatos, readClientes, getAllSpreadsheetIds, FUP_CONFIG } from '@/lib/sheets';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { contacts } = await req.json();
    const spreadsheetId = getAllSpreadsheetIds()[0];

    const [{ contacts: existingContatos }, clientes] = await Promise.all([
      readContatos(spreadsheetId),
      readClientes(spreadsheetId),
    ]);

    // Build lookup sets
    const contatosEmailMap = new Map<string, { category: string; status: string }>();
    for (const c of existingContatos) {
      const email = c.email.toLowerCase().trim();
      if (email) {
        // Check from fup10 down to fup1 for the highest stage reached
        let status = c.email1Enviado ? 'E1' : 'pendente';
        for (const f of FUP_CONFIG) {
          if (c[f.curField]) status = `FUP${f.n}`;
        }
        contatosEmailMap.set(email, { category: c.category, status });
      }
    }

    const clientesEmailSet = new Set(
      clientes.map(c => c.email.toLowerCase().trim()).filter(Boolean)
    );

    // Normalize company names for matching
    const normalize = (s: string) => s.toLowerCase().trim()
      .replace(/\s*(s\.?a\.?|ltda\.?|inc\.?|llc|ltd|group|corp\.?|co\.?)\s*$/i, '')
      .trim();

    const clientesCompanySet = new Set(
      clientes.map(c => normalize(c.empresa)).filter(Boolean)
    );

    // Annotate each contact
    const annotated = contacts.map((c: any) => {
      const email = (c.email || '').toLowerCase().trim();
      const company = normalize(c.companyName || '');

      const existing = email ? contatosEmailMap.get(email) : undefined;
      const isDuplicate = !!existing;
      const isClientByEmail = clientesEmailSet.has(email);
      const isClientByCompany = company ? clientesCompanySet.has(company) : false;
      const isClient = isClientByEmail || isClientByCompany;

      return {
        ...c,
        flags: {
          duplicata: isDuplicate,
          duplicataInfo: existing ? `${existing.status} em ${existing.category}` : null,
          clienteAtual: isClient,
          clienteMatchType: isClientByEmail ? 'email' : isClientByCompany ? 'empresa' : null,
        },
      };
    });

    return NextResponse.json({
      contacts: annotated,
      stats: {
        total: annotated.length,
        duplicatas: annotated.filter((c: any) => c.flags.duplicata).length,
        clientesAtuais: annotated.filter((c: any) => c.flags.clienteAtual).length,
        limpos: annotated.filter((c: any) => !c.flags.duplicata && !c.flags.clienteAtual).length,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
