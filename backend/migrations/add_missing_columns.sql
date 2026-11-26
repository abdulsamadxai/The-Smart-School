-- One-time migration for an EXISTING Supabase database.
--
-- The app only creates missing tables; it never alters existing ones, so a
-- database created by an older version of the code is missing columns the
-- current models expect (this caused "no such column: students.challan_*"
-- and "NOT NULL constraint failed: students.contact_number" crashes).
--
-- Run this in the Supabase dashboard SQL Editor BEFORE pointing the
-- deployed backend at an existing database. Every statement is guarded
-- (IF NOT EXISTS), so it is safe to run more than once. A brand-new
-- database does not need it: the app creates the full schema on first boot.
--
-- If you are starting from a fresh database, skip this file entirely.

-- Students: challan fields, certificate fields, and every other field the
-- current model expects.
ALTER TABLE students ADD COLUMN IF NOT EXISTS registered_at TIMESTAMP;
ALTER TABLE students ADD COLUMN IF NOT EXISTS stage VARCHAR;
ALTER TABLE students ADD COLUMN IF NOT EXISTS class_enrolled VARCHAR;
ALTER TABLE students ADD COLUMN IF NOT EXISTS age_at_registration DOUBLE PRECISION;
ALTER TABLE students ADD COLUMN IF NOT EXISTS criteria_note VARCHAR;
ALTER TABLE students ADD COLUMN IF NOT EXISTS test_date VARCHAR;
ALTER TABLE students ADD COLUMN IF NOT EXISTS test_time VARCHAR;
ALTER TABLE students ADD COLUMN IF NOT EXISTS score_total_obtained DOUBLE PRECISION;
ALTER TABLE students ADD COLUMN IF NOT EXISTS score_total_possible DOUBLE PRECISION;
ALTER TABLE students ADD COLUMN IF NOT EXISTS score_subjects_json TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS decision VARCHAR;
ALTER TABLE students ADD COLUMN IF NOT EXISTS decision_at TIMESTAMP;
ALTER TABLE students ADD COLUMN IF NOT EXISTS gr_number VARCHAR;
ALTER TABLE students ADD COLUMN IF NOT EXISTS joined BOOLEAN;
ALTER TABLE students ADD COLUMN IF NOT EXISTS not_joined_reason VARCHAR;
ALTER TABLE students ADD COLUMN IF NOT EXISTS challan_monthly_fee DOUBLE PRECISION;
ALTER TABLE students ADD COLUMN IF NOT EXISTS challan_scholarship_pct DOUBLE PRECISION;
ALTER TABLE students ADD COLUMN IF NOT EXISTS challan_sibling_discount_pct DOUBLE PRECISION;
ALTER TABLE students ADD COLUMN IF NOT EXISTS challan_orphan_discount_pct DOUBLE PRECISION;
ALTER TABLE students ADD COLUMN IF NOT EXISTS challan_admission_fee DOUBLE PRECISION;
ALTER TABLE students ADD COLUMN IF NOT EXISTS challan_admission_scholarship_pct DOUBLE PRECISION;
ALTER TABLE students ADD COLUMN IF NOT EXISTS challan_annual_fee DOUBLE PRECISION;
ALTER TABLE students ADD COLUMN IF NOT EXISTS challan_security DOUBLE PRECISION;
ALTER TABLE students ADD COLUMN IF NOT EXISTS challan_security_scholarship_pct DOUBLE PRECISION;
ALTER TABLE students ADD COLUMN IF NOT EXISTS challan_other_dues DOUBLE PRECISION;
ALTER TABLE students ADD COLUMN IF NOT EXISTS challan_amount_paid DOUBLE PRECISION;
ALTER TABLE students ADD COLUMN IF NOT EXISTS certificate_issued VARCHAR;
ALTER TABLE students ADD COLUMN IF NOT EXISTS certificate_issued_at TIMESTAMP;
ALTER TABLE students ADD COLUMN IF NOT EXISTS leaving_date VARCHAR;
ALTER TABLE students ADD COLUMN IF NOT EXISTS leaving_reason VARCHAR;
ALTER TABLE students ADD COLUMN IF NOT EXISTS conduct_remarks VARCHAR;

-- The old schema had a NOT NULL contact_number column the current code
-- never sets. Keep the column (and any data in it) but allow NULLs.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'students' AND column_name = 'contact_number'
    ) THEN
        ALTER TABLE students ALTER COLUMN contact_number DROP NOT NULL;
    END IF;
END $$;

-- Fee records: payment method and invoice reference.
ALTER TABLE fee_records ADD COLUMN IF NOT EXISTS payment_method VARCHAR;
ALTER TABLE fee_records ADD COLUMN IF NOT EXISTS invoice_id VARCHAR;
ALTER TABLE fee_records ADD COLUMN IF NOT EXISTS cleared_at TIMESTAMP;
