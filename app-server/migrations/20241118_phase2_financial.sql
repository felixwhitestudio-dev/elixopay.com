-- Phase 2 Financial Layer Migration
-- Adds balances, ledger, withdrawals, payout accounts, commission overrides
-- Focus: support commission accrual, settlement, withdrawal lifecycle, override rules

-- 1) Agency balances: aggregate amounts (available/pending/reserved)
CREATE TABLE IF NOT EXISTS agency_balances (
  id SERIAL PRIMARY KEY,
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  currency VARCHAR(3) NOT NULL DEFAULT 'THB',
  available_amount NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (available_amount >= 0),
  pending_amount NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (pending_amount >= 0),
  reserved_amount NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (reserved_amount >= 0),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_agency_balances_agency_currency ON agency_balances(agency_id, currency);

-- 2) Payout accounts: destination accounts for withdrawals
CREATE TABLE IF NOT EXISTS payout_accounts (
  id SERIAL PRIMARY KEY,
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  type VARCHAR(30) NOT NULL, -- e.g. 'bank','promptpay','wallet'
  label VARCHAR(100) NOT NULL,
  account_details JSONB NOT NULL, -- structured destination info
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_payout_accounts_agency ON payout_accounts(agency_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_payout_accounts_default_per_agency ON payout_accounts(agency_id) WHERE is_default = true;

-- 3) Withdrawal requests: lifecycle PENDING -> APPROVED -> PROCESSING -> PAID/FAILED
CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id BIGSERIAL PRIMARY KEY,
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  payout_account_id INTEGER REFERENCES payout_accounts(id) ON DELETE SET NULL,
  amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'THB',
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','PROCESSING','PAID','FAILED','CANCELLED')),
  method VARCHAR(30) NOT NULL, -- snapshot of payout_accounts.type
  destination_details JSONB NOT NULL, -- snapshot for audit immutability
  requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  processed_at TIMESTAMP,
  failure_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_agency ON withdrawal_requests(agency_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON withdrawal_requests(status);

-- 4) Ledger entries: immutable financial event records per agency
-- Direction: C = credit (increase balance), D = debit (decrease balance)
-- Status: PENDING (awaiting settlement), POSTED (affects available), REVERSED (compensated), CANCELLED
CREATE TABLE IF NOT EXISTS ledger_entries (
  id BIGSERIAL PRIMARY KEY,
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- e.g. COMMISSION, SALE_SHARE, WITHDRAWAL_DEBIT, WITHDRAWAL_FEE, REFUND_REVERSAL
  direction CHAR(1) NOT NULL CHECK (direction IN ('C','D')),
  amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'THB',
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','POSTED','REVERSED','CANCELLED')),
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  withdrawal_request_id BIGINT REFERENCES withdrawal_requests(id) ON DELETE SET NULL,
  related_agency_id UUID REFERENCES agencies(id) ON DELETE SET NULL, -- origin or target for multi-level attribution
  description TEXT,
  available_at TIMESTAMP, -- when it becomes POSTED (e.g., after settlement delay)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_agency ON ledger_entries(agency_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_status ON ledger_entries(status);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_payment ON ledger_entries(payment_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_created ON ledger_entries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_pending ON ledger_entries(agency_id) WHERE status = 'PENDING';

-- 5) Commission overrides: per merchant site adjustments vs base commission_rules
CREATE TABLE IF NOT EXISTS commission_overrides (
  id SERIAL PRIMARY KEY,
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  merchant_site_id UUID NOT NULL REFERENCES merchant_sites(id) ON DELETE CASCADE,
  rule_type VARCHAR(30) NOT NULL, -- e.g. 'DIRECT','SUB_AGENCY','MERCHANT'
  rate NUMERIC(10,4) NOT NULL CHECK (rate >= 0), -- percent or flat depending on interpretation
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_commission_overrides_agency ON commission_overrides(agency_id);
CREATE INDEX IF NOT EXISTS idx_commission_overrides_merchant ON commission_overrides(merchant_site_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_commission_overrides_active ON commission_overrides(agency_id, merchant_site_id, rule_type) WHERE active = true;

-- Updated_at triggers (reuse existing function update_updated_at_column if present)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_payout_accounts_updated_at') THEN
    CREATE TRIGGER update_payout_accounts_updated_at BEFORE UPDATE ON payout_accounts
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_withdrawal_requests_updated_at') THEN
    CREATE TRIGGER update_withdrawal_requests_updated_at BEFORE UPDATE ON withdrawal_requests
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_commission_overrides_updated_at') THEN
    CREATE TRIGGER update_commission_overrides_updated_at BEFORE UPDATE ON commission_overrides
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END$$;

COMMENT ON TABLE agency_balances IS 'Aggregated monetary balances per agency and currency';
COMMENT ON TABLE payout_accounts IS 'Configured payout destinations for withdrawals';
COMMENT ON TABLE withdrawal_requests IS 'Agency withdrawal requests and lifecycle';
COMMENT ON TABLE ledger_entries IS 'Immutable financial ledger entries for agencies';
COMMENT ON TABLE commission_overrides IS 'Merchant-site specific commission override rates';
