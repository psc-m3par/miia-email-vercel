import { NextRequest, NextResponse } from 'next/server';

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzXGYYkwrYIfQO_gsy0Lg1RU70Ea8-t_eIEFHbcW3ha24BH2qJuWwQvpTm1vGS5gmlM6w/exec';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action;
    if (!['enviar', 'fups'].includes(action)) {
      return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
    }
    const res = await fetch(`${APPS_SCRIPT_URL}?action=${action}`, { method: 'GET', redirect: 'follow' });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { ok: true, raw: text }; }
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}