# CLAUDE.md - AI Assistant Guide for qwicky-discord-bot

This document provides guidance for AI assistants working with the QWICKY Discord Bot codebase.

## Project Overview

QWICKY Discord Bot is a Node.js application that bridges Discord and the QWICKY tournament admin web app. Players submit QuakeWorld match results by posting Hub URLs in registered Discord channels. The bot fetches game stats, stores submissions in Supabase, and provides admin review via embeds with approve/reject buttons. It also handles scheduling, daily reminders, automated game discovery, and weekly activity reports.

**Tech Stack:**
- Node.js 20 (CommonJS modules)
- discord.js 14.x
- Supabase (PostgreSQL via JS client, service role key)
- Deployed on Fly.io (Dockerfile + fly.toml)

**Companion project:** The tournament admin frontend lives in a separate repo at `../qwicky/` (React + Vite, Vercel).

## Quick Start

```bash
# Install dependencies
npm install

# Copy env template and fill in credentials
cp .env.example .env

# Register slash commands with Discord
npm run deploy-commands

# Start bot (production)
npm start

# Start bot (dev, with --watch)
npm run dev
```

## Project Structure

```
qwicky-discord-bot/
├── src/
│   ├── index.js                    # Entry point: Discord client, event handlers, scheduled tasks
│   ├── deploy-commands.js          # One-off script to register slash commands with Discord API
│   ├── health.js                   # HTTP health check server (GET /health)
│   ├── commands/
│   │   ├── register.js             # /register — link channel to tournament
│   │   ├── unregister.js           # /unregister — unlink channel
│   │   └── status.js               # /status — show channel registration info
│   ├── listeners/
│   │   ├── messageCreate.js        # Hub URL detection, submission creation, auto-approve
│   │   └── scheduleParser.js       # Natural language schedule detection (team + date)
│   ├── services/
│   │   ├── supabase.js             # Supabase client + all DB operations
│   │   ├── hubApi.js               # Fetch game data from QuakeWorld Hub + ktxstats
│   │   ├── buttonHandler.js        # Button interaction router (approve/reject/schedule)
│   │   ├── notificationPoller.js   # Polls Supabase for QWICKY→Discord notifications
│   │   ├── dailyReminders.js       # Enqueues daily notifications (09:00 UTC)
│   │   ├── discoveryScheduler.js   # Triggers game discovery (22:00 UTC)
│   │   ├── weeklyReport.js         # Weekly activity summary (Monday 10:00 UTC)
│   │   └── handlers/
│   │       ├── editSubmission.js       # Update submission embed status
│   │       ├── postSchedule.js         # Post round schedule to channel
│   │       ├── gameDayReminder.js      # "Matches Today" reminder
│   │       ├── unscheduledAlert.js     # Warn about unscheduled matches
│   │       ├── adminAlert.js           # Admin alerts (stale submissions)
│   │       └── discoverySummary.js     # Post discovery results with confidence scores
│   └── utils/
│       ├── nameNormalizer.js       # QW name normalization (MUST sync with frontend)
│       ├── dateParser.js           # Natural language date/time parsing
│       └── parseUrl.js             # Hub URL extraction from message text
├── supabase/
│   ├── config.toml                 # Supabase local dev config
│   └── migrations/                 # SQL migration files
├── Dockerfile                      # Node 20 Alpine production image
├── fly.toml                        # Fly.io deployment config (iad region, 256MB)
├── RUNBOOK.md                      # Comprehensive operations documentation
└── TROUBLESHOOTING.md              # Common issues and fixes
```

## Architecture & Data Flow

### Submission Flow (Primary)
```
Player posts Hub URL in registered Discord channel
  → messageCreate.js detects URL via parseUrl.extractUrls()
  → Validates channel registration via supabase.getChannelRegistration()
  → hubApi.fetchGameData() fetches game from Hub Supabase → ktxstats JSON
  → supabase.insertSubmission() stores in match_submissions table
  → Optional: callAutoApprove() hits QWICKY API
  → Bot replies with embed (teams, scores, map) + approve/reject buttons
  → Admin clicks button → buttonHandler.js updates status + embed
```

### Notification Flow (QWICKY → Discord)
```
QWICKY web app inserts row into discord_notifications table
  → notificationPoller claims batch of 10 every 30 seconds
  → Routes to handler by notification_type
  → Handler posts embed to Discord channel
  → Notification marked completed or failed
```

### Scheduled Tasks (index.js)
| Task | Schedule | Handler |
|------|----------|---------|
| Weekly report | Monday 10:00 UTC | `weeklyReport.generateWeeklyReport()` |
| Daily reminders | 09:00 UTC | `dailyReminders.generateDailyNotifications()` |
| Discovery | 22:00 UTC | `discoveryScheduler.checkAndRunDiscovery()` |
| Notification poll | Every 30s | `notificationPoller.pollOnce()` |

All scheduled tasks use `setInterval` with 60-second granularity checks against `new Date().getUTCHours()` and `getUTCMinutes()`.

## Supabase Tables

### `tournament_channels`
Maps Discord channels to tournaments. One channel = one tournament.
- `discord_channel_id` (unique), `discord_guild_id`, `tournament_id`, `division_id`, `registered_by`

### `match_submissions`
Stores submitted match results.
- `tournament_id`, `game_id` (unique per tournament), `game_data` (JSONB — ktxstats)
- `status`: `pending` → `approved` | `rejected`
- `submitted_by_discord_id`, `submitted_by_name`, `hub_url`, `discord_message_id`

### `discord_notifications`
Queue for QWICKY→Discord messages, claimed and processed by the notification poller.
- `notification_type`, `channel_id`, `payload` (JSONB), `status`, `error_message`

### `matches` (read/write for scheduling)
Tournament match schedule, shared with QWICKY frontend.

## Key Implementation Details

### Hub URL Detection (parseUrl.js)
Matches URLs from `hub.quakeworld.nu` in formats: `/game/{id}`, `/qtv/{id}`, `/games/?gameId={id}`.

### Game Data Formats (messageCreate.js, hubApi.js)
The bot handles multiple game data formats:
- **Hub row format**: `teams[0].frags` directly available
- **ktxstats with team_stats**: `team_stats[teamName].frags`
- **ktxstats without team_stats** (most common for team games): sum `player.stats.frags` per team

### Name Normalization (nameNormalizer.js)
**CRITICAL: This file MUST stay in sync with `../qwicky/src/utils/nameNormalizer.js`.**
- `cleanName(name)`: Display-safe (strips QW color codes + high-bit characters)
- `normalize(name)`: Full normalization for matching (+ diacritics removal, decorator stripping, lowercase)
- Uses the QW ASCII table (256 chars) to decode high-bit "brown" characters

### Date Parsing (dateParser.js)
Parses natural language scheduling messages. Supported formats:
- ISO: `2026-04-15`
- European: `15/04`, `15.04.2026`
- Named month: `15 april`, `april 15th`
- Relative: `today`, `tomorrow`
- Weekday: `monday`, `next wednesday`
- Time: `20:00`, `8pm`, `@21`
- Default timezone: CET (UTC+1) if not specified

### Button Custom IDs
Format: `qwicky:{action}:{payload}`
- `qwicky:approve:{gameId}` — Approve submission
- `qwicky:reject:{gameId}` — Reject submission
- `qwicky:confirm-schedule:{matchId}|{date}|{time}` — Confirm schedule
- `qwicky:cancel-schedule:` — Cancel schedule confirmation

### Embed Color Conventions
| Color | Hex | Meaning |
|-------|-----|---------|
| Green | `0x00C853` | Approved / success |
| Gold/Amber | `0xFFB300` | Pending / default |
| Yellow | `0xFFD600` | Flagged / auto-approve conflict |
| Red | `0xFF3366` | Rejected / error |
| Blue | `0x2196F3` | Game day reminders |
| Orange | `0xFF9800` | Warnings (unscheduled, admin) |
| Gray | `0x808080` | Cancelled / no activity |
| Blurple | `0x5865F2` | Schedule confirmation |

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `DISCORD_TOKEN` | Yes | Bot authentication token |
| `DISCORD_CLIENT_ID` | Yes | Bot application ID (for command registration) |
| `SUPABASE_URL` | Yes | QWICKY Supabase instance URL |
| `SUPABASE_SERVICE_KEY` | Yes | Service role key for admin DB access |
| `HUB_SUPABASE_URL` | No | QuakeWorld Hub Supabase URL (defaults to known instance) |
| `HUB_SUPABASE_KEY` | Yes | Hub Supabase API key for game data lookups |
| `AUTO_APPROVE_URL` | No | QWICKY auto-approve endpoint (optional feature) |
| `QWICKY_URL` | No | QWICKY web app base URL (defaults to qwicky.vercel.app) |
| `PORT` | No | Health check server port (defaults to 3000) |

## Deployment

### Fly.io (Primary)
```bash
fly deploy          # Deploy from Dockerfile
fly logs            # Stream logs
fly status          # Check app status
```

Config: `fly.toml` — app `qwicky-discord-bot`, region `iad`, shared-cpu-1x, 256MB RAM.

### Docker
```bash
docker build -t qwicky-discord-bot .
docker run --env-file .env qwicky-discord-bot
```

## Common Tasks

### Adding a New Slash Command
1. Create file in `src/commands/` exporting `data` (SlashCommandBuilder) and `execute(interaction)`
2. Commands are auto-loaded by `index.js` from the `commands/` directory
3. Run `npm run deploy-commands` to register with Discord

### Adding a New Notification Handler
1. Create handler in `src/services/handlers/` exporting `async function handle*(client, notification)`
2. Register in `notificationPoller.js` handler map: `{ notification_type: handlerFn }`
3. QWICKY inserts notification with matching `notification_type` into `discord_notifications`

### Adding a New Scheduled Task
1. Add check logic in `index.js` inside the 60-second interval callback
2. Check `getUTCHours()` and `getUTCMinutes()` to match desired schedule
3. Use a `lastRan` variable to prevent duplicate runs within the same minute

## Gotchas & Notes

1. **CommonJS modules** — No `"type": "module"` in package.json. Use `require()` / `module.exports`. ESLint config is `.mjs` to work around this.
2. **nameNormalizer.js is shared code** — Must stay in sync with the frontend's copy. Changes here require mirroring to `../qwicky/src/utils/nameNormalizer.js` and vice versa.
3. **ktxstats has no `team_stats` for team games** — Scores must be calculated by summing `player.stats.frags` per team.
4. **Button permission checks** — All approve/reject/schedule buttons require ManageChannels permission.
5. **Duplicate detection** — Uses Supabase unique constraint on `(tournament_id, game_id)`. Error code `23505` = duplicate.
6. **Notification polling batch size** — 10 per poll. Increase if throughput becomes an issue.
7. **Health check** — HTTP server on PORT (default 3000). Fly.io uses this for liveness checks.
8. **No TypeScript** — Plain JavaScript throughout.
9. **No unit tests** — Manual testing required.
10. **Graceful shutdown** — Handles SIGTERM/SIGINT for clean Docker/Fly.io stops.
