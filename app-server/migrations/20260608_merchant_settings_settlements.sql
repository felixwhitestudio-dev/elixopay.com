-- Migration: Add merchant_settings and settlements tables
-- Date: 2026-06-08
-- Purpose: Move localStorage data to server-side persistence

-- 1. Merchant Settings (one row per merchant)
CREATE TABLE IF NOT EXISTS merchant_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Business Profile
  business_name VARCHAR(255),
  business_type VARCHAR(100),
  business_email VARCHAR(255),
  business_phone VARCHAR(50),
  business_website VARCHAR(500),
  business_address TEXT,
  -- Payment Config
  default_currency VARCHAR(10) DEFAULT 'THB',
  auto_payout VARCHAR(20) DEFAULT 'manual',
  payment_description TEXT,
  test_mode BOOLEAN DEFAULT true,
  auto_capture BOOLEAN DEFAULT true,
  -- Notification Preferences
  notify_email_success BOOLEAN DEFAULT true,
  notify_email_fail BOOLEAN DEFAULT true,
  notify_email_payout BOOLEAN DEFAULT true,
  notify_daily_summary BOOLEAN DEFAULT false,
  notify_sms_high_value BOOLEAN DEFAULT false,
  notify_sms_security BOOLEAN DEFAULT true,
  -- Display Preferences
  timezone VARCHAR(50) DEFAULT 'Asia/Bangkok',
  date_format VARCHAR(20) DEFAULT 'DD/MM/YYYY',
  number_format VARCHAR(20) DEFAULT 'th-TH',
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_merchant_settings_user UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_merchant_settings_user ON merchant_settings(user_id);

-- 2. Settlements (payout history)
CREATE TABLE IF NOT EXISTS settlements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  bank_account_id UUID REFERENCES user_bank_accounts(id) ON DELETE SET NULL,
  amount DECIMAL(18,2) NOT NULL,
  fee DECIMAL(18,2) DEFAULT 0,
  net_amount DECIMAL(18,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'THB',
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed','cancelled')),
  reference_id VARCHAR(100),
  bank_name VARCHAR(50),
  account_number VARCHAR(50),
  account_name VARCHAR(255),
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  notes TEXT,
  completed_at TIMESTAMPTZ,
  failure_reason TEXT,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_settlements_user ON settlements(user_id);
CREATE INDEX IF NOT EXISTS idx_settlements_status ON settlements(status);
CREATE INDEX IF NOT EXISTS idx_settlements_created ON settlements(created_at DESC);
