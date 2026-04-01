import { NextRequest, NextResponse } from 'next/server';
import { readContatos, getAllSpreadsheetIds, FUP_CONFIG, anyFupHasStatus } from '@/lib/sheets';

export const dynamic = 'force-dynamic';

// Determinar status de resposta de cada contato
function getStatus(c: any): string {
  if (anyFupHasStatus(c, 'RESPONDIDO')) return 'respondido';
  if (anyFupHasStatus(c, 'BOUNCE') || c.email1Enviado.startsWith('BOUNCE')) return 'bounced';
  if (c.email1Enviado.startsWith('ERRO') || FUP_CONFIG.some(f => (c[f.curField] || '').startsWith('ERRO'))) return 'erro';
  // Check from highest FUP down to find the latest sent stage
  for (let i = FUP_CONFIG.length - 1; i >= 0; i--) {
    const f = FUP_CONFIG[i];
    if ((c[f.curField] || '').startsWith('OK')) return `fup${f.n}_enviado`;
  }
  if (c.email1Enviado.startsWith('OK')) return 'email1_enviado';
  if (!c.email1Enviado) return 'pendente';
  return 'outro';
}

function filterContacts(contacts: any[], body: any) {
  const {
    categorias = [] as string[],
    statusResposta = [] as string[],
    statusPipe = [] as string[],
    campos = { email: true, whatsapp: true },
  } = body;

  let filtered = contacts;

  if (categorias.length > 0) {
    filtered = filtered.filter(c =>
      categorias.some((cat: string) => c.category.normalize('NFC') === cat.normalize('NFC'))
    );
  }

  if (statusResposta.length > 0) {
    filtered = filtered.filter(c => statusResposta.includes(getStatus(c)));
  }

  if (statusPipe.length > 0) {
    filtered = filtered.filter(c => statusPipe.includes(c.pipeline || 'SEM_PIPELINE'));
  }

  // Filtrar por campos selecionados: só inclui quem tem o dado
  if (campos.whatsapp && !campos.email) {
    filtered = filtered.filter(c => c.mobilePhone);
  } else if (campos.email && !campos.whatsapp) {
    filtered = filtered.filter(c => c.email);
  } else if (campos.email && campos.whatsapp) {
    filtered = filtered.filter(c => c.email || c.mobilePhone);
  }

  return filtered;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { format = 'csv', campos = { email: true, whatsapp: true } } = body;

    const spreadsheetId = getAllSpreadsheetIds()[0];
    const { contacts } = await readContatos(spreadsheetId);
    const filtered = filterContacts(contacts, body);

    // JSON format — para preview na tabela
    if (format === 'json') {
      const data = filtered.map(c => ({
        firstName: c.firstName,
        lastName: c.lastName,
        companyName: c.companyName,
        category: c.category,
        status: getStatus(c),
        pipeline: c.pipeline || '',
        email: c.email,
        phone: c.mobilePhone,
      }));
      return NextResponse.json({ contacts: data, total: data.length });
    }

    // CSV format — para download
    const headers = ['Nome', 'Sobrenome', 'Empresa', 'Categoria', 'Status', 'Pipeline'];
    if (campos.email) headers.push('Email');
    if (campos.whatsapp) headers.push('WhatsApp');

    const rows = filtered.map(c => {
      const row = [c.firstName, c.lastName, c.companyName, c.category, getStatus(c), c.pipeline || ''];
      if (campos.email) row.push(c.email);
      if (campos.whatsapp) row.push(c.mobilePhone ? `="${c.mobilePhone}"` : '');
      return row;
    });

    const escapeCsv = (val: string) => {
      if (!val) return '';
      if (val.startsWith('=')) return val;
      if (val.includes(';') || val.includes('"') || val.includes('\n')) {
        return '"' + val.replace(/"/g, '""') + '"';
      }
      return val;
    };

    const csv = [headers, ...rows].map(row => row.map(escapeCsv).join(';')).join('\n');

    return new NextResponse('\uFEFF' + csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="extracao_${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
