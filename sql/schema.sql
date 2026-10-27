-- ============================================================================
-- BANCO DE DADOS DO SISTEMA DE FINANÇAS DO CASAL (POSTGRESQL / SUPABASE)
-- ============================================================================
-- Finalidade didática (ADS):
-- Este script cria a estrutura relacional completa para o casal (Éveli & Vital),
-- incluindo a Conta Conjunta Itaú, os 2 Cartões de Crédito, Lançamentos em
-- centavos (BIGINT), Orçamentos, Metas e as Políticas de Segurança (RLS).
--
-- Como usar no Supabase:
-- 1. Crie um projeto gratuito em https://supabase.com
-- 2. Abra o menu "SQL Editor" -> "New Query"
-- 3. Cole este arquivo inteiro e clique em "Run".
-- ============================================================================

-- Extensão para gerar identificadores únicos (UUID)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. TABELA DE AMBIENTE COMPARTILHADO DO CASAL (HOUSEHOLDS)
-- ============================================================================
-- Por que existe? Agrupa os dois usuários (Éveli e Vital) sob o mesmo "teto"
-- financeiro, permitindo que ambos vejam e administrem a conta conjunta e os
-- dois cartões sem que pessoas externas tenham acesso.
CREATE TABLE IF NOT EXISTS public.households (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL DEFAULT 'Família Éveli & Vital',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. TABELA DE PERFIS DE USUÁRIOS (PROFILES)
-- ============================================================================
-- Por que existe? Vincula o login individual do Supabase Auth (auth.users)
-- ao ambiente compartilhado do casal (household_id) e identifica quem é quem.
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    person_key TEXT NOT NULL CHECK (person_key IN ('Éveli', 'Vital')),
    full_name TEXT NOT NULL,
    email TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 3. TABELA DE CONTAS BANCÁRIAS (ACCOUNTS)
-- ============================================================================
-- Representa a Conta Corrente Conjunta do Itaú (e eventuais reservas/caixinhas).
-- Valores são salvos em CENTAVOS (BIGINT) para evitar erros de arredondamento.
CREATE TABLE IF NOT EXISTS public.accounts (
    id TEXT PRIMARY KEY, -- Ex: 'cc_itau_conjunta'
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    bank_name TEXT NOT NULL DEFAULT 'Itaú',
    account_type TEXT NOT NULL DEFAULT 'checking' CHECK (account_type IN ('checking', 'savings', 'reserve')),
    initial_balance_cents BIGINT NOT NULL DEFAULT 4817, -- R$ 48,17 = 4817 centavos
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 4. TABELA DE CARTÕES DE CRÉDITO (CREDIT_CARDS)
-- ============================================================================
-- Cada pessoa possui seu próprio cartão, mas ambos são visíveis e administráveis
-- pelos dois integrantes do casal.
CREATE TABLE IF NOT EXISTS public.credit_cards (
    id TEXT PRIMARY KEY, -- Ex: 'card_eveli_5544', 'card_vital'
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    holder_name TEXT NOT NULL CHECK (holder_name IN ('Éveli', 'Vital')),
    name TEXT NOT NULL,
    last_digits TEXT,
    limit_cents BIGINT NOT NULL DEFAULT 0,
    closing_day SMALLINT NOT NULL DEFAULT 14 CHECK (closing_day BETWEEN 1 AND 31),
    due_day SMALLINT NOT NULL DEFAULT 21 CHECK (due_day BETWEEN 1 AND 31),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 5. TABELA DE CONCILIAÇÃO DE FATURAS MENSAIS (CARD_INVOICES)
-- ============================================================================
-- Guarda o valor oficial impresso no PDF da fatura de cada mês (AAAA-MM) para
-- conciliação automática com a soma das compras lançadas.
CREATE TABLE IF NOT EXISTS public.card_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    card_id TEXT NOT NULL REFERENCES public.credit_cards(id) ON DELETE CASCADE,
    period TEXT NOT NULL, -- Formato 'YYYY-MM', ex: '2026-10'
    official_total_cents BIGINT,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'paid')),
    UNIQUE (household_id, card_id, period)
);

-- ============================================================================
-- 6. TABELA DE LANÇAMENTOS FINANCEIROS (TRANSACTIONS)
-- ============================================================================
-- Registra todas as movimentações da Conta Conjunta e dos 2 Cartões.
-- Diferencia:
--   * kind ('expense', 'income', 'invoice_payment', 'transfer', 'reimbursement')
--     para evitar duplicar despesas quando a fatura é paga pela conta conjunta.
--   * scope ('shared' vs 'individual') para relatórios de divisão do casal.
CREATE TABLE IF NOT EXISTS public.transactions (
    id TEXT PRIMARY KEY,
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    account_id TEXT NOT NULL, -- 'cc_itau_conjunta', 'card_eveli_5544', 'card_vital'
    owner_name TEXT NOT NULL CHECK (owner_name IN ('Éveli', 'Vital')),
    source_label TEXT NOT NULL,
    period TEXT NOT NULL, -- Mês de competência/fatura ('YYYY-MM')
    tx_date TEXT NOT NULL, -- Data 'DD/MM/YYYY'
    legacy_type TEXT NOT NULL CHECK (legacy_type IN ('income', 'debit', 'card')),
    kind TEXT NOT NULL CHECK (kind IN ('expense', 'income', 'invoice_payment', 'transfer', 'reimbursement')),
    scope TEXT NOT NULL DEFAULT 'shared' CHECK (scope IN ('shared', 'individual')),
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    amount_cents BIGINT NOT NULL CHECK (amount_cents >= 0),
    installment_current SMALLINT,
    installment_total SMALLINT,
    parent_installment_id TEXT,
    goal_id TEXT,
    paid_card_id TEXT,
    created_by TEXT DEFAULT 'Éveli',
    updated_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_household_period
    ON public.transactions (household_id, period);

-- ============================================================================
-- 7. TABELA DE ESTADO DOCUMENTAL SINCRONIZADO (HOUSEHOLD_STATE_SYNC)
-- ============================================================================
-- Facilita a sincronização instantânea (offline-first) entre o front-end modular
-- e o Supabase, guardando também o snapshot JSON completo do casal e o histórico
-- de auditoria.
CREATE TABLE IF NOT EXISTS public.household_state_sync (
    household_code TEXT PRIMARY KEY, -- Código compartilhado do casal (ex: 'casal_eveli_vital')
    state_json JSONB NOT NULL,
    updated_by TEXT NOT NULL DEFAULT 'Éveli',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 8. TABELA DE HISTÓRICO DE ALTERAÇÕES / AUDITORIA (AUDIT_LOGS)
-- ============================================================================
-- Registra quem cadastrou, editou ou excluiu um lançamento e quando.
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_code TEXT NOT NULL,
    actor_name TEXT NOT NULL,
    action_type TEXT NOT NULL,
    details TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 9. SEGURANÇA: ROW LEVEL SECURITY (RLS) PARA O CASAL
-- ============================================================================
-- Função auxiliar que descobre qual é o household_id do usuário logado.
-- SET search_path evita que alguém "engane" a função usando tabelas homônimas.
CREATE OR REPLACE FUNCTION public.get_my_household_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT household_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- ============================================================================
-- 10. SEGURANÇA DA SINCRONIZAÇÃO USADA PELO APLICATIVO (ESSENCIAL!)
-- ============================================================================
-- O aplicativo grava o "retrato" dos dados em household_state_sync. Sem as
-- regras abaixo, QUALQUER pessoa com a URL + Anon Key (que ficam visíveis no
-- navegador) poderia ler ou apagar tudo. Aqui só ENTRAM os e-mails que VOCÊS
-- cadastrarem na lista abaixo.
CREATE TABLE IF NOT EXISTS public.allowed_users (
    email TEXT PRIMARY KEY
);

ALTER TABLE public.allowed_users ENABLE ROW LEVEL SECURITY;
-- Sem nenhuma policy em allowed_users: ninguém pelo app consegue ler/alterar
-- a lista. Ela só é editada por vocês, aqui no SQL Editor.

-- >>> TROQUE pelos 2 e-mails reais de vocês e rode este INSERT: <<<
-- INSERT INTO public.allowed_users (email) VALUES ('eveli@exemplo.com'), ('vital@exemplo.com');

CREATE OR REPLACE FUNCTION public.is_allowed_user()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.allowed_users
        WHERE lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    );
$$;

ALTER TABLE public.household_state_sync ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Visitantes anônimos (sem login) não têm NENHUM acesso: só o papel "authenticated"
-- e, mesmo assim, só se o e-mail estiver na lista.
CREATE POLICY "Casal autorizado acessa sincronizacao" ON public.household_state_sync
    FOR ALL TO authenticated
    USING (public.is_allowed_user())
    WITH CHECK (public.is_allowed_user());

CREATE POLICY "Casal autorizado acessa auditoria" ON public.audit_logs
    FOR ALL TO authenticated
    USING (public.is_allowed_user())
    WITH CHECK (public.is_allowed_user());

REVOKE ALL ON public.household_state_sync FROM anon;
REVOKE ALL ON public.audit_logs FROM anon;
REVOKE ALL ON public.allowed_users FROM anon, authenticated;

-- Lembrete (no painel do Supabase): depois de criar os 2 logins, desligue
-- Authentication > Providers > Email > "Allow new users to sign up" e mantenha
-- "Confirm email" LIGADO. Assim ninguém de fora consegue criar conta.

ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Políticas: Qualquer um dos 2 integrantes do casal (mesmo household_id)
-- pode consultar, cadastrar, editar e excluir dados da Conta Conjunta e dos 2 Cartões.
CREATE POLICY "Casal acessa sua familia" ON public.households
    FOR ALL USING (id = public.get_my_household_id());

CREATE POLICY "Casal vê perfis da familia" ON public.profiles
    FOR ALL USING (household_id = public.get_my_household_id());

CREATE POLICY "Casal administra conta conjunta" ON public.accounts
    FOR ALL USING (household_id = public.get_my_household_id())
    WITH CHECK (household_id = public.get_my_household_id());

CREATE POLICY "Casal administra os 2 cartoes" ON public.credit_cards
    FOR ALL USING (household_id = public.get_my_household_id())
    WITH CHECK (household_id = public.get_my_household_id());

CREATE POLICY "Casal administra faturas dos 2 cartoes" ON public.card_invoices
    FOR ALL USING (household_id = public.get_my_household_id())
    WITH CHECK (household_id = public.get_my_household_id());

CREATE POLICY "Casal administra todos os lancamentos" ON public.transactions
    FOR ALL USING (household_id = public.get_my_household_id())
    WITH CHECK (household_id = public.get_my_household_id());
