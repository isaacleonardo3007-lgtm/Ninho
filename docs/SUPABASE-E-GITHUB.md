# Supabase + GitHub — passo a passo

Ordem recomendada: **1 → 7**. Leva ~40 minutos na primeira vez.

## 1. Criar o projeto no Supabase
1. Em <https://supabase.com/dashboard> → **New project**.
2. **Região: South America (São Paulo)** — mantém os dados de saúde no Brasil (LGPD).
3. Guarde a senha do banco num gerenciador de senhas.

## 2. Aplicar o banco (migrations)
Com a [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase db push            # aplica supabase/migrations/*.sql
```

Sem CLI: abra **SQL Editor** e rode, na ordem, os quatro arquivos de `supabase/migrations/`.

> ✅ Já aplicado no projeto **ninho** (`vrdssjlkqopuypihgxxy`, São Paulo) em 12/11/2026, e o `js/config.js` já aponta para ele.

O que é criado:

| Tabela | Conteúdo | Plano |
|---|---|---|
| `profiles` | Identificação da gestante (campos da Caderneta) + preferências | todos |
| `gestacoes` | Datação (USG/DUM/DPP), G/P/A, altura e peso pré, plano de parto | todos |
| `consultas` | Colunas da tabela de consulta da Caderneta | grátis |
| `vacinas`, `movimentos` | Vacinas e contagem de movimentos | grátis |
| `exames`, `ultrassons`, `medicoes`, `monitores`, `sintomas`, `medicamentos`, `doses`, `notas`, `memorias` | Recursos do Ninho+ | Plus |
| `consentimentos` | Trilha imutável de aceites/revogações (LGPD) | — |
| `assinaturas` | Plano da usuária — **só o servidor escreve** | — |
| `push_subscriptions`, `lembretes` | Web Push e fila de lembretes | — |

Segurança (testada em `tests/db/rls-tests.sql`, 37 verificações):
- RLS em todas as tabelas: cada usuária só lê e altera o que é dela.
- Tabelas Plus: leitura sempre; criar/editar só com assinatura ativa (`is_plus()`).
- `assinaturas` e `pagamentos_eventos`: sem escrita pela usuária.
- Fotos no bucket **privado** `ninho`, na pasta `<user_id>/…`.
- Excluir a conta apaga tudo em cascata.

## 3. Autenticação
**Authentication → Providers → Email**: ative *Confirm email*. Senha mínima: **8**.

**Authentication → URL Configuration**
- *Site URL*: `https://SEU-USUARIO.github.io/Ninho/`
- *Redirect URLs*: o mesmo endereço + `http://localhost:8766/`

**Authentication → Email Templates**: traduza *Confirm signup* e *Reset password* para português.

> Para muitos cadastros por dia, configure SMTP próprio (Resend, SES...). O envio padrão do Supabase tem limite baixo.

## 4. Conectar o app
Em **Project Settings → API**, copie *Project URL* e *anon public key* para `js/config.js`:

```js
SUPABASE_URL: 'https://xxxx.supabase.co',
SUPABASE_ANON_KEY: 'eyJ...',
```

A chave *anon* é pública por definição; quem protege os dados é o RLS. **Nunca** coloque a `service_role` no app.

## 5. Notificações com o app fechado (Web Push)
```bash
npx web-push generate-vapid-keys
```
- Chave **pública** → `VAPID_PUBLIC_KEY` em `js/config.js`.
- Secrets das funções:
```bash
supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:contato@seudominio.com.br \
  CRON_SECRET=$(openssl rand -hex 32) APP_ORIGIN=https://SEU-USUARIO.github.io
supabase functions deploy send-reminders --no-verify-jwt
supabase functions deploy delete-account
```
- Ative as extensões **pg_cron** e **pg_net** e rode `supabase/sql/cron.sql` no SQL Editor (troque a URL e use o mesmo `CRON_SECRET`).

No iPhone, o push só funciona com o Ninho **adicionado à Tela de Início** (iOS 16.4+).

## 6. Pagamento do Ninho+ (Mercado Pago)
1. Crie uma aplicação em <https://www.mercadopago.com.br/developers> e pegue o *Access Token* (comece pelo de **teste**).
2. Em *Webhooks*, cadastre `https://xxxx.supabase.co/functions/v1/payment-webhook`, evento **Planos e assinaturas**, e copie a *assinatura secreta*.
3. Secrets e deploy:
```bash
supabase secrets set MP_ACCESS_TOKEN=... MP_WEBHOOK_SECRET=... PRECO_MENSAL=14.90 PRECO_ANUAL=119.00
supabase functions deploy create-checkout
supabase functions deploy payment-webhook --no-verify-jwt
```
O webhook é o **único** caminho que libera o Plus: valida a assinatura do Mercado Pago, consulta o status real na API e atualiza `assinaturas`. Para liberar alguém manualmente (cortesia, testes):
```sql
update assinaturas set plano='plus', status='active', provedor='manual', periodo_fim=now()+interval '30 days' where user_id='...';
```
> Se o app for publicado nas lojas (Android/iOS), as lojas exigem a cobrança delas para assinaturas digitais; aí o webhook passa a ser o da loja (ou RevenueCat).

## 7. GitHub
```bash
git init && git add . && git commit -m "Ninho v2: Supabase, LGPD, Caderneta 2026"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/Ninho.git
git push -u origin main
```
- **Settings → Pages → Source: GitHub Actions**. O workflow `pages.yml` publica só os arquivos do app.
- O workflow `ci.yml` roda, a cada push: testes unitários, ponta a ponta (local e Supabase simulado) e os testes de segurança do banco num PostgreSQL.

### Desenvolvimento local
```bash
npm install && npx playwright install chromium
python3 -m http.server 8766         # ou: npm run serve
npm test                            # unitários + ponta a ponta
PGHOST=localhost npm run test:db    # precisa de um PostgreSQL local
```
Sem `SUPABASE_URL` em `js/config.js`, o app roda em **modo local** (dados só no aparelho, Plus de demonstração) — útil para desenvolver e testar.
