-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- PATIENTS TABLE
create table if not exists patients (
  id uuid primary key default uuid_generate_v4(),
  medical_record_number text,
  name text not null,
  baby_name text,
  bed text,
  age integer,
  gestational_age_weeks integer,
  gestational_age_days integer,
  parity text,
  admission_date timestamp with time zone default now(),
  status text,
  blood_type text,
  risk_factors text[], -- Array of strings
  
  -- Protocols
  use_methyldopa boolean default false,
  methyldopa_start_time timestamp with time zone,
  methyldopa_end_time timestamp with time zone,
  
  use_magnesium_sulfate boolean default false,
  magnesium_sulfate_start_time timestamp with time zone,
  magnesium_sulfate_end_time timestamp with time zone,
  
  discharge_time timestamp with time zone,
  
  -- JSONB fields for complex structures
  schedule jsonb default '[]'::jsonb,
  last_observation jsonb,
  partogram_data jsonb,
  
  created_at timestamp with time zone default now()
);

-- OBSERVATIONS TABLE
create table if not exists observations (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid references patients(id) on delete cascade,
  timestamp timestamp with time zone default now(),
  
  -- JSONB fields for grouped data
  vitals jsonb,
  obstetric jsonb,
  medication jsonb,
  magnesium_data jsonb,
  
  examiner_name text,
  notes text,
  
  created_at timestamp with time zone default now()
);

-- CTGS TABLE
create table if not exists ctgs (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid references patients(id) on delete cascade,
  timestamp timestamp with time zone default now(),
  
  baseline integer,
  variability text,
  accelerations text,
  at_mf_ratio text,
  movements text,
  decelerations text,
  deceleration_details jsonb,
  contractions text,
  sound_stimulus text,
  stimulus_count text,
  score integer,
  conclusion text,
  notes text,
  
  created_at timestamp with time zone default now()
);

-- Create indexes for better performance
create index if not exists idx_patients_status on patients(status);
create index if not exists idx_observations_patient_id on observations(patient_id);
create index if not exists idx_ctgs_patient_id on ctgs(patient_id);

-- Enable Row Level Security (RLS) - Optional but recommended
alter table patients enable row level security;
alter table observations enable row level security;
alter table ctgs enable row level security;

-- Create policies to allow public access (for development/demo purposes)
-- WARNING: In a real production app, you should restrict this!
create policy "Allow public access to patients" on patients for all using (true);
create policy "Allow public access to observations" on observations for all using (true);
create policy "Allow public access to ctgs" on ctgs for all using (true);
