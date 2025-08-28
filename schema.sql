-- SQL schema for the Sarcoma Investigative Research Network.
-- Run this script in your Supabase project's SQL editor to create the
-- necessary tables. Note that Supabase enables Row Level Security (RLS)
-- by default; you will need to define RLS policies according to your
-- application's access rules after creating the tables.

-- Users table mirrors Supabase Auth users for relational queries. You
-- should not insert into this table manually; users are created via
-- Supabase Auth.
create table if not exists users_app (
  id uuid primary key default uuid_generate_v4(),
  um_email text unique not null,
  name text not null,
  role text not null check (role in ('admin','owner','student')),
  created_at timestamptz not null default now()
);

-- Specialties represent the project boards (e.g. Rad Onc, Med Onc).
create table if not exists specialties (
  id uuid primary key default uuid_generate_v4(),
  name text unique not null,
  slug text unique not null,
  display_order int default 0,
  is_active boolean default true
);

-- Researcher profiles extend users for attending/fellow/resident/senior student.
create table if not exists researcher_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users_app(id) on delete cascade,
  position text not null check (position in ('attending','fellow','resident','senior_student')),
  specialty text not null,
  department text,
  institution text default 'UM/JMH',
  irb_training_exp date,
  mentorship_focus text,
  biosketch_url text
);

-- Student profiles extend users for volunteers.
create table if not exists student_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users_app(id) on delete cascade,
  year_program text not null,
  skills text[],
  interests text[],
  weekly_hours text,
  availability daterange,
  irb_training_exp date,
  cv_url text,
  portfolio_url text
);

-- Projects represent research initiatives.
create table if not exists projects (
  id uuid primary key default uuid_generate_v4(),
  specialty_id uuid not null references specialties(id),
  title text not null,
  description text,
  deliverables text[],
  irb_status text not null check (irb_status in ('approved','pending','exempt','not_needed')),
  irb_number text,
  start_date date,
  target_date date,
  progress_pct numeric default 0,
  status text not null default 'draft' check (status in ('active','draft','closed','archived')),
  created_at timestamptz default now()
);

-- Project owners link users to projects. Supports multiple owners per project.
create table if not exists project_owners (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null references users_app(id) on delete cascade,
  owner_position text not null check (owner_position in ('attending','fellow','resident','senior_student'))
);

-- Slots define roles on a project (e.g. chart review, stats analysis).
create table if not exists project_slots (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  role_name text not null,
  est_hours int not null,
  status text not null default 'open' check (status in ('open','assigned','closed')),
  description text
);

-- Applications track students applying for slots.
create table if not exists slot_applications (
  id uuid primary key default uuid_generate_v4(),
  slot_id uuid not null references project_slots(id) on delete cascade,
  student_id uuid not null references student_profiles(id) on delete cascade,
  status text not null default 'submitted' check (status in ('submitted','accepted','rejected','withdrawn')),
  note text,
  cv_url_snapshot text,
  submitted_at timestamptz default now(),
  decided_at timestamptz,
  decided_by_user_id uuid references users_app(id)
);

-- Assignments link a student to a slot once accepted. One assignment per slot.
create table if not exists slot_assignments (
  id uuid primary key default uuid_generate_v4(),
  slot_id uuid not null unique references project_slots(id) on delete cascade,
  student_id uuid not null references student_profiles(id) on delete cascade,
  assigned_at timestamptz default now(),
  note text
);

-- Milestones track progress on projects.
create table if not exists project_milestones (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  status text not null default 'todo' check (status in ('todo','in_progress','done')),
  due_date date,
  order_index int default 0,
  completion_pct numeric default 0
);

-- Resources store links to protocol documents, SOPs, folders, etc.
create table if not exists project_resources (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  type text not null, -- protocol | sop | drive | redcap | publication | other
  url text not null,
  label text
);

-- Audit log stores events for accountability.
create table if not exists audit_events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users_app(id) on delete cascade,
  action text not null, -- apply_slot | accept_app | reject_app | create_project | update_milestone | assign_student
  context jsonb,
  created_at timestamptz default now()
);

-- Optional: Trigger to enforce that senior students must have a supervisor.
-- Implement this constraint in your application logic or via a trigger function.