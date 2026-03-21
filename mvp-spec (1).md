# MVP Spec — Pipeline Intelligence

**Scope:** 4 pages + 1 settings panel. Ingest deal and activity data, analyze pipeline health, surface patterns that differentiate winning deals from losing ones, and identify where deals leak.

---

## Pages

```
App
├── Pipeline       (where are deals leaking)
├── Insights       (patterns and findings)
├── Feed           (raw activity stream)
│   └── Event Detail (expandable drawer)
└── Settings
    └── Integrations (connection status)
```

---

## Global Layout

### Sidebar (left, always visible)

```
[App Logo / Name]

Pipeline       ← nav link
Insights       ← nav link
Feed           ← nav link
─────────────
Settings       ← nav link (integrations lives here)
```

Active page is highlighted. Sidebar is collapsed to icons on mobile/small screens.

### Top Bar

```
[Page Title]                          [User Avatar + Name]
```

No search, no notifications, no org switcher for MVP. User is identified by their auth session (see Auth below).

---

## Data Models

These are the actual database tables/collections. Every field is listed — nothing is implied.

### User

| Field        | Type     | Notes                          |
|-------------|----------|--------------------------------|
| id          | uuid     | primary key                    |
| email       | string   | unique, used for login         |
| name        | string   | display name                   |
| avatar_url  | string   | nullable, profile image        |
| created_at  | datetime |                                |

MVP supports a single user. No orgs, no teams, no roles.

### Integration

| Field           | Type     | Notes                                      |
|----------------|----------|--------------------------------------------|
| id             | uuid     | primary key                                |
| user_id        | uuid     | foreign key → User                         |
| provider       | enum     | `hubspot` or `fathom`                      |
| status         | enum     | `connected`, `disconnected`, `error`       |
| access_token   | string   | encrypted, from OAuth flow                 |
| refresh_token  | string   | encrypted, nullable                        |
| last_synced_at | datetime | nullable, last successful sync             |
| created_at     | datetime |                                            |

### Deal

| Field          | Type     | Notes                                             |
|---------------|----------|---------------------------------------------------|
| id            | uuid     | primary key                                       |
| user_id       | uuid     | foreign key → User                                |
| external_id   | string   | HubSpot deal ID                                   |
| name          | string   | e.g. "Acme — Enterprise Plan"                     |
| stage         | string   | current HubSpot pipeline stage                    |
| outcome       | enum     | `open`, `won`, `lost`                             |
| amount        | number   | deal value in cents, nullable                     |
| close_date    | date     | expected close, nullable                          |
| closed_at     | datetime | when the deal was actually closed, nullable       |
| company_name  | string   | denormalized from HubSpot for display             |
| owner_name    | string   | HubSpot deal owner, nullable                      |
| pipeline_name | string   | HubSpot pipeline name (e.g. "Default", "Enterprise") |
| last_activity | datetime | updated whenever a linked event comes in          |
| created_at    | datetime |                                                   |

Deals are created and updated exclusively by HubSpot sync. Users do not create deals manually. `outcome` is derived from the HubSpot deal stage — closed/won stages map to `won`, closed/lost stages map to `lost`, everything else is `open`.

### Stage Transition

Tracks every stage change for every deal. This is what powers pipeline analysis — conversion rates, time-in-stage, and leak detection.

| Field               | Type     | Notes                                           |
|--------------------|----------|-------------------------------------------------|
| id                 | uuid     | primary key                                     |
| user_id            | uuid     | foreign key → User                              |
| deal_id            | uuid     | foreign key → Deal                              |
| from_stage         | string   | previous stage, null if this is the first stage |
| to_stage           | string   | stage the deal moved into                       |
| transitioned_at    | datetime | when the transition happened                    |
| time_in_stage_hours | number  | hours spent in `from_stage` before this transition, null if first stage |
| created_at         | datetime |                                                 |

A StageTransition is created every time a `deal_stage_change` event is processed. `time_in_stage_hours` is calculated as the difference between this transition and the previous one for the same deal.

### Event

Every piece of incoming data becomes one Event. This is the raw activity layer.

| Field           | Type     | Notes                                                    |
|----------------|----------|----------------------------------------------------------|
| id             | uuid     | primary key                                              |
| user_id        | uuid     | foreign key → User                                       |
| deal_id        | uuid     | foreign key → Deal, nullable (not all events link to a deal) |
| source         | enum     | `fathom` or `hubspot`                                    |
| event_type     | enum     | see Event Types below                                    |
| title          | string   | human-readable, generated at ingest                      |
| summary        | string   | 1-3 sentence description of what happened                |
| occurred_at    | datetime | when the actual event happened (not when we ingested it) |
| raw_payload    | json     | full original data from source API, stored as-is         |
| metadata       | json     | structured extracted fields, schema varies by event_type |
| created_at     | datetime | when we ingested this event                              |

### Event Types and Their Metadata

Each `event_type` has a defined `metadata` shape. This is what the frontend reads for display.

**`meeting`** (source: fathom)
```json
{
  "duration_minutes": 45,
  "participants": ["sarah@acme.com", "you@company.com"],
  "recording_url": "https://fathom.video/...",
  "transcript_url": "https://fathom.video/.../transcript",
  "fathom_summary": "Customer asked about enterprise pricing and expressed concern about implementation timeline.",
  "key_topics": ["pricing", "timeline", "implementation"]
}
```

**`deal_stage_change`** (source: hubspot)
```json
{
  "previous_stage": "Discovery",
  "new_stage": "Proposal",
  "changed_by": "Sarah Chen"
}
```

**`deal_amount_change`** (source: hubspot)
```json
{
  "previous_amount": 50000,
  "new_amount": 75000
}
```

**`contact_activity`** (source: hubspot)
```json
{
  "activity_type": "email_opened",
  "contact_email": "buyer@acme.com",
  "contact_name": "Jane Doe"
}
```

**`deal_created`** (source: hubspot)
```json
{
  "stage": "Qualification",
  "amount": 50000,
  "pipeline": "Default"
}
```

**`deal_closed`** (source: hubspot)
```json
{
  "outcome": "won",
  "final_stage": "Closed Won",
  "total_days_in_pipeline": 45
}
```

### Insight

Insights are findings derived from analyzing deal and event data. The model is intentionally generic — different analyzers produce different insight types, but they all share the same structure.

| Field            | Type     | Notes                                              |
|-----------------|----------|----------------------------------------------------|
| id              | uuid     | primary key                                        |
| user_id         | uuid     | foreign key → User                                 |
| analyzer        | string   | which analyzer produced this (e.g. `stage_leak`, `velocity_comparison`) |
| category        | enum     | `leak`, `pattern`, `risk`                          |
| severity        | enum     | `high`, `medium`, `low`                            |
| title           | string   | human-readable headline                            |
| description     | string   | 2-4 sentence explanation of the finding            |
| data            | json     | structured supporting evidence, schema varies by analyzer |
| affected_deals  | uuid[]   | deal IDs this insight relates to                   |
| pipeline_name   | string   | which pipeline this insight applies to, nullable   |
| is_active       | boolean  | default true, set false when conditions change     |
| generated_at    | datetime | when the analysis ran                              |
| created_at      | datetime |                                                    |

### Analyzer Types

Each analyzer is a self-contained module that queries data and produces Insights. New analyzers can be added without changing the Insight model or any UI code — the frontend just renders whatever insights exist.

MVP ships with these analyzers:

**`stage_leak`** — Where are deals falling out of the pipeline?

Compares conversion rates between consecutive stages. If a stage has a significantly lower conversion rate than others, that's a leak. Runs against all deals (won + lost) in a pipeline.

```json
{
  "pipeline": "Default",
  "stage": "Proposal",
  "conversion_rate": 0.35,
  "pipeline_avg_conversion": 0.62,
  "deals_entered": 40,
  "deals_progressed": 14,
  "deals_lost": 26,
  "period": "last_90_days"
}
```

**`velocity_comparison`** — How do won deals move compared to lost deals?

Compares average time-in-stage between won and lost deals. Surfaces stages where lost deals linger significantly longer than won deals — indicating stall points.

```json
{
  "pipeline": "Default",
  "stage": "Discovery",
  "won_avg_days": 4.2,
  "lost_avg_days": 12.8,
  "difference_factor": 3.05,
  "won_deals_count": 18,
  "lost_deals_count": 22,
  "period": "last_90_days"
}
```

**`activity_pattern`** — What do reps do differently on deals they win?

Compares event patterns between won and lost deals: number of meetings, frequency of contact activity, time between activities. Surfaces behaviors that correlate with winning.

```json
{
  "pattern": "meeting_frequency",
  "won_avg": 3.4,
  "lost_avg": 1.2,
  "unit": "meetings per deal",
  "stage_context": "Discovery → Proposal",
  "won_deals_count": 18,
  "lost_deals_count": 22,
  "period": "last_90_days"
}
```

**`deal_risk`** — Which open deals are showing patterns similar to lost deals?

Compares each open deal's current trajectory (time in stage, activity frequency, meeting count) to the historical profile of lost deals. Flags deals that are tracking toward a loss.

```json
{
  "risk_factors": [
    { "factor": "time_in_stage", "current": 15, "lost_avg": 12.8, "won_avg": 4.2 },
    { "factor": "meetings_so_far", "current": 1, "lost_avg": 1.2, "won_avg": 3.4 }
  ],
  "similarity_to_lost": 0.82,
  "deal_id": "uuid",
  "deal_name": "Acme Enterprise",
  "current_stage": "Discovery",
  "days_in_stage": 15
}
```

### Analyzer Execution

Analyzers run in two scenarios:
1. **On webhook processing:** After the worker processes an event, it checks if the affected deal has enough data to warrant re-analysis. If the deal just closed (won or lost), all analyzers run for that pipeline. If a stage changed, `stage_leak` and `deal_risk` run.
2. **On backfill completion:** After a full backfill sync, all analyzers run across all pipelines.

When an analyzer runs, it marks previous insights from the same analyzer + pipeline as `is_active = false`, then creates new insights based on current data. This means insights always reflect the latest state — they're regenerated, not appended.

Analyzers are pure functions: `(deals, stage_transitions, events) → Insight[]`. No side effects, no external calls. This makes them easy to test and easy to add new ones.

---

## API Endpoints

### Pipeline
```
GET /api/pipeline
  Query params:
    pipeline_name — filter by pipeline, optional (default: all)
    period        — "last_30_days", "last_90_days", "last_180_days", "all_time" (default: last_90_days)
  Returns: {
    stages: [
      {
        name: string,
        deals_entered: number,
        deals_progressed: number,
        deals_lost: number,
        conversion_rate: number,
        avg_days_in_stage: number,
        avg_days_in_stage_won: number,
        avg_days_in_stage_lost: number
      }
    ],
    summary: {
      total_deals: number,
      won: number,
      lost: number,
      open: number,
      overall_win_rate: number,
      avg_deal_cycle_days: number
    },
    pipelines: string[]
  }
```

### Insights
```
GET /api/insights
  Query params:
    category      — filter by category (leak, pattern, risk), optional
    analyzer      — filter by analyzer name, optional
    is_active     — boolean, default true
    limit         — default 50
    offset        — default 0
  Returns: { insights: Insight[], total: number }
```

### Events
```
GET /api/events
  Query params:
    source    — filter by source (fathom, hubspot), optional
    deal_id   — filter by deal, optional
    limit     — pagination, default 50, max 200
    offset    — pagination offset, default 0
  Returns: { events: Event[], total: number }

GET /api/events/:id
  Returns: Event (full object including raw_payload)
```

### Deals
```
GET /api/deals
  Query params:
    stage     — filter by stage, optional
    outcome   — filter by outcome (open, won, lost), optional
    limit     — default 50
    offset    — default 0
  Returns: { deals: Deal[], total: number }

GET /api/deals/:id
  Returns: Deal (with stage_transitions included)
```

### Integrations
```
GET  /api/integrations
  Returns: Integration[] (without tokens)

POST /api/integrations/:provider/connect
  Body: { auth_code: string }  ← from OAuth callback
  Returns: Integration

POST /api/integrations/:provider/sync
  Enqueues a backfill job (re-fetches all historical data via REST API)
  Returns: { status: "started", job_id: string }

GET  /api/integrations/:provider/sync-status
  Returns: { status: "idle" | "running" | "error", last_synced_at: datetime }
```

### Webhooks (called by external providers, not by frontend)
```
POST /api/webhooks/hubspot
  Called by HubSpot when subscribed events occur
  Validates X-HubSpot-Signature-v3 header
  Returns: 200 OK (immediately)

POST /api/webhooks/fathom
  Called by Fathom when a meeting is processed
  Validates signature header
  Returns: 200 OK (immediately)
```

---

## Auth

Google Auth. User signs in with their Google account, session is stored as a JWT in an httpOnly cookie. Every API request checks the token and scopes all queries to that user's ID. No org/team scoping needed for MVP.

---

## Page Specifications

### 1. Pipeline Page

**Route:** `/pipeline` (also the default `/` redirect)

**Data source:** `GET /api/pipeline`

**Purpose:** Show where deals are leaking. A funnel visualization with conversion rates between each stage, plus time-in-stage comparisons between won and lost deals.

**Layout:**

```
┌──────────────────────────────────────────────────────────┐
│ Pipeline                                                  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  [Pipeline: Default ▼]   [Period: Last 90 days ▼]       │
│                                                          │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐     │
│  │Total │  │Won   │  │Lost  │  │Win   │  │Avg   │      │
│  │Deals │  │      │  │      │  │Rate  │  │Cycle │      │
│  │ 84   │  │ 32   │  │ 38   │  │ 38%  │  │ 34d  │      │
│  └──────┘  └──────┘  └──────┘  └──────┘  └──────┘      │
│                                                          │
│  FUNNEL                                                  │
│  ─────────────────────────────────────────────────────   │
│                                                          │
│  Qualification          84 deals                         │
│  ████████████████████████████████████████  → 75%         │
│                                                          │
│  Discovery              63 deals                         │
│  ██████████████████████████████  → 68%                   │
│                                                          │
│  Proposal               43 deals                ⚠️ LEAK │
│  █████████████████████  → 35%                            │
│                                                          │
│  Negotiation            15 deals                         │
│  ████████  → 87%                                         │
│                                                          │
│  Closed                 13 deals                         │
│                                                          │
│  STAGE HEALTH                                            │
│  ─────────────────────────────────────────────────────   │
│                                                          │
│  Stage          │ Conv. │ Won avg │ Lost avg │ Gap       │
│  ───────────────┼───────┼─────────┼──────────┼────────   │
│  Qualification  │  75%  │  3.1d   │  5.4d    │  +2.3d   │
│  Discovery      │  68%  │  4.2d   │  12.8d   │  +8.6d ⚠️│
│  Proposal       │  35%  │  5.0d   │  6.1d    │  +1.1d   │
│  Negotiation    │  87%  │  3.8d   │  4.2d    │  +0.4d   │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Funnel display rules:**
- Bar width is proportional to deal count relative to the first stage
- Conversion rate is shown as the percentage of deals that progressed to the next stage (not lost or still open)
- ⚠️ LEAK flag appears when conversion rate is more than 20 percentage points below the pipeline average

**Stage Health table:**
- "Won avg" and "Lost avg" are average days in that stage for won vs lost deals
- "Gap" is the difference — large gaps indicate stall points where lost deals linger
- ⚠️ flag appears when the gap is more than 2x the won average

**Interactions:**
- Pipeline dropdown → re-fetches data filtered by selected pipeline
- Period dropdown → re-fetches data for selected time window
- Click a stage name in the funnel → navigates to `/feed?stage={stage_name}` showing all events for deals currently in that stage
- Click ⚠️ LEAK → navigates to `/insights?analyzer=stage_leak&stage={stage_name}` showing the relevant insight

**Empty state:** "Not enough data to analyze your pipeline yet. Connect HubSpot in Settings and sync your deal history." Link to `/settings`.

**Minimum data threshold:** Pipeline page requires at least 10 closed deals (won + lost combined) before rendering the funnel. Below that, show: "Need more closed deal data to show meaningful conversion rates. Currently tracking {n} closed deals — analysis begins at 10."

**Loading state:** Skeleton placeholders for KPI strip and funnel bars.

**Error state:** "Couldn't load pipeline data. Try refreshing." with a retry button.

---

### 2. Insights Page

**Route:** `/insights`

**Data source:** `GET /api/insights`

**Purpose:** Show patterns and findings derived from deal data. Each insight is a self-contained card with a headline, explanation, and supporting evidence.

**URL params:**
- `category` — optional, filters by insight category
- `analyzer` — optional, filters by analyzer type

**Layout:**

```
┌──────────────────────────────────────────────────────────┐
│ Insights                                                  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  [All] [Leaks] [Patterns] [Risks]    ← category tabs    │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ 🔴 LEAK                                          │   │
│  │ Proposal stage is losing 65% of deals            │   │
│  │                                                   │   │
│  │ Over the last 90 days, only 35% of deals that    │   │
│  │ reached Proposal moved to Negotiation. The        │   │
│  │ pipeline average is 62%. 26 deals were lost at    │   │
│  │ this stage.                                       │   │
│  │                                                   │   │
│  │ Affected deals: Acme, Northstar, + 24 more       │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ 🟡 PATTERN                                        │   │
│  │ Won deals average 3.4 meetings in Discovery,     │   │
│  │ lost deals average 1.2                            │   │
│  │                                                   │   │
│  │ Deals that progressed past Discovery had          │   │
│  │ significantly more meetings during that stage.    │   │
│  │ This suggests more engagement early in the        │   │
│  │ process correlates with winning.                  │   │
│  │                                                   │   │
│  │ Based on 18 won and 22 lost deals                 │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ 🔴 RISK                                           │   │
│  │ Acme Enterprise is tracking like a lost deal     │   │
│  │                                                   │   │
│  │ This deal has been in Discovery for 15 days.     │   │
│  │ Lost deals average 12.8 days in this stage,      │   │
│  │ while won deals average 4.2. Only 1 meeting has  │   │
│  │ occurred — lost deals average 1.2 at this point, │   │
│  │ won deals average 3.4.                            │   │
│  │                                                   │   │
│  │ 82% similarity to lost deal pattern               │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  [ Load more ]                                           │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Insight card display rules:**
- Category badge color: red for `leak` and `risk`, yellow for `pattern`
- Title: `insight.title`
- Body: `insight.description`
- Evidence line: pulled from `insight.data`, formatted per analyzer type
- Affected deals: if `affected_deals` is non-empty, show first 2 deal names + count of remaining

**Interactions:**
- Click category tab → filters insights by category
- Click an affected deal name → navigates to `/feed?deal_id={deal_id}` showing all events for that deal

**Empty state:** "No insights yet. Insights are generated as deal data is analyzed — they'll appear here once enough deals have closed."

**Loading state:** Skeleton insight cards.

---

### 3. Feed Page

**Route:** `/feed`

**Data source:** `GET /api/events` with filters applied via query params

**Purpose:** Raw chronological stream of everything that happened across all deals. The inspection layer — drill into any event to see details.

**URL params:**
- `source` — optional, filters by integration source
- `deal_id` — optional, filters events for a specific deal
- `event` — optional, if present, auto-opens the detail drawer for that event ID

**Layout:**

```
┌──────────────────────────────────────────────────────────┐
│ Feed                                                      │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  [All] [Fathom] [HubSpot]    ← filter tabs              │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ 🟣 Fathom Meeting — Acme                         │   │
│  │ Customer asked about pricing and                  │   │
│  │ implementation timeline                           │   │
│  │ 10:32 AM                                          │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ 🟠 Deal Stage Change — Northstar                 │   │
│  │ Moved from Discovery to Proposal                 │   │
│  │ 9:10 AM                                           │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ 🟠 Deal Closed — Blueleaf                        │   │
│  │ Closed Won after 34 days in pipeline             │   │
│  │ Yesterday                                         │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  [ Load more ]                                           │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Event card display rules:**
- Color dot: purple for `fathom`, orange for `hubspot`
- Title: `{event_type label} — {deal company_name or "No deal"}`
- Body: `event.summary` (the 1-3 sentence summary)
- Timestamp: `occurred_at`, shown as relative time if < 24h, otherwise date

**Event type labels:**
| event_type           | Display Label         |
|---------------------|-----------------------|
| meeting             | Fathom Meeting        |
| deal_stage_change   | Deal Stage Change     |
| deal_amount_change  | Deal Amount Change    |
| contact_activity    | Contact Activity      |
| deal_created        | New Deal              |
| deal_closed         | Deal Closed           |

**Interactions:**
- Click filter tab → updates `source` query param, re-fetches events
- Click event card → opens Event Detail drawer (see below)
- "Load more" → fetches next page (offset += limit)
- If `deal_id` is in the URL, show a banner at the top: "Showing events for {deal_name}" with a ✕ to clear the filter

**Empty state:** "No events yet. Once your integrations are syncing, activity will appear here."

**Loading state:** Skeleton cards (3-5 grey rectangles with line placeholders).

---

### 3a. Event Detail Drawer

Opens as a right-side drawer (slides in from right, ~480px wide) overlaying the feed. Does not navigate away from `/feed`.

**Data source:** `GET /api/events/:id` (the full event including raw_payload and metadata)

**Layout:**

```
┌──────────────────────────────────┐
│ ✕  Fathom Meeting — Acme        │
├──────────────────────────────────┤
│                                  │
│  Occurred: March 20, 2026 10:32  │
│  Source: Fathom                  │
│  Deal: Acme Enterprise Plan     │
│  Deal Stage: Discovery           │
│  Deal Outcome: Open              │
│                                  │
│  Summary                         │
│  ──────                          │
│  Customer asked about enterprise │
│  pricing and expressed concern   │
│  about implementation timeline.  │
│                                  │
│  Details                         │
│  ──────                          │
│  Duration: 45 minutes            │
│  Participants:                   │
│    sarah@acme.com                │
│    you@company.com               │
│  Topics: pricing, timeline,      │
│          implementation          │
│                                  │
│  Links                           │
│  ──────                          │
│  📹 Recording                    │
│  📄 Transcript                   │
│                                  │
└──────────────────────────────────┘
```

**Detail section content depends on event_type:**

| event_type          | "Details" section shows                              |
|--------------------|------------------------------------------------------|
| meeting            | duration, participants, topics, recording/transcript links |
| deal_stage_change  | previous stage, new stage, changed by                |
| deal_amount_change | previous amount, new amount                          |
| contact_activity   | activity type, contact name, contact email           |
| deal_created       | stage, amount, pipeline                              |
| deal_closed        | outcome, final stage, total days in pipeline         |

All pulled from `event.metadata`.

**Interactions:**
- ✕ button or clicking outside drawer → closes drawer
- Deal name is a link → clicking it sets `deal_id` filter on the feed to show all events for that deal
- Recording/transcript URLs open in new tab (external links to Fathom)

---

### 4. Settings — Integrations

**Route:** `/settings` (integrations is the only settings content in MVP)

**Data source:** `GET /api/integrations`

**Layout:**

```
┌──────────────────────────────────────────────────────────┐
│ Settings                                                  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Integrations                                            │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ HubSpot                                           │   │
│  │ Status: ✅ Connected                              │   │
│  │ Last synced: 2 minutes ago                        │   │
│  │                                                   │   │
│  │ Syncs: Deals (all stages + closed), Contacts,     │   │
│  │        Stage changes, Deal outcomes               │   │
│  │                                                   │   │
│  │ [Sync Now]  [Disconnect]                          │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Fathom                                            │   │
│  │ Status: ⚪ Not connected                          │   │
│  │                                                   │   │
│  │ Syncs: Meetings, Transcripts                      │   │
│  │                                                   │   │
│  │ [Connect]                                         │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ─────────────────────────────────────────────────────   │
│  Data access: Read-only. This app does not send emails   │
│  or modify your CRM data.                                │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Integration states:**
| status        | Display                              | Actions available      |
|--------------|--------------------------------------|------------------------|
| disconnected | "⚪ Not connected"                   | [Connect]              |
| connected    | "✅ Connected" + last sync time      | [Sync Now] [Disconnect]|
| error        | "🔴 Connection error" + error detail | [Reconnect]            |

**Interactions:**
- [Connect] → initiates OAuth flow (redirects to provider, returns with auth code, calls `POST /api/integrations/:provider/connect`)
- [Sync Now] → calls `POST /api/integrations/:provider/sync` to enqueue a backfill job (re-fetches all historical data via REST API). Button shows spinner until complete.
- [Disconnect] → confirmation dialog ("Disconnect HubSpot? Existing data will be kept but no new data will sync."), then deletes the integration record and clears tokens

**Sync Now loading:** Button text changes to "Syncing..." with a spinner. Poll `GET /api/integrations/:provider/sync-status` every 3 seconds until status is `idle` or `error`. On completion, refresh the integration card to show updated `last_synced_at`.

---

## Sync Pipeline

This is how data gets from HubSpot/Fathom into your database. Both providers support webhooks, so data flows in real-time.

### Webhook Endpoints

```
POST /api/webhooks/hubspot   ← registered in HubSpot webhook settings
POST /api/webhooks/fathom    ← registered in Fathom webhook settings
```

Both endpoints must:
1. Verify the request signature (HubSpot signs with your app secret, Fathom signs with a shared secret) — reject unsigned or invalid requests
2. Enqueue the raw payload onto the appropriate BullMQ queue
3. Respond with 200 immediately — all processing happens in the worker
4. Be idempotent — use the provider's event ID as the BullMQ job ID so duplicate webhooks are ignored automatically

### Queue Architecture

Three BullMQ queues, all backed by the same Redis instance:

| Queue              | Producer                     | What it processes                              |
|-------------------|------------------------------|------------------------------------------------|
| `webhook.hubspot` | Webhook endpoint             | Single HubSpot webhook event                   |
| `webhook.fathom`  | Webhook endpoint             | Single Fathom webhook event                    |
| `backfill`        | Integration connect / Sync Now | Full historical backfill for a provider       |

BullMQ workers registered in the same process consume all three queues. Each job follows the same pattern: process the external data → upsert Deal if applicable → create StageTransition if stage changed → create Event → run relevant analyzers.

Failed jobs retry 3 times with exponential backoff (1s, 10s, 60s). After 3 failures, the job moves to the dead letter queue for manual inspection.

### HubSpot Webhook Flow

HubSpot sends webhook events for subscribed actions. Subscribe to these event types during OAuth app setup:
- `deal.creation`
- `deal.propertyChange` (properties: `dealstage`, `amount`, `closedate`, `hs_is_closed_won`)
- `deal.deletion`
- `contact.propertyChange` (for email activity tracking)

Worker picks up a `webhook.hubspot` job and:
1. Parse the event type and object ID from the payload
2. Fetch the full deal/contact record from HubSpot API using the object ID (webhooks only send the changed property, not the full object)
3. Upsert into Deal table (match on `external_id`), including `outcome` derived from HubSpot's closed status
4. If stage changed:
   - Create a StageTransition record (calculate `time_in_stage_hours` from the previous transition)
   - Create `deal_stage_change` Event
5. If deal just closed → create `deal_closed` Event
6. If amount changed → create `deal_amount_change` Event
7. If contact activity → create `contact_activity` Event, linked to Deal via association lookup
8. If new deal → create `deal_created` Event
9. Update `integration.last_synced_at`
10. Run analyzers (see Analyzer Execution above)

### Fathom Webhook Flow

Fathom sends a webhook when a meeting recording is processed and ready.

Worker picks up a `webhook.fathom` job and:
1. Fetch the full meeting details from Fathom API using the meeting ID in the payload
2. Match to a Deal by participant email (look up contact emails in Deal's HubSpot contacts)
3. If no match found, `deal_id` is null
4. Create `meeting` Event with metadata extracted from Fathom's response
5. Update `integration.last_synced_at`
6. Run `deal_risk` and `activity_pattern` analyzers for the affected deal's pipeline

### Initial Backfill (on first connect)

Webhooks only send future events. When a user first connects an integration, enqueue a `backfill` job. Backfill fetches **all available historical data** — the more closed deals (won and lost), the better the analysis.

1. **HubSpot:** Fetch all deals (open, won, and lost) with full property history. For each deal, reconstruct stage transitions from the property change history. Create Deal records, StageTransition records, and Events for each.
2. **Fathom:** Fetch all available meetings. Create Events for each, matched to deals where possible.

After backfill completes, run all analyzers across all pipelines.

This is also what the "Sync Now" button in Settings triggers.

### Analyzer Execution

After the worker processes any webhook or backfill job:
1. Determine which analyzers need to run based on what changed (see Analyzer Execution rules in the Analyzer Types section above)
2. For each analyzer that runs: mark previous insights from that analyzer + pipeline as `is_active = false`, then generate new insights from current data
3. For absence-based risk detection (`deal_risk` checking stalled open deals): a daily Supabase cron job runs the `deal_risk` analyzer across all open deals in all pipelines

---

## Frontend Routing

```
/               → redirect to /pipeline
/pipeline       → Pipeline page
/insights       → Insights page (optional ?category=leak|pattern|risk&analyzer={name})
/feed           → Feed page (optional ?source=fathom|hubspot&deal_id={id}&event={id})
/settings       → Settings/Integrations page
/auth/signin    → Google Auth sign-in
```

All routes except `/auth/signin` require authentication. If no valid session, redirect to Google Auth.

---

## Tech Stack

| Layer     | Choice                    | Reasoning                        |
|----------|---------------------------|----------------------------------|
| Monorepo | Turborepo                 | shared types/config, single repo |
| Frontend | Next.js (App Router)      | routing, SSR, fast to build      |
| Styling  | Tailwind CSS              | no design system needed          |
| Backend  | Node.js + Fastify         | separate server, clean API boundary |
| Database | Supabase (PostgreSQL)     | hosted Postgres, built-in cron, auth helpers |
| Data Access | `@supabase/supabase-js` | typed API client against Supabase without a second ORM layer |
| Auth     | Google Auth               | single sign-on, no password management |
| Queue    | BullMQ + Redis            | webhook processing, backfill jobs, analyzer runs |
| Jobs     | Supabase Cron             | daily job for deal risk analysis |
| Hosting  | Vercel (frontend), Railway/Render (server) | frontend and backend deployed independently |

---

## Monorepo Structure

```
/
├── apps/
│   ├── web/                  ← Next.js frontend
│   │   ├── app/              ← App Router pages
│   │   ├── components/       ← React components
│   │   ├── lib/              ← Frontend utilities, API client
│   │   └── package.json
│   │
│   └── server/               ← Fastify API + BullMQ worker (single process)
│       ├── src/
│       │   ├── routes/       ← API route handlers
│       │   ├── services/     ← Business logic (events, deals, pipeline)
│       │   ├── webhooks/     ← Webhook signature validation + enqueue
│       │   ├── workers/      ← BullMQ job processors (hubspot, fathom, backfill)
│       │   ├── analyzers/    ← Insight analyzers (stage_leak, velocity_comparison, etc.)
│       │   └── index.ts      ← Starts Fastify server + registers queue workers
│       └── package.json
│
├── packages/
│   ├── shared/               ← Shared types and constants
│   │   ├── src/
│   │   │   ├── types.ts      ← Event, Deal, Insight, StageTransition types
│   │   │   ├── enums.ts      ← event_type, outcome, category enums
│   │   │   └── constants.ts  ← analyzer thresholds, sync config
│   │   └── package.json
│   │
│   └── db/                   ← Supabase client + database schema types
│       ├── src/
│       │   ├── client.ts     ← Configured Supabase client export
│       │   ├── database.types.ts ← Supabase schema types for type-safe queries
│       │   └── index.ts
│       └── package.json
│
├── supabase/
│   └── migrations/           ← SQL schema and future migrations
│
├── turbo.json
├── package.json              ← Root workspace config
└── .env                      ← Shared env vars (Supabase URL, Redis URL, etc.)
```

`apps/server` depends on `packages/shared` and `packages/db`. `apps/web` depends on `packages/shared` for type definitions. On startup, `index.ts` boots the Fastify HTTP server and registers BullMQ workers in the same process — webhooks come in through the routes, get enqueued, and are consumed by the workers all within one service.
