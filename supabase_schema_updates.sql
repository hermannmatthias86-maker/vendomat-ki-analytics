-- ============================================================
-- Vendomat KI Analytics – Schema Updates
-- Führen Sie diese Statements im Supabase SQL Editor aus.
-- Alle Statements sind idempotent (IF NOT EXISTS).
-- ============================================================

-- ── products ──────────────────────────────────────────────────
-- PLU-Nummer und Preis aus Lightspeed
ALTER TABLE products ADD COLUMN IF NOT EXISTS plu           TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS price         NUMERIC;
-- Netto/MwSt-Betrag pro Artikel
ALTER TABLE products ADD COLUMN IF NOT EXISTS netto         NUMERIC;
ALTER TABLE products ADD COLUMN IF NOT EXISTS mwst          NUMERIC;
-- Warengruppen-Verknüpfung (Name, kein FK)
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_group TEXT;
-- Monat (1–12) für Berichts-Zeitraum
ALTER TABLE products ADD COLUMN IF NOT EXISTS month         INTEGER;

-- ── product_groups ─────────────────────────────────────────────
-- Neu: Mengendaten und Steueraufschlüsselung
ALTER TABLE product_groups ADD COLUMN IF NOT EXISTS total_quantity NUMERIC;
ALTER TABLE product_groups ADD COLUMN IF NOT EXISTS netto          NUMERIC;
ALTER TABLE product_groups ADD COLUMN IF NOT EXISTS mwst           NUMERIC;
ALTER TABLE product_groups ADD COLUMN IF NOT EXISTS month          INTEGER;

-- ── payments ──────────────────────────────────────────────────
-- Transaktionsanzahl pro Zahlungsart
ALTER TABLE payments ADD COLUMN IF NOT EXISTS transaction_count INTEGER;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS month            INTEGER;

-- ── sales ─────────────────────────────────────────────────────
-- Berichtszeitraum (aus Lightspeed-Header)
ALTER TABLE sales ADD COLUMN IF NOT EXISTS date_from TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS date_to   TEXT;
-- Monat ergänzen falls noch nicht vorhanden
ALTER TABLE sales ADD COLUMN IF NOT EXISTS month INTEGER;

-- ── employees ─────────────────────────────────────────────────
-- Storno-Statistiken (aus Stornos_pro_Mitarbeiter-Bericht)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS storno_count  INTEGER;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS storno_amount NUMERIC;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS month         INTEGER;

-- ── uploads ───────────────────────────────────────────────────
-- Metadaten aus Bericht-Header speichern
ALTER TABLE uploads ADD COLUMN IF NOT EXISTS report_name TEXT;
ALTER TABLE uploads ADD COLUMN IF NOT EXISTS company     TEXT;
ALTER TABLE uploads ADD COLUMN IF NOT EXISTS date_from   TEXT;
ALTER TABLE uploads ADD COLUMN IF NOT EXISTS date_to     TEXT;
ALTER TABLE uploads ADD COLUMN IF NOT EXISTS month       INTEGER;

-- ── Datenbereinigung (optional, nur wenn nötig) ──────────────
-- Bestehende NULL-Umsätze auf 0 setzen:
-- UPDATE products SET total_revenue = 0 WHERE total_revenue IS NULL;
-- Floating-Point-Fehler bereinigen:
-- UPDATE products SET total_revenue = ROUND(total_revenue::numeric, 2) WHERE total_revenue IS NOT NULL;
-- UPDATE product_groups SET total_revenue = ROUND(total_revenue::numeric, 2) WHERE total_revenue IS NOT NULL;
