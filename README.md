# Delta — Pipeline Intelligence

Pipeline health, insights, and activity intelligence for sales teams.

Delta integrates with your CRM (HubSpot) and meeting tools (Fathom) to surface real-time pipeline insights, risk detection, and an AI copilot that helps you close more deals.

## Architecture

```
delta-app/
├── apps/
│   ├── web/          # Next.js frontend (App Router)
│   ├── server/       # Fastify API server
│   └── agent/        # AI copilot server
├── packages/
│   ├── db/           # Supabase client & types
│   └── shared/       # Shared types, enums, constants
└── supabase/
    └── migrations/   # PostgreSQL schema
```

**Monorepo tooling:** Yarn workspaces + Turborepo

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4 |
| Backend API | Fastify 5 |
| AI Agent | Fastify 5, Vercel AI SDK, Anthropic/OpenAI |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (JWT) |
| Job Queue | BullMQ + Redis |
| Integrations | HubSpot API, Fathom API |
| Language | TypeScript 5.9 (strict) |

## Features

### Pipeline Dashboard
View pipeline metrics by stage with configurable time periods (30/90/180 days, all-time). Track conversion rates, deal velocity, and stage-level performance.

### Deal Management
Browse and search deals with health scoring based on activity recency and risk signals. Drill into individual deals for full context — stage history, events, and related insights.

### Insight Engine
Four built-in analyzers continuously evaluate your pipeline:

- **Stage Leak Analyzer** — detects pipeline stages losing an abnormal number of deals
- **Deal Risk Analyzer** — flags at-risk deals based on activity patterns
- **Velocity Comparison** — identifies deals moving slower than peers
- **Activity Pattern Analyzer** — surfaces engagement trends across contacts

Insights are categorized by type (leak, pattern, risk) and severity (high, medium, low).

### Activity Feed
Real-time timeline of events from connected integrations — meetings, stage changes, contact activity, and more.

### AI Copilot (Delta)
A streaming conversational agent with tool-use capabilities:

- **get_workspace_snapshot** — pipeline overview
- **get_pipeline_summary** — metrics by pipeline and period
- **list_active_insights** — filtered risk and insight data
- **find_deals** — deal search with filters
- **get_deal_context** — deal details with related insights
- **get_recent_activity** — activity timeline
- **HubSpot actions** — create tasks, notes, and emails directly from chat

Supports both Anthropic (Claude) and OpenAI (GPT) as the underlying model provider.

### Integrations

**HubSpot** — OAuth-based connection that syncs deals, contacts, and activities (emails, notes, calls, tasks). Supports webhooks for real-time updates and background backfill via job queue.

**Fathom** — Meeting recording integration that pulls transcripts, summaries, and meeting metadata (participants, duration).

## Getting Started

### Prerequisites

- Node.js 18+
- Yarn 1.x
- Redis (for BullMQ job queue)
- Supabase project (or local Supabase CLI)

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd delta-app

# Install dependencies
yarn install
```

### Environment Variables

Copy the example env files in each app and fill in the values:

```bash
cp apps/web/.env.example apps/web/.env.local
cp apps/server/.env.example apps/server/.env
cp apps/agent/.env.example apps/agent/.env
```

**Web** (`apps/web/.env.local`):
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
AGENT_BASE_URL=http://localhost:4100
```

**Server** (`apps/server/.env`):
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
REDIS_URL=
HUBSPOT_CLIENT_ID=
HUBSPOT_CLIENT_SECRET=
HUBSPOT_REDIRECT_URI=
HUBSPOT_WEBHOOK_SECRET=
FATHOM_CLIENT_ID=
FATHOM_CLIENT_SECRET=
FATHOM_REDIRECT_URI=
FATHOM_WEBHOOK_SECRET=
SESSION_SECRET=
TOKEN_ENCRYPTION_KEY=
CRON_SECRET=
SERVER_BASE_URL=http://localhost:4000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Agent** (`apps/agent/.env`):
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SERVER_BASE_URL=http://localhost:4000
AGENT_PORT=4100
AI_PROVIDER=openai          # or "anthropic"
OPENAI_API_KEY=
OPENAI_MODEL=
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=
HUBSPOT_CLIENT_ID=
HUBSPOT_CLIENT_SECRET=
TOKEN_ENCRYPTION_KEY=
```

### Database Setup

Run the Supabase migrations to create the schema:

```bash
supabase db push
```

### Development

Start all apps in parallel:

```bash
yarn dev
```

This runs Turborepo which starts:
- **Web** at `http://localhost:3000`
- **Server** at `http://localhost:4000`
- **Agent** at `http://localhost:4100`

### Build

```bash
yarn build
```

### Type Checking

```bash
yarn typecheck
```

## Database Schema

Core tables in Supabase PostgreSQL:

| Table | Purpose |
|-------|---------|
| `users` | User accounts (email, name, avatar) |
| `integrations` | Connected CRM accounts with OAuth tokens |
| `deals` | Sales opportunities (stage, amount, outcome) |
| `stage_transitions` | Deal movement history with timestamps |
| `events` | Activities — meetings, stage changes, contact interactions |
| `insights` | AI-generated pipeline intelligence |
| `agent_conversations` | Chat sessions with the Delta copilot |
| `agent_messages` | Individual messages within conversations |

## API Routes

### Server (`localhost:4000`)

| Route | Description |
|-------|-------------|
| `/api/auth/*` | Session management |
| `/api/dashboard/*` | Pipeline metrics and deal data |
| `/api/deals/*` | Deal queries and details |
| `/api/pipeline/*` | Pipeline analytics |
| `/api/insights/*` | Generated insights |
| `/api/events/*` | Activity events |
| `/api/integrations/*` | OAuth and sync management |
| `/api/agent-context/*` | Context for AI agent |
| `/api/webhooks/*` | Integration webhooks |
| `/health` | Health check |

### Agent (`localhost:4100`)

| Route | Description |
|-------|-------------|
| `GET /api/agent/conversations` | List conversations |
| `POST /api/agent/conversations` | Create new conversation |
| `GET /api/agent/conversations/:id/messages` | Fetch messages |
| `POST /api/agent/chat` | Stream agent response |

## Background Jobs

BullMQ workers handle async processing via Redis:

- **Backfill** — initial data sync when an integration is first connected
- **Webhooks** — processing incoming CRM webhook payloads
- **Analyzers** — running insight generators across the pipeline
- **Token Refresh** — rotating OAuth tokens before expiry

## Project Structure

```
apps/web/
├── app/                      # Next.js App Router
│   ├── (auth)/               # Login/signup pages
│   ├── (dashboard)/          # Main app pages
│   │   ├── pipeline/         # Pipeline metrics
│   │   ├── deals/            # Deal list & detail
│   │   ├── insights/         # Risk & pattern insights
│   │   ├── feed/             # Activity timeline
│   │   └── settings/         # Configuration
│   └── api/                  # Next.js API routes (proxy)
├── components/               # React components
└── lib/                      # Utilities, API helpers

apps/server/
├── src/
│   ├── routes/               # Fastify route handlers
│   ├── services/             # Business logic
│   ├── analyzers/            # Insight generation
│   ├── integrations/         # HubSpot, Fathom clients
│   ├── workers/              # BullMQ job processors
│   └── webhooks/             # Webhook handlers

apps/agent/
├── src/
│   ├── services/             # Agent loop, conversations
│   ├── plugins/              # Auth middleware
│   └── routes/               # Agent API endpoints

packages/db/                  # Supabase client wrapper
packages/shared/              # Shared types & enums
```
