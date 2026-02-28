-- Create OTPs table for storing OTP codes (matches working app pattern)
CREATE TABLE IF NOT EXISTS otps (
  id BIGSERIAL PRIMARY KEY,
  phone_key VARCHAR(25) UNIQUE NOT NULL, -- "+919876543210" format (country code + phone)
  phone_number VARCHAR(20), -- 10-digit phone for compatibility
  otp VARCHAR(10) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  verified BOOLEAN DEFAULT FALSE
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_otps_phone_key ON otps(phone_key);
CREATE INDEX IF NOT EXISTS idx_otps_phone_number ON otps(phone_number);
CREATE INDEX IF NOT EXISTS idx_otps_expires_at ON otps(expires_at);

-- Create users table for storing authenticated users
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  phone_number VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(255),
  email VARCHAR(255),
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_phone_number ON users(phone_number);

-- Enable RLS (Row Level Security)
ALTER TABLE otps ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Allow all operations for Edge Functions (anon and service role)
-- OTPs table: allow insert/update/select/delete for functions
CREATE POLICY "Allow all OTP operations" ON otps FOR ALL USING (true) WITH CHECK (true);

-- Users table: allow all operations for functions
CREATE POLICY "Allow all user operations" ON users FOR ALL USING (true) WITH CHECK (true);
