-- Phase 1 Agency System Migration
-- Creates foundational tables for agencies, members, merchant sites, commission rules

CREATE TABLE IF NOT EXISTS agencies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_id UUID REFERENCES agencies(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  status VARCHAR(30) DEFAULT 'active' CHECK (status IN ('active','suspended','closed')),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agency_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_in_agency VARCHAR(30) NOT NULL CHECK (role_in_agency IN ('owner','manager','finance','support')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS agency_members_unique ON agency_members(agency_id, user_id);
CREATE INDEX IF NOT EXISTS idx_agency_members_role ON agency_members(role_in_agency);

CREATE TABLE IF NOT EXISTS merchant_sites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  domain VARCHAR(255),
  contact_email VARCHAR(255),
  status VARCHAR(30) DEFAULT 'active' CHECK (status IN ('active','suspended','closed')),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_merchant_sites_agency ON merchant_sites(agency_id);
CREATE INDEX IF NOT EXISTS idx_merchant_sites_status ON merchant_sites(status);

CREATE TABLE IF NOT EXISTS commission_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  level VARCHAR(20) NOT NULL CHECK (level IN ('DIRECT','SUB_AGENCY','MERCHANT')),
  model VARCHAR(20) NOT NULL CHECK (model IN ('PERCENT','FLAT','TIER')),
  percent_value DECIMAL(7,4),
  flat_amount DECIMAL(12,2),
  min_amount DECIMAL(12,2),
  max_amount DECIMAL(12,2),
  tier_json JSONB,
  effective_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  effective_to TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_commission_rules_agency ON commission_rules(agency_id);
CREATE INDEX IF NOT EXISTS idx_commission_rules_active ON commission_rules(is_active);

-- Trigger for updated_at if function exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_agencies_updated_at') THEN
    CREATE TRIGGER update_agencies_updated_at BEFORE UPDATE ON agencies
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_merchant_sites_updated_at') THEN
    CREATE TRIGGER update_merchant_sites_updated_at BEFORE UPDATE ON merchant_sites
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END$$;

COMMENT ON TABLE agencies IS 'Top-level and nested agencies (parent_id creates hierarchy)';
COMMENT ON TABLE agency_members IS 'User membership within agencies with roles';
COMMENT ON TABLE merchant_sites IS 'Merchant websites managed by agencies/sub-agencies';
COMMENT ON TABLE commission_rules IS 'Commission configuration per agency level';