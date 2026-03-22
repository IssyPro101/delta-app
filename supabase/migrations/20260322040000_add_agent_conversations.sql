create table if not exists agent_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  title text not null default 'New chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists agent_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references agent_conversations(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  message_id text not null,
  position integer not null,
  role text not null check (role in ('system', 'user', 'assistant')),
  parts jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (conversation_id, position),
  unique (conversation_id, message_id)
);

create index if not exists agent_conversations_user_updated_idx
on agent_conversations(user_id, updated_at desc);

create index if not exists agent_messages_conversation_position_idx
on agent_messages(conversation_id, position asc);
