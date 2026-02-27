-- Add missing columns to PATIENTS table
ALTER TABLE patients ADD COLUMN IF NOT EXISTS medical_record_number text;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS baby_name text;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS risk_factors text[];
ALTER TABLE patients ADD COLUMN IF NOT EXISTS use_methyldopa boolean default false;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS methyldopa_start_time timestamp with time zone;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS methyldopa_end_time timestamp with time zone;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS use_magnesium_sulfate boolean default false;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS magnesium_sulfate_start_time timestamp with time zone;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS magnesium_sulfate_end_time timestamp with time zone;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS schedule jsonb default '[]'::jsonb;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS last_observation jsonb;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS partogram_data jsonb;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS discharge_time timestamp with time zone;

-- Add missing columns to OBSERVATIONS table (just in case)
ALTER TABLE observations ADD COLUMN IF NOT EXISTS vitals jsonb;
ALTER TABLE observations ADD COLUMN IF NOT EXISTS obstetric jsonb;
ALTER TABLE observations ADD COLUMN IF NOT EXISTS medication jsonb;
ALTER TABLE observations ADD COLUMN IF NOT EXISTS magnesium_data jsonb;
ALTER TABLE observations ADD COLUMN IF NOT EXISTS examiner_name text;
ALTER TABLE observations ADD COLUMN IF NOT EXISTS notes text;

-- Force schema cache reload (Supabase/PostgREST specific)
NOTIFY pgrst, 'reload schema';
