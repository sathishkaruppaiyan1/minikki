-- Fix OTP table to support phone_key while keeping phone_number constraint
-- This migration updates the existing table to match the working app pattern

-- Add phone_key column if it doesn't exist
ALTER TABLE otps ADD COLUMN IF NOT EXISTS phone_key VARCHAR(25);

-- Populate phone_key for existing records (if any)
UPDATE otps 
SET phone_key = '+91' || phone_number 
WHERE phone_key IS NULL AND phone_number IS NOT NULL;

-- Create unique index on phone_key (matches working app)
-- Note: We keep phone_number unique constraint for backward compatibility
CREATE UNIQUE INDEX IF NOT EXISTS idx_otps_phone_key_unique ON otps(phone_key) 
WHERE phone_key IS NOT NULL;

-- Ensure phone_number index exists (for fast lookups)
CREATE INDEX IF NOT EXISTS idx_otps_phone_number ON otps(phone_number);
