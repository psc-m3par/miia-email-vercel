import { NextRequest, NextResponse } from 'next/server';
import { getValidAccessToken } from '@/lib/tokens';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

interface ContactInput {
  firstName: string;
  lastName: string;
  companyName: string;
  email: string;
  phone: string;
}

async function createContact(accessToken: string, contact: ContactInput) {
  // Sobrenome = lastName + empresa pra fácil identificação
  const familyName = [contact.lastName, contact.companyName].filter(Boolean).join(' - ');
  const body: any = {
    names: [{ givenName: contact.firstName, familyName }],
  };

  if (contact.companyName) {
    body.organizations = [{ name: contact.companyName }];
  }
  if (contact.email) {
    body.emailAddresses = [{ value: contact.email, type: 'work' }];
  }
  if (contact.phone) {
    // Formata telefone com +
    const phone = contact.phone.startsWith('+') ? contact.phone : '+' + contact.phone;
    body.phoneNumbers = [{ value: phone, type: 'mobile' }];
  }

  const res = await fetch('https://people.googleapis.com/v1/people:createContact', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'People API error ' + res.status);
  }

  return await res.json();
}

export async function POST(req: NextRequest) {
  try {
    const { contacts, accountEmail, spreadsheetId } = await req.json();

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return NextResponse.json({ error: 'Nenhum contato enviado' }, { status: 400 });
    }

    if (!accountEmail) {
      return NextResponse.json({ error: 'Conta Google não selecionada' }, { status: 400 });
    }

    const accessToken = await getValidAccessToken(accountEmail, spreadsheetId);
    if (!accessToken) {
      return NextResponse.json({
        error: `Token não encontrado para ${accountEmail}. Reconecte a conta em Conectar Gmail.`
      }, { status: 401 });
    }

    let saved = 0;
    let errors = 0;
    const errorMessages: string[] = [];

    for (const contact of contacts) {
      try {
        await createContact(accessToken, contact);
        saved++;
        // Rate limit: max 10 por segundo (People API limit)
        if (saved % 10 === 0) {
          await new Promise(r => setTimeout(r, 1000));
        }
      } catch (e: any) {
        errors++;
        if (errorMessages.length < 5) {
          errorMessages.push(`${contact.firstName} ${contact.lastName}: ${e.message}`);
        }
      }
    }

    return NextResponse.json({ saved, errors, errorMessages, total: contacts.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
