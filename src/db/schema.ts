// This file defines the database schema for the research network using Drizzle ORM.
// It mirrors the entity relationship model described in the project plan. Note
// that the Drizzle packages must be installed in your environment for this code
// to compile. See the README for setup instructions.

import {
  pgTable,
  uuid,
  text,
  date,
  timestamp,
  integer,
  numeric,
  boolean,
  serial,
  varchar,
} from 'drizzle-orm/pg-core';

// Users table stores basic authentication information. For this application,
// authentication is handled via Supabase Auth, but we mirror key fields here
// for relational queries.
export const users = pgTable('users_app', {
  id: uuid('id').primaryKey().defaultRandom(),
  umEmail: text('um_email').notNull().unique(),
  name: text('name').notNull(),
  role: text('role').notNull(), // admin | owner | student
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow(),
});

// Specialties represent the different boards (e.g. Rad Onc, Med Onc).
export const specialties = pgTable('specialties', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  slug: text('slug').notNull().unique(),
  displayOrder: integer('display_order').default(0),
  isActive: boolean('is_active').default(true),
});

// Researcher profiles extend users for attending/fellow/resident/senior student.
export const researcherProfiles = pgTable('researcher_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, {
    onDelete: 'cascade',
  }),
  position: text('position').notNull(), // attending | fellow | resident | senior_student
  specialty: text('specialty').notNull(),
  department: text('department'),
  institution: text('institution').default('UM/JMH'),
  irbTrainingExp: date('irb_training_exp'),
  mentorshipFocus: text('mentorship_focus'),
  biosketchUrl: text('biosketch_url'),
});

// Student profiles extend users for volunteers.
export const studentProfiles = pgTable('student_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, {
    onDelete: 'cascade',
  }),
  yearProgram: text('year_program').notNull(),
  skills: text('skills').array(),
  interests: text('interests').array(),
  weeklyHours: text('weekly_hours'),
  availability: text('availability'),
  irbTrainingExp: date('irb_training_exp'),
  cvUrl: text('cv_url'),
  portfolioUrl: text('portfolio_url'),
});

// Projects are the core entity representing research initiatives.
export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  specialtyId: uuid('specialty_id').notNull().references(() => specialties.id),
  title: text('title').notNull(),
  description: text('description'),
  deliverables: text('deliverables').array(),
  irbStatus: text('irb_status').notNull(), // approved | pending | exempt | not_needed
  irbNumber: text('irb_number'),
  startDate: date('start_date'),
  targetDate: date('target_date'),
  progressPct: numeric('progress_pct').default(0),
  status: text('status').notNull().default('draft'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Project owners link users to projects. Supports multiple owners per project.
export const projectOwners = pgTable('project_owners', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, {
    onDelete: 'cascade',
  }),
  userId: uuid('user_id').notNull().references(() => users.id, {
    onDelete: 'cascade',
  }),
  ownerPosition: text('owner_position').notNull(), // attending | fellow | resident | senior_student
});

// Slots define roles on a project (e.g. chart review, stats analysis).
export const projectSlots = pgTable('project_slots', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, {
    onDelete: 'cascade',
  }),
  roleName: text('role_name').notNull(),
  estHours: integer('est_hours').notNull(),
  status: text('status').notNull().default('open'), // open | assigned | closed
  description: text('description'),
});

// Applications track students applying for slots.
export const slotApplications = pgTable('slot_applications', {
  id: uuid('id').primaryKey().defaultRandom(),
  slotId: uuid('slot_id').notNull().references(() => projectSlots.id, {
    onDelete: 'cascade',
  }),
  studentId: uuid('student_id').notNull().references(() => studentProfiles.id, {
    onDelete: 'cascade',
  }),
  status: text('status').notNull().default('submitted'), // submitted | accepted | rejected | withdrawn
  note: text('note'),
  cvUrlSnapshot: text('cv_url_snapshot'),
  submittedAt: timestamp('submitted_at', { withTimezone: true }).defaultNow(),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  decidedByUserId: uuid('decided_by_user_id').references(() => users.id),
});

// Assignments link a student to a slot once accepted.
export const slotAssignments = pgTable('slot_assignments', {
  id: uuid('id').primaryKey().defaultRandom(),
  slotId: uuid('slot_id').notNull().unique().references(() => projectSlots.id, {
    onDelete: 'cascade',
  }),
  studentId: uuid('student_id').notNull().references(() => studentProfiles.id, {
    onDelete: 'cascade',
  }),
  assignedAt: timestamp('assigned_at', { withTimezone: true }).defaultNow(),
  note: text('note'),
});

// Milestones track progress on projects (e.g. IRB approval, chart reviews).
export const projectMilestones = pgTable('project_milestones', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, {
    onDelete: 'cascade',
  }),
  name: text('name').notNull(),
  status: text('status').notNull().default('todo'), // todo | in_progress | done
  dueDate: date('due_date'),
  orderIndex: integer('order_index').default(0),
  completionPct: numeric('completion_pct').default(0),
});

// Resources store links to protocol documents, SOPs, folders, etc.
export const projectResources = pgTable('project_resources', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, {
    onDelete: 'cascade',
  }),
  type: text('type').notNull(), // protocol | sop | drive | redcap | publication | other
  url: text('url').notNull(),
  label: text('label'),
});

// Audit log stores events for accountability.
export const auditEvents = pgTable('audit_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, {
    onDelete: 'cascade',
  }),
  action: text('action').notNull(), // apply_slot | accept_app | reject_app | create_project | update_milestone | assign_student
  context: text('context'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});