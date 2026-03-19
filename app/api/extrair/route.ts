import { NextRequest, NextResponse } from 'next/server';
import { readPainel, readContatos, getAllSpreadsheetIds } from '@/lib/sheets';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      categorias = [] as string[],
      statusResposta = [] as string[],
      statusPipe = [] as string[],
      campos = { email: true, whatsapp: true },
    } = body;

    const spreadsheetId = getAllSpreadsheetIds()[0];
    const [painel, { contacts }] = await Promise.all([
      readPainel(spreadsheetId),
      readContatos(spreadsheetId),
    ]);

    // Determinar status de resposta de cada contato
    const getStatus = (c: any): string => {
      if (c.fup1Enviado === 'RESPONDIDO' || c.fup2Enviado === 'RESPONDIDO') return 'respondido';
      if (c.fup1Enviado === 'BOUNCE' || c.fup2Enviado === 'BOUNCE' || c.email1Enviado.startsWith('BOUNCE')) return 'bounced';
      if (c.email1Enviado.startsWith('ERRO') || c.fup1Enviado.startsWith('ERRO') || c.fup2Enviado.startsWith('ERRO')) return 'erro';
      if (c.fup2Enviado.startsWith('OK')) return 'fup2_enviado';
      if (c.fup1Enviado.startsWith('OK')) return 'fup1_enviado';
      if (c.email1Enviado.startsWith('OK')) return 'email1_enviado';
      if (!c.email1Enviado) return 'pendente';
      return 'outro';
    };

    // Filtrar contatos
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

    // Montar cabeçalho
    const headers = ['Nome', 'Sobrenome', 'Empresa', 'Categoria', 'Status', 'Pipeline'];
    if (campos.email) headers.push('Email');
    if (campos.whatsapp) headers.push('WhatsApp');
    headers.push('LinkedIn');

    // Montar linhas
    const rows = filtered.map(c => {
      const row = [
        c.firstName,
        c.lastName,
        c.companyName,
        c.category,
        getStatus(c),
        c.pipeline || '',
      ];
      if (campos.email) row.push(c.email);
      if (campos.whatsapp) row.push(c.mobilePhone);
      row.push(c.linkedinUrl);
      return row;
    });

    // Gerar CSV
    const escapeCsv = (val: string) => {
      if (!val) return '';
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return '"' + val.replace(/"/g, '""') + '"';
      }
      return val;
    };

    const csv = [headers, ...rows]
      .map(row => row.map(escapeCsv).join(','))
      .join('\n');

    // BOM para Excel reconhecer UTF-8
    const bom = '\uFEFF';

    return new NextResponse(bom + csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="extracao_${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
