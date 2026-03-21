create extension if not exists "pgcrypto";

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  provider text not null check (provider in ('hubspot', 'fathom')),
  status text not null check (status in ('connected', 'disconnected', 'error')),
  access_token text not null,
  refresh_token text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, provider)
);

create table if not exists deals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  external_id text not null,
  name text not null,
  stage text not null,
  outcome text not null check (outcome in ('open', 'won', 'lost')),
  amount integer,
  close_date date,
  closed_at timestamptz,
  company_name text not null,
  owner_name text,
  pipeline_name text not null,
  last_activity timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, external_id)
);

create table if not exists stage_transitions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  deal_id uuid not null references deals(id) on delete cascade,
  from_stage text,
  to_stage text not null,
  transitioned_at timestamptz not null,
  time_in_stage_hours numeric,
  created_at timestamptz not null default now()
);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  deal_id uuid references deals(id) on delete set null,
  source text not null check (source in ('fathom', 'hubspot')),
  event_type text not null check (
    event_type in (
      'meeting',
      'deal_stage_change',
      'deal_amount_change',
      'contact_activity',
      'deal_created',
      'deal_closed'
    )
  ),
  title text not null,
  summary text not null,
  occurred_at timestamptz not null,
  raw_payload jsonb not null,
  metadata jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  analyzer text not null,
  category text not null check (category in ('leak', 'pattern', 'risk')),
  severity text not null check (severity in ('high', 'medium', 'low')),
  title text not null,
  description text not null,
  data jsonb not null,
  affected_deals uuid[] not null default '{}',
  pipeline_name text,
  is_active boolean not null default true,
  generated_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists integrations_user_provider_idx on integrations(user_id, provider);
create index if not exists deals_user_pipeline_idx on deals(user_id, pipeline_name);
create index if not exists deals_user_stage_idx on deals(user_id, stage);
create index if not exists deals_user_outcome_idx on deals(user_id, outcome);
create index if not exists stage_transitions_deal_transitioned_idx on stage_transitions(deal_id, transitioned_at);
create index if not exists events_user_occurred_idx on events(user_id, occurred_at desc);
create index if not exists events_deal_occurred_idx on events(deal_id, occurred_at desc);
create index if not exists insights_user_analyzer_pipeline_idx on insights(user_id, analyzer, pipeline_name);
create index if not exists insights_user_category_active_idx on insights(user_id, category, is_active);
