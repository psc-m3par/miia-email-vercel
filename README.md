# MIIA Email Automation

Sistema de automação de cold email construído com **Next.js 14**, integrado ao **Gmail** e ao **Google Sheets** como banco de dados. Permite gerenciar campanhas de email segmentadas por categorias, com envio automático de follow-ups e monitoramento de respostas em tempo real.

---

## Sumário

- [Visão Geral](#visão-geral)
- [Tecnologias](#tecnologias)
- [Arquitetura](#arquitetura)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Google Sheets — O Banco de Dados](#google-sheets--o-banco-de-dados)
- [Páginas da Interface](#páginas-da-interface)
- [API Routes](#api-routes)
- [Bibliotecas Internas (`lib/`)](#bibliotecas-internas-lib)
- [Fluxo de Envio de Emails](#fluxo-de-envio-de-emails)
- [Variáveis de Ambiente](#variáveis-de-ambiente)
- [Como Rodar Localmente](#como-rodar-localmente)
- [Como Conectar um Gmail](#como-conectar-um-gmail)
- [Placeholders nos Templates](#placeholders-nos-templates)

---

## Visão Geral

O sistema funciona como um painel de controle para campanhas de outreach por email. O fluxo básico é:

```mermaid
flowchart TD
    A(["📥 Importar contatos<br/>Apollo CSV / XLSX"]) --> B(["⚙️ Configurar categoria<br/>responsável · cadência · templates"])
    B --> C(["📤 Email 1 enviado<br/>automaticamente"])
    C --> D{Respondeu?}
    D -- Sim --> G(["✅ Respondido"])
    D -- "Não, após N dias" --> E(["📤 Follow-up 1<br/>enviado na mesma thread"])
    E --> D2{Respondeu?}
    D2 -- Sim --> G
    D2 -- "Não, após N dias" --> F(["📤 Follow-up 2<br/>enviado na mesma thread"])
    F --> D3{Respondeu?}
    D3 -- Sim --> G
    D3 -- Não --> H(["🔚 Sequência concluída"])
```

Todos os dados (contatos, tokens, templates, configurações) ficam armazenados em uma **planilha do Google Sheets**, eliminando a necessidade de banco de dados separado.

---

## Tecnologias

| Tecnologia | Uso |
|---|---|
| **Next.js 14** (App Router) | Framework full-stack — frontend e API routes |
| **TypeScript** | Tipagem estática em todo o projeto |
| **Tailwind CSS** | Estilização utilitária |
| **Google Sheets API** | Banco de dados (via Service Account) |
| **Gmail API** | Envio e leitura de emails (via OAuth2) |
| **PapaParse** | Parsing de arquivos CSV |
| **XLSX** | Leitura de arquivos Excel (.xlsx/.xls) |
| **Lucide React** | Ícones |

---

## Arquitetura

```mermaid
flowchart TD
    subgraph APP["⚡ Next.js App"]
        P["🖥️ Pages<br/>React · Client Components"]
        API["🔧 API Routes<br/>Node.js · Server"]
        P <--> API
    end

    subgraph GOOGLE["☁️ Google Cloud"]
        SHEETS["📊 Google Sheets API<br/>Banco de dados<br/>Service Account"]
        GMAIL["📧 Gmail API<br/>Envio e leitura<br/>OAuth2 por remetente"]
    end

    API --> SHEETS
    API --> GMAIL
```

- **Google Sheets** armazena todos os dados: contatos, templates, configurações e tokens OAuth.
- **Gmail API** é usada para enviar emails e verificar respostas, autenticada via OAuth2 por remetente.
- As **API Routes** do Next.js rodam no servidor e intermediam a comunicação entre o frontend e as APIs do Google.

---

## Estrutura do Projeto

```
miia-frontend/
│
├── app/                        # Páginas e rotas (Next.js App Router)
│   ├── layout.tsx              # Layout raiz com sidebar
│   ├── globals.css             # Estilos globais + Tailwind
│   │
│   ├── page.tsx                # Dashboard principal
│   ├── contacts/page.tsx       # Tabela de contatos com filtros
│   ├── upload/page.tsx         # Upload de base Apollo (CSV/XLSX)
│   ├── templates/page.tsx      # Editor de templates de email
│   ├── settings/page.tsx       # Painel de controle de categorias
│   ├── connect/page.tsx        # Conectar Gmail via OAuth
│   │
│   └── api/                    # Backend (Next.js API Routes)
│       ├── dashboard/route.ts      # Estatísticas consolidadas
│       ├── sheets/route.ts         # CRUD genérico do Google Sheets
│       ├── upload/route.ts         # Importação de contatos
│       ├── send-emails/route.ts    # Envio do Email 1
│       ├── send-fups/route.ts      # Envio dos Follow-ups 1 e 2
│       ├── check-replies/route.ts  # Verificação de respostas
│       ├── retry-errors/route.ts   # Reenvio de emails com erro
│       └── auth/
│           ├── login/route.ts      # Inicia fluxo OAuth com Google
│           └── callback/route.ts   # Recebe token após autorização
│
├── components/
│   └── Sidebar.tsx             # Navegação lateral
│
└── lib/                        # Utilitários de servidor
    ├── sheets.ts               # Wrapper da Google Sheets API
    ├── gmail.ts                # Wrapper da Gmail API (envio e leitura)
    └── tokens.ts               # Gerenciamento de tokens OAuth2
```

---

## Google Sheets — O Banco de Dados

A planilha tem **4 abas** com funções específicas:

### Aba `Painel`
Configurações de cada campanha/categoria.

| Coluna | Campo | Descrição |
|---|---|---|
| A | `category` | Nome da categoria (ex: "Startups SP") |
| B | `responsavel` | Email do remetente dessa categoria |
| C | `nomeRemetente` | Nome exibido no email |
| D | `emailsHora` | Quantos emails enviar por execução (padrão: 20) |
| E | `diasFup1` | Dias para aguardar antes do Follow-up 1 (padrão: 3) |
| F | `diasFup2` | Dias para aguardar antes do Follow-up 2 (padrão: 7) |
| G | `ativo` | `SIM` ou `NAO` — se a categoria está habilitada |
| H | `cc` | Email para cópia (opcional) |

### Aba `Templates`
Templates de email para cada categoria.

| Coluna | Campo | Descrição |
|---|---|---|
| A | `category` | Nome da categoria |
| B | `assunto` | Assunto do Email 1 |
| C | `corpo` | Corpo HTML do Email 1 |
| D | `fup1Assunto` | Assunto do Follow-up 1 |
| E | `fup1Corpo` | Corpo HTML do Follow-up 1 |
| F | `fup2Assunto` | Assunto do Follow-up 2 |
| G | `fup2Corpo` | Corpo HTML do Follow-up 2 |

### Aba `Contatos`
Base de contatos com status de envio.

| Coluna | Campo | Descrição |
|---|---|---|
| A | `firstName` | Primeiro nome |
| B | `lastName` | Sobrenome |
| C | `companyName` | Empresa |
| D | `email` | Email do contato |
| E | `mobilePhone` | Telefone (opcional) |
| F | `linkedinUrl` | LinkedIn (opcional) |
| G | `category` | Categoria à qual pertence |
| H | `email1Enviado` | `OK 2025-01-15` / `ERRO ...` / vazio |
| I | `fup1Enviado` | `OK 2025-01-18` / `RESPONDIDO` / vazio |
| J | `fup2Enviado` | `OK 2025-01-22` / `RESPONDIDO` / vazio |
| K | `threadId` | ID da thread do Gmail (para replies encadeados) |

### Aba `Tokens`
Tokens OAuth2 dos remetentes, gerenciados automaticamente pelo sistema.

| Coluna | Campo |
|---|---|
| A | Email do responsável |
| B | Access Token atual |
| C | Refresh Token |
| D | Data de expiração |

---

## Páginas da Interface

### Dashboard (`/`)
Tela inicial com visão geral da operação:
- **Atividade de hoje**: quantos emails, FUP1 e FUP2 foram enviados no dia
- **Totais gerais**: toda a base segmentada por status
- **Progresso por categoria**: barra de progresso + taxas de resposta por etapa
- **Últimos emails enviados**: feed dos 10 contatos mais recentes
- **Eficiência geral**: taxa de resposta e média de emails por resposta
- **Alertas automáticos**: avisa quando a base está quase vazia, há erros, ou contatos sem Thread ID

> Atualiza automaticamente a cada 30 segundos.

---

### Contatos (`/contacts`)
Tabela completa da base com:
- Busca por nome, email ou empresa
- Filtros por categoria, responsável e status
- Exibe até 100 resultados por vez

**Status possíveis:**

| Status | Significado |
|---|---|
| `Pendente` | Nenhum email enviado ainda |
| `Email 1` | Primeiro email enviado com sucesso |
| `FUP1` | Follow-up 1 enviado |
| `FUP2` | Follow-up 2 enviado |
| `Respondido` | O contato respondeu em algum momento |
| `Erro` | Houve falha no envio do Email 1 |

---

### Upload Apollo (`/upload`)
Importa contatos a partir de arquivos exportados do Apollo.io:
1. Arrasta ou seleciona um arquivo `.csv` ou `.xlsx`
2. O sistema faz parse automático e detecta o formato Apollo
3. Exibe preview dos primeiros 5 contatos
4. Seleciona (ou cria) uma categoria
5. Envia para a aba `Contatos` da planilha

Formatos suportados:
- **CSV padrão Apollo**: com colunas `First Name`, `Last Name`, `Company Name`, `Email`, etc.
- **CSV entre aspas (Apollo)**: formato de linha inteira entre aspas duplas
- **Excel (.xlsx / .xls)**: mesmas colunas, lido via biblioteca XLSX

---

### Templates (`/templates`)
Editor de templates por categoria:
- Lista de categorias na coluna esquerda
- Editor com 3 seções: **Email 1**, **Follow-up 1**, **Follow-up 2**
- Cada seção tem campo de assunto e corpo (HTML)
- Suporte a placeholders de personalização
- Botão "**+ Novo**" para criar template para categorias que ainda não têm

---

### Painel de Controle (`/settings`)
Gerenciamento das categorias:
- Criar nova categoria com todos os campos
- Toggle ativo/inativo por categoria
- Editar configurações (responsável, cadência, dias de FUP)
- **Enviar Agora**: dispara envio imediato para uma categoria específica
- **Limpar base**: remove todos os contatos de uma categoria
- **Excluir categoria**: remove a categoria do Painel e dos Templates
- **Corrigir Erros**: reaparece quando há erros — reprocessa emails falhos

---

### Conectar Gmail (`/connect`)
Fluxo OAuth2 para autorizar o sistema a enviar emails de uma conta:
1. Clica em "Conectar com Google"
2. Faz login e autoriza as permissões
3. O token é salvo automaticamente na aba `Tokens` da planilha
4. A partir daí, o sistema renova o token automaticamente quando necessário

> Cada responsável precisa fazer isso **uma única vez**.

---

## API Routes

### `GET /api/dashboard`
Retorna estatísticas completas agrupadas por categoria: totais, pendentes, enviados, follow-ups, respondidos, erros, atividade do dia.

---

### `GET|POST|PUT|DELETE /api/sheets`
CRUD genérico para a planilha. Parâmetros via query string (`?type=contacts`, `?type=painel`, etc.) ou body JSON.

- `GET ?type=contacts` → lista todos os contatos
- `GET ?type=painel` → lista configurações do painel
- `GET ?type=templates` → lista todos os templates
- `PUT` com `{ type, rowIndex, values }` → atualiza uma linha específica
- `POST` com `{ type, values }` → adiciona uma nova linha
- `DELETE` com `{ category }` → remove contatos de uma categoria

---

### `POST /api/upload`
Recebe `{ contacts: [...], category: "..." }` e insere os contatos na planilha.

---

### `GET|POST /api/send-emails`
Envia o **Email 1** para todos os contatos pendentes nas categorias ativas. Respeita o limite de `emailsHora` por categoria. Aguarda 2 segundos entre cada envio.

Ao enviar com sucesso, registra `OK YYYY-MM-DD` e o `threadId` na planilha.
Em caso de erro, registra `ERRO YYYY-MM-DD: mensagem`.

---

### `GET|POST /api/send-fups`
Envia **Follow-up 1** e **Follow-up 2** para contatos elegíveis:
- FUP1: email enviado há pelo menos `diasFup1` dias, sem fup1 e com threadId
- FUP2: fup1 enviado há pelo menos `diasFup2` dias, sem fup2 e com threadId

Os follow-ups são enviados como **resposta na mesma thread** do Email 1.

---

### `GET|POST /api/check-replies`
Verifica na Gmail API se o contato respondeu em alguma das threads ativas. Se encontrar uma mensagem de um remetente diferente, marca como `RESPONDIDO` na planilha.

---

### `GET|POST /api/retry-errors`
Processa até **5 contatos com erro** por categoria. Limpa o status de erro, reenvia o email e registra o resultado.

---

### `GET /api/auth/login`
Redireciona o usuário para o fluxo de autorização OAuth2 do Google com os escopos necessários (gmail.send, gmail.readonly).

---

### `GET /api/auth/callback`
Recebe o código de autorização do Google, troca por tokens de acesso/refresh e salva na aba `Tokens` da planilha.

---

## Bibliotecas Internas (`lib/`)

### `lib/sheets.ts`
Wrapper completo para a **Google Sheets API** usando autenticação por **Service Account**. Funções exportadas:

| Função | Descrição |
|---|---|
| `readSheet(range)` | Lê um intervalo da planilha |
| `writeSheet(range, values)` | Atualiza células |
| `appendSheet(range, values)` | Adiciona linhas ao final |
| `readPainel()` | Lê e mapeia a aba Painel |
| `readTemplates()` | Lê e mapeia a aba Templates |
| `readContatos()` | Lê e mapeia a aba Contatos |
| `getDashboardStats()` | Calcula todas as métricas de uma vez |
| `appendContacts(contacts)` | Insere contatos em lote |
| `clearContactsByCategory(cat)` | Remove contatos de uma categoria |
| `deleteCategoryFromPainel(cat)` | Remove categoria do Painel |
| `deleteCategoryFromTemplates(cat)` | Remove template da categoria |

---

### `lib/gmail.ts`
Wrapper para a **Gmail API** usando tokens OAuth2 por remetente. Funções exportadas:

| Função | Descrição |
|---|---|
| `sendEmail(from, to, subject, html, cc?)` | Envia um email novo e retorna o threadId |
| `sendReply(from, to, subject, html, threadId, ...)` | Envia resposta na mesma thread |
| `checkReplies(email, threadId)` | Verifica se há mensagem de terceiros na thread |

Todos os emails são enviados em formato **multipart/alternative** com HTML.

---

### `lib/tokens.ts`
Gerenciamento de tokens OAuth2 com **cache em memória** (5 minutos):

| Função | Descrição |
|---|---|
| `getToken(email)` | Busca token na planilha |
| `saveToken(data)` | Salva ou atualiza token na planilha |
| `refreshAccessToken(email)` | Renova o access token usando o refresh token |
| `getValidAccessToken(email)` | Retorna token válido (renova automaticamente se expirado) |

---

## Fluxo de Envio de Emails

```mermaid
flowchart TD
    subgraph SE["📤 /api/send-emails"]
        SE1[Busca contatos pendentes] --> SE2["Limita ao lote<br/>emailsHora"]
        SE2 --> SE3["Personaliza assunto e corpo<br/>com dados do contato"]
        SE3 --> SE4["Obtém token OAuth2<br/>do responsável"]
        SE4 --> SE5{Gmail API}
        SE5 -- sucesso --> SE6["Registra OK + threadId<br/>na planilha"]
        SE5 -- erro --> SE7["Registra ERRO<br/>na planilha"]
        SE6 --> SE8[⏱️ Aguarda 2s]
    end

    subgraph SF["🔁 /api/send-fups"]
        SF1{"diasFup1 passou?<br/>email1 enviado · sem fup1 · tem threadId"}
        SF1 -- Sim --> SF2["Envia FUP1 como reply<br/>na mesma thread"]
        SF2 --> SF3{"diasFup2 passou?<br/>fup1 enviado · sem fup2 · tem threadId"}
        SF3 -- Sim --> SF4["Envia FUP2 como reply<br/>na mesma thread"]
    end

    subgraph CR["👁️ /api/check-replies"]
        CR1[Busca thread via Gmail API] --> CR2{"Mensagem de<br/>outro remetente?"}
        CR2 -- Sim --> CR3["Marca RESPONDIDO<br/>na planilha"]
        CR2 -- Não --> CR4[Mantém status atual]
    end

    CRON([🕐 Cron Job / chamada manual]) --> SE
    CRON --> SF
    CRON --> CR
```

---

## Variáveis de Ambiente

Crie um arquivo `.env.local` na raiz do projeto:

```env
# Google Service Account (acesso ao Sheets)
GOOGLE_SERVICE_ACCOUNT_EMAIL=seu-service-account@projeto.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Google OAuth2 (para o fluxo de conexão do Gmail)
GOOGLE_CLIENT_ID=seu-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=seu-client-secret

# ID da planilha do Google Sheets
SPREADSHEET_ID=1AbCdEfGhIjKlMnOpQrStUvWxYz1234567890
```

### Como obter as credenciais

**Service Account (para Sheets):**
1. Acesse o [Google Cloud Console](https://console.cloud.google.com)
2. Crie um Service Account no projeto
3. Gere uma chave JSON — copie `client_email` e `private_key`
4. Compartilhe a planilha com o email do Service Account (acesso de Editor)

**OAuth2 (para Gmail):**
1. No Cloud Console, vá em "APIs e Serviços" → "Credenciais"
2. Crie um "ID do cliente OAuth 2.0" do tipo "Aplicativo Web"
3. Adicione `http://localhost:3000/api/auth/callback` nos URIs de redirecionamento autorizados
4. Copie o Client ID e o Client Secret

**Planilha:**
1. Crie uma planilha no Google Drive
2. Adicione as abas: `Painel`, `Templates`, `Contatos`, `Tokens`
3. Copie o ID da URL: `https://docs.google.com/spreadsheets/d/**{ID_AQUI}**/edit`

---

## Como Rodar Localmente

```bash
# 1. Instale as dependências
npm install

# 2. Configure as variáveis de ambiente
cp .env.local.example .env.local
# edite .env.local com suas credenciais

# 3. Inicie o servidor de desenvolvimento
npm run dev
```

A aplicação estará disponível em `http://localhost:3000`.

---

## Como Conectar um Gmail

Antes de enviar emails de uma conta, o responsável precisa autorizar:

1. Acesse `/connect` na interface
2. Clique em **"Conectar com Google"**
3. Faça login com a conta Gmail que será usada
4. Autorize as permissões solicitadas
5. Após redirecionar de volta, o token é salvo automaticamente

> O token se renova automaticamente. O responsável **não precisa reconectar** a menos que revogue o acesso.

---

## Placeholders nos Templates

Use os seguintes marcadores no assunto e corpo dos emails para personalizar automaticamente:

| Placeholder | Substituído por |
|---|---|
| `[First Name]` | Primeiro nome do contato |
| `[Last Name]` | Sobrenome do contato |
| `[Full Name]` | Nome completo |
| `[Company]` | Nome da empresa |
| `[Category]` | Nome da categoria |
| `[Sender Name]` | Nome do remetente (configurado no Painel) |

**Exemplo:**
```
Assunto: Olá [First Name], tenho uma ideia para [Company]

Corpo:
<p>Oi [First Name],</p>
<p>Vi que você trabalha na [Company] e queria compartilhar algo...</p>
```
