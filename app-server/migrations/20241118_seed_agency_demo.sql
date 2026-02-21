-- Seed demo agency and membership for demo user, plus a default commission rule

-- 1) Ensure demo agency exists
WITH inserted AS (
  INSERT INTO agencies (name, code)
  SELECT 'Demo Agency', 'DEMO'
  WHERE NOT EXISTS (SELECT 1 FROM agencies WHERE code = 'DEMO')
  RETURNING id
), existing AS (
  SELECT id FROM agencies WHERE code = 'DEMO'
), agency AS (
  SELECT id FROM inserted
  UNION ALL
  SELECT id FROM existing
  LIMIT 1
), demo_user AS (
  SELECT id AS user_id FROM users WHERE email = 'demo@elixopay.com'
)
INSERT INTO agency_members (agency_id, user_id, role_in_agency)
SELECT agency.id, demo_user.user_id, 'owner'
FROM agency, demo_user
WHERE demo_user.user_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM agency_members WHERE agency_id = agency.id AND user_id = demo_user.user_id
);

-- 2) Ensure a default commission rule (5% PERCENT) exists for this agency
WITH agency AS (
  SELECT id FROM agencies WHERE code = 'DEMO' LIMIT 1
)
INSERT INTO commission_rules (agency_id, level, model, percent_value, is_active, created_at)
SELECT agency.id, 'DIRECT', 'PERCENT', 0.05, true, CURRENT_TIMESTAMP
FROM agency
WHERE agency.id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM commission_rules WHERE agency_id = agency.id AND is_active = true AND model = 'PERCENT'
);
