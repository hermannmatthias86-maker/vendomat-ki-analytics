-- =============================================================================
-- RLS POLICIES – Vendomat KI Analytics
-- Run this entire script in the Supabase SQL Editor (once, idempotent).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Helper functions
-- ---------------------------------------------------------------------------

-- Returns the customer_id for the logged-in user.
-- Falls back to auth.uid() when no users-table record exists (matches the
-- useCustomer hook's fallback so existing data remains accessible).
CREATE OR REPLACE FUNCTION get_my_customer_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(
    (SELECT customer_id FROM public.users WHERE id = auth.uid()),
    auth.uid()
  )
$$;

-- Returns true for super_admin users (bypasses all row-level restrictions).
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin'
  )
$$;

-- ---------------------------------------------------------------------------
-- 2. Enable RLS on every table
-- ---------------------------------------------------------------------------

ALTER TABLE public.users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploads         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_groups  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_results      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_history    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log    ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 3. users table – own row only (super_admin sees all)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "users_select_own"        ON public.users;
DROP POLICY IF EXISTS "users_select_superadmin" ON public.users;
DROP POLICY IF EXISTS "users_insert_own"        ON public.users;
DROP POLICY IF EXISTS "users_update_own"        ON public.users;

CREATE POLICY "users_select_own"
  ON public.users FOR SELECT
  USING (id = auth.uid() OR is_super_admin());

CREATE POLICY "users_insert_own"
  ON public.users FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "users_update_own"
  ON public.users FOR UPDATE
  USING (id = auth.uid() OR is_super_admin());

-- ---------------------------------------------------------------------------
-- 4. customers table – own customer only
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "customers_select_own" ON public.customers;
DROP POLICY IF EXISTS "customers_update_own" ON public.customers;

CREATE POLICY "customers_select_own"
  ON public.customers FOR SELECT
  USING (id = get_my_customer_id() OR is_super_admin());

CREATE POLICY "customers_update_own"
  ON public.customers FOR UPDATE
  USING (id = get_my_customer_id() OR is_super_admin());

-- ---------------------------------------------------------------------------
-- 5. uploads – customer-scoped
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "uploads_select" ON public.uploads;
DROP POLICY IF EXISTS "uploads_insert" ON public.uploads;
DROP POLICY IF EXISTS "uploads_update" ON public.uploads;
DROP POLICY IF EXISTS "uploads_delete" ON public.uploads;

CREATE POLICY "uploads_select"
  ON public.uploads FOR SELECT
  USING (customer_id = get_my_customer_id() OR is_super_admin());

CREATE POLICY "uploads_insert"
  ON public.uploads FOR INSERT
  WITH CHECK (customer_id = get_my_customer_id() OR is_super_admin());

CREATE POLICY "uploads_update"
  ON public.uploads FOR UPDATE
  USING (customer_id = get_my_customer_id() OR is_super_admin());

CREATE POLICY "uploads_delete"
  ON public.uploads FOR DELETE
  USING (customer_id = get_my_customer_id() OR is_super_admin());

-- ---------------------------------------------------------------------------
-- 6. products – customer-scoped
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "products_select" ON public.products;
DROP POLICY IF EXISTS "products_insert" ON public.products;
DROP POLICY IF EXISTS "products_delete" ON public.products;

CREATE POLICY "products_select"
  ON public.products FOR SELECT
  USING (customer_id = get_my_customer_id() OR is_super_admin());

CREATE POLICY "products_insert"
  ON public.products FOR INSERT
  WITH CHECK (customer_id = get_my_customer_id() OR is_super_admin());

CREATE POLICY "products_delete"
  ON public.products FOR DELETE
  USING (customer_id = get_my_customer_id() OR is_super_admin());

-- ---------------------------------------------------------------------------
-- 7. sales – customer-scoped
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "sales_select" ON public.sales;
DROP POLICY IF EXISTS "sales_insert" ON public.sales;
DROP POLICY IF EXISTS "sales_delete" ON public.sales;

CREATE POLICY "sales_select"
  ON public.sales FOR SELECT
  USING (customer_id = get_my_customer_id() OR is_super_admin());

CREATE POLICY "sales_insert"
  ON public.sales FOR INSERT
  WITH CHECK (customer_id = get_my_customer_id() OR is_super_admin());

CREATE POLICY "sales_delete"
  ON public.sales FOR DELETE
  USING (customer_id = get_my_customer_id() OR is_super_admin());

-- ---------------------------------------------------------------------------
-- 8. payments – customer-scoped
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "payments_select" ON public.payments;
DROP POLICY IF EXISTS "payments_insert" ON public.payments;
DROP POLICY IF EXISTS "payments_delete" ON public.payments;

CREATE POLICY "payments_select"
  ON public.payments FOR SELECT
  USING (customer_id = get_my_customer_id() OR is_super_admin());

CREATE POLICY "payments_insert"
  ON public.payments FOR INSERT
  WITH CHECK (customer_id = get_my_customer_id() OR is_super_admin());

CREATE POLICY "payments_delete"
  ON public.payments FOR DELETE
  USING (customer_id = get_my_customer_id() OR is_super_admin());

-- ---------------------------------------------------------------------------
-- 9. employees – customer-scoped
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "employees_select" ON public.employees;
DROP POLICY IF EXISTS "employees_insert" ON public.employees;
DROP POLICY IF EXISTS "employees_delete" ON public.employees;

CREATE POLICY "employees_select"
  ON public.employees FOR SELECT
  USING (customer_id = get_my_customer_id() OR is_super_admin());

CREATE POLICY "employees_insert"
  ON public.employees FOR INSERT
  WITH CHECK (customer_id = get_my_customer_id() OR is_super_admin());

CREATE POLICY "employees_delete"
  ON public.employees FOR DELETE
  USING (customer_id = get_my_customer_id() OR is_super_admin());

-- ---------------------------------------------------------------------------
-- 10. product_groups – customer-scoped
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "product_groups_select" ON public.product_groups;
DROP POLICY IF EXISTS "product_groups_insert" ON public.product_groups;
DROP POLICY IF EXISTS "product_groups_delete" ON public.product_groups;

CREATE POLICY "product_groups_select"
  ON public.product_groups FOR SELECT
  USING (customer_id = get_my_customer_id() OR is_super_admin());

CREATE POLICY "product_groups_insert"
  ON public.product_groups FOR INSERT
  WITH CHECK (customer_id = get_my_customer_id() OR is_super_admin());

CREATE POLICY "product_groups_delete"
  ON public.product_groups FOR DELETE
  USING (customer_id = get_my_customer_id() OR is_super_admin());

-- ---------------------------------------------------------------------------
-- 11. ai_results – customer-scoped
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "ai_results_select" ON public.ai_results;
DROP POLICY IF EXISTS "ai_results_insert" ON public.ai_results;
DROP POLICY IF EXISTS "ai_results_delete" ON public.ai_results;

CREATE POLICY "ai_results_select"
  ON public.ai_results FOR SELECT
  USING (customer_id = get_my_customer_id() OR is_super_admin());

CREATE POLICY "ai_results_insert"
  ON public.ai_results FOR INSERT
  WITH CHECK (customer_id = get_my_customer_id() OR is_super_admin());

CREATE POLICY "ai_results_delete"
  ON public.ai_results FOR DELETE
  USING (customer_id = get_my_customer_id() OR is_super_admin());

-- ---------------------------------------------------------------------------
-- 12. chat_history – customer-scoped
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "chat_history_select" ON public.chat_history;
DROP POLICY IF EXISTS "chat_history_insert" ON public.chat_history;
DROP POLICY IF EXISTS "chat_history_delete" ON public.chat_history;

CREATE POLICY "chat_history_select"
  ON public.chat_history FOR SELECT
  USING (customer_id = get_my_customer_id() OR is_super_admin());

CREATE POLICY "chat_history_insert"
  ON public.chat_history FOR INSERT
  WITH CHECK (customer_id = get_my_customer_id() OR is_super_admin());

CREATE POLICY "chat_history_delete"
  ON public.chat_history FOR DELETE
  USING (customer_id = get_my_customer_id() OR is_super_admin());

-- ---------------------------------------------------------------------------
-- 13. settings – customer-scoped
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "settings_select" ON public.settings;
DROP POLICY IF EXISTS "settings_insert" ON public.settings;
DROP POLICY IF EXISTS "settings_update" ON public.settings;

CREATE POLICY "settings_select"
  ON public.settings FOR SELECT
  USING (customer_id = get_my_customer_id() OR is_super_admin());

CREATE POLICY "settings_insert"
  ON public.settings FOR INSERT
  WITH CHECK (customer_id = get_my_customer_id() OR is_super_admin());

CREATE POLICY "settings_update"
  ON public.settings FOR UPDATE
  USING (customer_id = get_my_customer_id() OR is_super_admin());

-- ---------------------------------------------------------------------------
-- 14. activity_log – customer-scoped (read-only for users)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "activity_log_select" ON public.activity_log;
DROP POLICY IF EXISTS "activity_log_insert" ON public.activity_log;

CREATE POLICY "activity_log_select"
  ON public.activity_log FOR SELECT
  USING (customer_id = get_my_customer_id() OR is_super_admin());

-- Only the service role / super_admin inserts activity log entries
CREATE POLICY "activity_log_insert"
  ON public.activity_log FOR INSERT
  WITH CHECK (is_super_admin());

-- ---------------------------------------------------------------------------
-- Done. Verify with:
--   SELECT tablename, policyname, cmd, qual FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename;
-- ---------------------------------------------------------------------------
