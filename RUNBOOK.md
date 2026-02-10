# QWICKY Discord Bot - Comprehensive Runbook

**Version:** 1.0.0
**Last Updated:** 2026-02-10
**Maintainer:** Xerial
**Production Status:** ✅ Live on Fly.io

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Quick Reference](#quick-reference)
4. [Prerequisites](#prerequisites)
5. [Local Development](#local-development)
6. [Environment Configuration](#environment-configuration)
7. [Deployment](#deployment)
8. [Bot Commands](#bot-commands)
9. [Database Schema](#database-schema)
10. [Monitoring & Observability](#monitoring--observability)
11. [Operational Procedures](#operational-procedures)
12. [Troubleshooting](#troubleshooting)
13. [Maintenance](#maintenance)
14. [Emergency Procedures](#emergency-procedures)
15. [Development Workflow](#development-workflow)
16. [Security](#security)
17. [Cost Management](#cost-management)
18. [Contact & Support](#contact--support)

---

## Project Overview

### What is QWICKY Bot?

QWICKY Bot is a Discord bot that automates tournament match result submissions for the QWICKY platform (QuakeWorld competitive gaming). It monitors registered Discord channels for QuakeWorld Hub URLs, fetches match data, and submits it to the QWICKY system for review.

### Key Features

- **Automatic Match Detection:** Monitors channels for hub.quakeworld.nu URLs
- **Channel Registration:** Link Discord channels to specific tournaments/divisions
- **Match Validation:** Fetches game data from QuakeWorld Hub API
- **Result Submission:** Stores submissions in Supabase for QWICKY review
- **Slash Commands:** `/register`, `/unregister`, `/status`
- **Health Monitoring:** Built-in health check endpoint for platform monitoring
- **Error Handling:** Graceful reconnection and error recovery

### Technology Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js 20.x |
| Framework | Discord.js v14 |
| Database | Supabase (PostgreSQL) |
| Hosting | Fly.io (production) |
| Container | Docker (Alpine Linux) |
| Language | JavaScript (ES6+) |

---

## Architecture

### System Diagram

```
┌─────────────────┐
│  Discord User   │
│  Posts Hub URL  │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│       Discord Gateway API           │
│   (WebSocket Connection)            │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│      QWICKY Discord Bot             │
│  ┌─────────────────────────────┐   │
│  │  Message Listener           │   │
│  │  - Detects hub URLs         │   │
│  │  - Validates channel        │   │
│  └──────────┬──────────────────┘   │
│             │                       │
│  ┌──────────▼──────────────────┐   │
│  │  Hub API Service            │   │
│  │  - Fetches game data        │   │
│  │  - Parses player stats      │   │
│  └──────────┬──────────────────┘   │
│             │                       │
│  ┌──────────▼──────────────────┐   │
│  │  Supabase Service           │   │
│  │  - Stores submissions       │   │
│  │  - Checks duplicates        │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│         Supabase Database           │
│  ┌─────────────────────────────┐   │
│  │  tournament_channels        │   │
│  │  match_submissions          │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│      QWICKY Web Platform            │
│  (Admin reviews submissions)        │
└─────────────────────────────────────┘
```

### Component Details

#### 1. **Main Bot (`src/index.js`)**
- Discord client initialization
- Command loader
- Event handlers (messages, interactions)
- Error handling and reconnection logic
- Graceful shutdown handlers

#### 2. **Commands (`src/commands/`)**
- **register.js** - Register channel to tournament
- **unregister.js** - Unregister channel
- **status.js** - Show registration status

#### 3. **Listeners (`src/listeners/`)**
- **messageCreate.js** - Hub URL detection and processing

#### 4. **Services (`src/services/`)**
- **supabase.js** - Database operations
- **hubApi.js** - QuakeWorld Hub API integration

#### 5. **Utils (`src/utils/`)**
- **parseUrl.js** - Hub URL parsing and validation

#### 6. **Health Check (`src/health.js`)**
- HTTP server for platform health monitoring
- Responds at `/health` endpoint

---

## Quick Reference

### Essential Commands

```bash
# Production (Fly.io)
flyctl status --app qwicky-discord-bot      # Check status
flyctl logs --app qwicky-discord-bot        # View logs
flyctl ssh console --app qwicky-discord-bot # SSH into container
flyctl deploy --app qwicky-discord-bot      # Deploy updates

# Local Development
npm install                                 # Install dependencies
npm run dev                                 # Run with hot reload
npm start                                   # Run production mode
npm run deploy-commands                     # Register slash commands

# Database
supabase start                              # Start local Supabase
supabase db push                            # Apply migrations
supabase db reset                           # Reset local DB
```

### Production URLs

| Service | URL |
|---------|-----|
| Bot Status | https://qwicky-discord-bot.fly.dev/health |
| Fly.io Dashboard | https://fly.io/apps/qwicky-discord-bot/monitoring |
| GitHub Repo | https://github.com/Xerialen/qwicky-discord-bot |
| QWICKY Platform | https://qwicky.vercel.app |

### Emergency Contacts

| Issue | Contact |
|-------|---------|
| Bot Down | Check Fly.io status first |
| Database Issues | Check Supabase dashboard |
| Code Issues | GitHub Issues |

---

## Prerequisites

### Required Accounts

1. **Discord Developer Portal**
   - Create application: https://discord.com/developers/applications
   - Bot token with Message Content intent enabled
   - Client ID for slash commands

2. **Supabase Project**
   - QWICKY Supabase (submissions): Main database
   - QuakeWorld Hub Supabase (read-only): Game data lookups

3. **Fly.io Account**
   - Free tier supports this bot
   - Credit card required (no charges on free tier)

### Required Tools (Local Development)

```bash
# Node.js 20.x
node --version  # Should be v20.x or higher

# npm (comes with Node.js)
npm --version

# Git
git --version

# Fly CLI (for deployments)
curl -L https://fly.io/install.sh | sh
export PATH="$HOME/.fly/bin:$PATH"

# Supabase CLI (optional, for local DB)
npm install -g supabase
```

---

## Local Development

### Initial Setup

1. **Clone Repository**

```bash
git clone https://github.com/Xerialen/qwicky-discord-bot.git
cd qwicky-discord-bot
```

2. **Install Dependencies**

```bash
npm install
```

3. **Configure Environment**

```bash
cp .env.example .env
# Edit .env with your credentials (see Environment Configuration section)
```

4. **Deploy Slash Commands**

```bash
npm run deploy-commands
```

This registers `/register`, `/unregister`, and `/status` commands with Discord.

5. **Start Bot**

```bash
# Development mode (hot reload)
npm run dev

# Production mode
npm start
```

### Project Structure

```
qwicky-discord-bot/
├── src/
│   ├── index.js              # Main entry point
│   ├── deploy-commands.js    # Command registration script
│   ├── health.js             # Health check server
│   ├── commands/             # Slash command handlers
│   │   ├── register.js
│   │   ├── unregister.js
│   │   └── status.js
│   ├── listeners/            # Event handlers
│   │   └── messageCreate.js
│   ├── services/             # External integrations
│   │   ├── supabase.js
│   │   └── hubApi.js
│   └── utils/                # Helper functions
│       └── parseUrl.js
├── supabase/
│   └── migrations/           # Database schema
│       └── 20260206235615_create_qwicky_tables.sql
├── Dockerfile                # Container definition
├── fly.toml                  # Fly.io configuration
├── package.json              # Dependencies
└── .env                      # Local environment (gitignored)
```

### Development Workflow

1. **Create Feature Branch**

```bash
git checkout -b feature/your-feature-name
```

2. **Make Changes**
   - Edit code
   - Test locally
   - Check for errors

3. **Test Changes**

```bash
# Run bot locally
npm run dev

# Test in Discord
# - Post test hub URL in registered channel
# - Try slash commands
# - Check logs for errors
```

4. **Commit Changes**

```bash
git add .
git commit -m "Description of changes"
```

5. **Push and Deploy**

```bash
git push origin feature/your-feature-name

# After merge to main:
flyctl deploy --app qwicky-discord-bot
```

---

## Environment Configuration

### Required Environment Variables

Create a `.env` file with the following:

```env
# Discord Bot Configuration
DISCORD_TOKEN=<your_discord_bot_token>
DISCORD_CLIENT_ID=<your_discord_application_client_id>

# QWICKY Supabase (Submission Storage)
SUPABASE_URL=<your_qwicky_supabase_url>
SUPABASE_SERVICE_KEY=<your_qwicky_supabase_service_role_key>

# QuakeWorld Hub Supabase (Game Data - Read Only)
HUB_SUPABASE_KEY=<quakeworld_hub_supabase_anon_key>

# Optional: Port for health check server (default: 3000)
PORT=3000

# Optional: Node environment (development/production)
NODE_ENV=production
```

### How to Obtain Credentials

#### Discord Token & Client ID

1. Go to https://discord.com/developers/applications
2. Click your application → "Bot" tab
3. Click "Reset Token" → Copy token → Save as `DISCORD_TOKEN`
4. Go to "OAuth2" tab → Copy "Client ID" → Save as `DISCORD_CLIENT_ID`
5. **Important:** Enable "Message Content Intent" under Bot → Privileged Gateway Intents

#### Supabase Credentials

1. **QWICKY Supabase:**
   - Log into your Supabase project
   - Settings → API → Project URL → Copy as `SUPABASE_URL`
   - Settings → API → service_role key (secret) → Copy as `SUPABASE_SERVICE_KEY`

2. **Hub Supabase:**
   - Get from QuakeWorld Hub maintainer
   - Or extract from hub.quakeworld.nu source code
   - Copy anon key as `HUB_SUPABASE_KEY`

### Setting Secrets in Fly.io

```bash
flyctl secrets set \
  DISCORD_TOKEN="your_token" \
  DISCORD_CLIENT_ID="your_client_id" \
  SUPABASE_URL="your_url" \
  SUPABASE_SERVICE_KEY="your_key" \
  HUB_SUPABASE_KEY="your_hub_key" \
  --app qwicky-discord-bot
```

Secrets are encrypted at rest and never appear in logs.

---

## Deployment

### Production Deployment (Fly.io)

#### Prerequisites

- Fly.io CLI installed
- Logged in: `flyctl auth login`
- App created: Already done (qwicky-discord-bot)

#### Deploy Steps

1. **Commit Changes**

```bash
git add .
git commit -m "Your changes"
git push origin main
```

2. **Deploy to Fly.io**

```bash
# Set working directory
cd ~/projects/qwicky-discord-bot

# Deploy
export FLYCTL_INSTALL="$HOME/.fly"
export PATH="$FLYCTL_INSTALL/bin:$PATH"
flyctl deploy --app qwicky-discord-bot
```

3. **Monitor Deployment**

```bash
# Check status
flyctl status --app qwicky-discord-bot

# View logs
flyctl logs --app qwicky-discord-bot
```

4. **Verify Deployment**

```bash
# Health check
curl https://qwicky-discord-bot.fly.dev/health

# Expected response:
# {"status":"ok","uptime":123.45,"bot_ready":true,"timestamp":"2026-02-10T..."}
```

#### Deployment Configuration

**File:** `fly.toml`

```toml
app = 'qwicky-discord-bot'
primary_region = 'iad'

[build]

[env]
  NODE_ENV = 'production'

[processes]
  app = 'npm start'

[[vm]]
  size = 'shared-cpu-1x'
  memory = '256mb'
```

**File:** `Dockerfile`

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
CMD ["npm", "start"]
```

#### Rollback a Deployment

```bash
# List recent deployments
flyctl releases --app qwicky-discord-bot

# Rollback to previous version
flyctl releases rollback --app qwicky-discord-bot
```

### Alternative: Railway Deployment

See [RAILWAY-MIGRATION.md](./RAILWAY-MIGRATION.md) for detailed Railway setup guide.

**Quick Railway Deploy:**

1. Go to https://railway.app
2. New Project → Deploy from GitHub
3. Select `Xerialen/qwicky-discord-bot`
4. Add environment variables
5. Deploy automatically

**Cost:** ~$3/month (within free tier)

### Local Production Build

Test the production Docker build locally:

```bash
# Build image
docker build -t qwicky-bot .

# Run container
docker run --env-file .env -p 3000:3000 qwicky-bot

# Test health endpoint
curl http://localhost:3000/health
```

---

## Bot Commands

### Slash Commands

All commands require "Manage Channels" permission by default.

#### `/register`

Register a Discord channel to a QWICKY tournament.

**Parameters:**
- `tournament-id` (required): The QWICKY tournament ID
- `division-id` (optional): Specific division within tournament

**Usage:**
```
/register tournament-id:qw-duel-2024 division-id:bronze
```

**Response:**
```
✅ This channel is now linked to tournament qw-duel-2024 (division: bronze).
Hub URLs posted here will be tracked as match submissions.
```

**Database Effect:**
- Inserts row into `tournament_channels` table
- Channel is now monitored for hub URLs

#### `/unregister`

Unregister the current channel from tournament tracking.

**Parameters:** None

**Usage:**
```
/unregister
```

**Response:**
```
✅ This channel is no longer tracking tournament results.
```

**Database Effect:**
- Deletes row from `tournament_channels` table
- Bot stops monitoring this channel

#### `/status`

Show registration status of current channel.

**Parameters:** None

**Usage:**
```
/status
```

**Response (if registered):**
```
📊 Channel Status
Tournament: qw-duel-2024
Division: bronze
Registered by: <@123456789>
Registered on: 2026-02-07
```

**Response (if not registered):**
```
This channel is not registered to any tournament.
Use /register to link it.
```

### Automatic Hub URL Detection

When a user posts a hub URL in a registered channel:

**Detected URL Format:**
```
https://hub.quakeworld.nu/game/12345
```

**Bot Response:**
```
✅ Match submitted for review!
Tournament: qw-duel-2024
Game ID: 12345
Submitted by: @Username
Status: Pending admin review
```

**What Happens:**
1. Bot validates channel registration
2. Extracts game ID from URL
3. Fetches game data from Hub API
4. Checks for duplicate submission
5. Stores in `match_submissions` table
6. Replies to user with confirmation

**Error Responses:**

```
❌ This channel is not registered. Use /register first.
❌ Invalid hub URL format.
❌ This match has already been submitted.
❌ Failed to fetch game data from hub.
```

---

## Database Schema

### Supabase Tables

The bot uses two tables in the QWICKY Supabase project.

#### `tournament_channels`

Maps Discord channels to QWICKY tournaments.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `discord_guild_id` | text | Discord server ID |
| `discord_channel_id` | text | Discord channel ID (unique) |
| `tournament_id` | text | QWICKY tournament ID |
| `division_id` | text | Optional division scope |
| `registered_by` | text | Discord user ID who registered |
| `created_at` | timestamptz | Registration timestamp |

**Indexes:**
- `idx_tournament_channels_channel` on `discord_channel_id`
- `idx_tournament_channels_tournament` on `tournament_id`

**Constraints:**
- `discord_channel_id` is unique (one channel = one tournament)

#### `match_submissions`

Stores match submissions from Discord for admin review.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `tournament_id` | text | QWICKY tournament ID |
| `division_id` | text | Optional division |
| `hub_url` | text | Full hub URL |
| `game_id` | text | Extracted game ID |
| `game_data` | jsonb | Full game data from Hub API |
| `submitted_by_discord_id` | text | Discord user ID |
| `submitted_by_name` | text | Discord username |
| `discord_channel_id` | text | Source channel |
| `status` | text | 'pending', 'approved', 'rejected', 'duplicate' |
| `created_at` | timestamptz | Submission timestamp |
| `reviewed_at` | timestamptz | Admin review timestamp |

**Indexes:**
- `idx_match_submissions_no_dupes` (unique) on `(tournament_id, game_id)`
- `idx_match_submissions_tournament` on `(tournament_id, status)`

**Constraints:**
- `status` must be one of: pending, approved, rejected, duplicate
- Unique constraint prevents duplicate submissions

### Database Queries

**Common Queries:**

```sql
-- Get all registered channels for a tournament
SELECT * FROM tournament_channels
WHERE tournament_id = 'qw-duel-2024';

-- Get pending submissions
SELECT * FROM match_submissions
WHERE status = 'pending'
ORDER BY created_at DESC;

-- Check if game already submitted
SELECT * FROM match_submissions
WHERE tournament_id = 'qw-duel-2024'
  AND game_id = '12345';

-- Get submission stats by tournament
SELECT
  tournament_id,
  status,
  COUNT(*) as count
FROM match_submissions
GROUP BY tournament_id, status;
```

### Database Migrations

Migration file: `supabase/migrations/20260206235615_create_qwicky_tables.sql`

**Apply migrations locally:**

```bash
# Start local Supabase
supabase start

# Apply migrations
supabase db push

# Reset DB (caution: deletes all data)
supabase db reset
```

**Production migrations:**

Migrations must be applied manually via Supabase dashboard or SQL editor.

---

## Monitoring & Observability

### Health Check Endpoint

**URL:** `https://qwicky-discord-bot.fly.dev/health`

**Response:**

```json
{
  "status": "ok",
  "uptime": 123456.789,
  "bot_ready": true,
  "timestamp": "2026-02-10T08:30:00.000Z"
}
```

**Fields:**
- `status`: "ok" if healthy
- `uptime`: Process uptime in seconds
- `bot_ready`: Boolean, true if connected to Discord
- `timestamp`: Current UTC time

**Monitoring Use:**

```bash
# Check health
curl https://qwicky-discord-bot.fly.dev/health

# Monitor uptime (ping every 60s)
watch -n 60 'curl -s https://qwicky-discord-bot.fly.dev/health | jq'

# Set up UptimeRobot/Pingdom to monitor this endpoint
```

### Logs

#### Fly.io Logs

```bash
# Real-time logs
flyctl logs --app qwicky-discord-bot

# Last 100 lines
flyctl logs --app qwicky-discord-bot --lines 100

# Filter by keyword
flyctl logs --app qwicky-discord-bot | grep ERROR

# Save logs to file
flyctl logs --app qwicky-discord-bot > bot-logs.txt
```

#### Log Levels

| Level | When It Appears |
|-------|-----------------|
| `🔄 Logging in to Discord...` | Bot startup |
| `✅ QWICKY Bot online as ...` | Successful connection |
| `📊 Serving X guilds` | Startup, shows server count |
| `[Health] Server listening on port ...` | Health check ready |
| `[Discord Client Error]` | Connection issues |
| `[Shard X] Reconnecting...` | Discord reconnection |
| `[Unhandled Rejection]` | Async errors |
| `[Uncaught Exception]` | Critical errors |

#### Key Log Patterns

**Normal operation:**
```
🔄 Logging in to Discord...
✅ QWICKY Bot online as QWICKY Bot#2889
📊 Serving 2 guilds
[Health] Server listening on port 3000
```

**Match submission:**
```
Hub URL detected: https://hub.quakeworld.nu/game/12345
Fetching game data for game 12345...
Match submitted successfully (tournament: qw-duel-2024)
```

**Errors:**
```
[Discord Client Error]: WebSocket connection failed
[Unhandled Rejection]: Error: ECONNREFUSED
Failed to fetch game data: 500 Internal Server Error
```

### Metrics & Analytics

**Bot Uptime:**
```bash
# Check process uptime via health endpoint
curl -s https://qwicky-discord-bot.fly.dev/health | jq '.uptime'
```

**Submission Statistics:**

Query Supabase dashboard:

```sql
-- Submissions per day
SELECT
  DATE(created_at) as date,
  COUNT(*) as submissions
FROM match_submissions
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Submission status breakdown
SELECT status, COUNT(*)
FROM match_submissions
GROUP BY status;
```

**Discord Status:**

Check bot status directly in Discord:
- Green dot = Online
- Red dot = Offline
- Yellow dot = Idle (should not happen)

### Alerting

**Recommended Monitoring:**

1. **Uptime Monitoring:**
   - Service: UptimeRobot (free)
   - URL: https://qwicky-discord-bot.fly.dev/health
   - Interval: 5 minutes
   - Alert: Email/SMS on failure

2. **Error Rate Monitoring:**
   - Check Fly.io metrics dashboard
   - Set up alerts for:
     - Restart count > 5 per hour
     - Memory usage > 200MB
     - Error logs containing "FATAL" or "CRITICAL"

3. **Discord Status:**
   - Check bot presence in Discord
   - If offline > 5 minutes, investigate

---

## Operational Procedures

### Daily Operations

**Morning Check (5 minutes):**

```bash
# 1. Check bot status
flyctl status --app qwicky-discord-bot

# 2. Check health endpoint
curl https://qwicky-discord-bot.fly.dev/health

# 3. Review recent logs for errors
flyctl logs --app qwicky-discord-bot --lines 50

# 4. Check Discord - bot should be online
```

**Weekly Review (15 minutes):**

1. Review submission statistics in Supabase
2. Check for unusual error patterns in logs
3. Verify registered channels are still active
4. Check Fly.io usage/costs

### Restarting the Bot

**Fly.io:**

```bash
# Restart all machines
flyctl apps restart qwicky-discord-bot

# Or restart specific machine
flyctl machine restart <machine-id> --app qwicky-discord-bot
```

**Expected downtime:** ~30 seconds

**Verify restart:**

```bash
# Check logs for startup sequence
flyctl logs --app qwicky-discord-bot

# Look for:
# ✅ QWICKY Bot online as ...
```

### Scaling

**Current Configuration:**
- 1 active machine
- 1 standby machine (auto-activates on hardware failure)
- 256MB RAM
- shared-cpu-1x

**Scale up (if needed):**

```bash
# Increase memory to 512MB
flyctl scale memory 512 --app qwicky-discord-bot

# Increase to dedicated CPU
flyctl scale vm dedicated-cpu-1x --app qwicky-discord-bot
```

**Note:** Bot is lightweight and rarely needs scaling.

### Backup & Disaster Recovery

**Database Backups:**

Supabase automatically backs up database daily. Manual backup:

```sql
-- Export tournament channels
COPY tournament_channels TO '/tmp/channels_backup.csv' CSV HEADER;

-- Export match submissions
COPY match_submissions TO '/tmp/submissions_backup.csv' CSV HEADER;
```

**Code Backup:**

Git repository is the source of truth. Always ensure latest code is pushed:

```bash
git push origin main
```

**Secrets Backup:**

Document all secrets in secure password manager (1Password, Bitwarden, etc.).

**Recovery Procedure:**

1. Redeploy from GitHub
2. Set secrets: `flyctl secrets set ...`
3. Deploy: `flyctl deploy`
4. Verify: Check health endpoint and Discord status

**RTO (Recovery Time Objective):** 10 minutes
**RPO (Recovery Point Objective):** No data loss (Supabase handles persistence)

---

## Troubleshooting

See also: [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for detailed platform-specific issues.

### Common Issues

#### Bot Appears Offline in Discord

**Symptoms:**
- Bot shows red dot in Discord
- Health endpoint returns 503 or times out
- No logs appearing

**Diagnosis:**

```bash
# Check Fly.io status
flyctl status --app qwicky-discord-bot

# Check logs for errors
flyctl logs --app qwicky-discord-bot --lines 100
```

**Causes & Solutions:**

| Cause | Solution |
|-------|----------|
| Invalid DISCORD_TOKEN | Regenerate token in Discord Developer Portal, update secret |
| Missing Message Content intent | Enable in Discord Developer Portal → Bot → Privileged Gateway Intents |
| Network issue | Check Fly.io status page, restart app |
| Crashed process | Check logs for uncaught exceptions, fix code, redeploy |
| Fly.io outage | Check https://status.fly.io |

**Fix:**

```bash
# Restart the bot
flyctl apps restart qwicky-discord-bot

# If still broken, check secrets:
flyctl secrets list --app qwicky-discord-bot

# Redeploy:
flyctl deploy --app qwicky-discord-bot
```

#### Bot Not Responding to Hub URLs

**Symptoms:**
- User posts hub URL
- No bot response
- Logs show no activity

**Diagnosis:**

```bash
# Check if channel is registered
# Query Supabase:
SELECT * FROM tournament_channels WHERE discord_channel_id = '<channel_id>';
```

**Causes & Solutions:**

| Cause | Solution |
|-------|----------|
| Channel not registered | Run `/register` command |
| Message Content intent disabled | Enable in Discord Developer Portal |
| Bot lacks channel permissions | Grant "View Channel" and "Send Messages" |
| URL format wrong | Ensure URL matches: `https://hub.quakeworld.nu/game/12345` |
| Hub API down | Check https://hub.quakeworld.nu status |

#### Slash Commands Not Appearing

**Symptoms:**
- `/register` command not available in Discord
- Slash commands don't autocomplete

**Causes & Solutions:**

1. **Commands not deployed:**

```bash
npm run deploy-commands
```

2. **Bot lacks permissions:**

Check bot invite URL has `applications.commands` scope.

3. **Discord cache:**

Restart Discord client (Ctrl+R) or wait 1 hour.

4. **Wrong Client ID:**

Verify `DISCORD_CLIENT_ID` in `.env` matches your application.

#### Database Connection Errors

**Symptoms:**
- Logs show `ECONNREFUSED` or `401 Unauthorized`
- Submissions fail to save

**Diagnosis:**

```bash
# Check Supabase secrets
flyctl secrets list --app qwicky-discord-bot

# Test Supabase connection
curl -H "apikey: $SUPABASE_SERVICE_KEY" \
     -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
     "$SUPABASE_URL/rest/v1/tournament_channels?limit=1"
```

**Causes & Solutions:**

| Cause | Solution |
|-------|----------|
| Wrong SUPABASE_URL | Verify URL from Supabase dashboard |
| Wrong service key | Regenerate key in Supabase → Settings → API |
| Supabase project paused | Resume project in Supabase dashboard |
| Network issue | Check Fly.io → Supabase connectivity |

#### Duplicate Submission Errors

**Symptoms:**
- User posts hub URL
- Bot responds: "This match has already been submitted"
- But user believes it's the first time

**Explanation:**

The database has a unique constraint on `(tournament_id, game_id)` to prevent duplicates.

**Diagnosis:**

```sql
-- Check if game already submitted
SELECT * FROM match_submissions
WHERE tournament_id = '<tournament_id>'
  AND game_id = '<game_id>';
```

**Solutions:**

1. **Intentional duplicate:**
   - This is correct behavior
   - Match was already submitted by same or different user

2. **Wrong tournament:**
   - Channel might be registered to wrong tournament
   - Re-register with correct tournament ID

3. **Need to resubmit:**
   - Admin must delete old submission from QWICKY dashboard
   - Or change status to 'duplicate' to allow resubmission

#### Memory Issues

**Symptoms:**
- Bot restarts frequently
- Logs show `Out of memory`
- Fly.io shows memory usage at 100%

**Diagnosis:**

```bash
# Check memory usage
flyctl status --app qwicky-discord-bot
```

**Solutions:**

1. **Scale up memory:**

```bash
flyctl scale memory 512 --app qwicky-discord-bot
```

2. **Check for memory leaks:**

Review code for:
- Unbounded arrays
- Event listener leaks
- Unclosed connections

3. **Restart as temporary fix:**

```bash
flyctl apps restart qwicky-discord-bot
```

#### Slow API Responses

**Symptoms:**
- Long delay between posting URL and bot response
- Timeout errors in logs

**Causes & Solutions:**

| Cause | Solution |
|-------|----------|
| Hub API slow | Retry logic built-in, wait longer |
| Supabase slow | Check Supabase metrics, consider upgrading plan |
| Network latency | Fly.io region `iad` is optimal for US/EU |

---

## Maintenance

### Routine Maintenance Tasks

#### Weekly

- [ ] Review logs for errors or warnings
- [ ] Check submission statistics in Supabase
- [ ] Verify health endpoint is responding
- [ ] Check Discord bot status
- [ ] Review Fly.io costs

#### Monthly

- [ ] Update npm dependencies (if needed)
- [ ] Review and clean up old logs
- [ ] Check for Discord.js updates
- [ ] Review registered channels (remove inactive)
- [ ] Audit database for orphaned data

#### Quarterly

- [ ] Review security best practices
- [ ] Check for Node.js LTS updates
- [ ] Review and update documentation
- [ ] Conduct disaster recovery drill

### Updating Dependencies

**Check for updates:**

```bash
npm outdated
```

**Update dependencies:**

```bash
# Update patch versions only (safe)
npm update

# Update to latest (review breaking changes)
npm install discord.js@latest
npm install @supabase/supabase-js@latest
npm install dotenv@latest
```

**Test after updates:**

```bash
# Run locally
npm run dev

# Test all commands
# - /register, /unregister, /status
# - Post test hub URL

# Deploy if tests pass
git commit -am "Update dependencies"
git push origin main
flyctl deploy --app qwicky-discord-bot
```

### Database Maintenance

**Clean up old submissions (optional):**

```sql
-- Archive approved submissions older than 6 months
UPDATE match_submissions
SET status = 'archived'
WHERE status = 'approved'
  AND created_at < NOW() - INTERVAL '6 months';
```

**Remove test data:**

```sql
-- Delete test submissions
DELETE FROM match_submissions
WHERE tournament_id LIKE 'test-%';
```

### Log Rotation

Fly.io handles log rotation automatically. Logs are kept for:
- Real-time logs: Last 30 days
- Archived logs: Contact Fly.io support

To save logs long-term:

```bash
# Export logs
flyctl logs --app qwicky-discord-bot --lines 10000 > logs-$(date +%Y%m%d).txt

# Compress and archive
gzip logs-*.txt
mv logs-*.txt.gz ~/archives/
```

---

## Emergency Procedures

### Bot Completely Down

**Immediate Actions (Do in order):**

1. **Check Fly.io Status**

```bash
flyctl status --app qwicky-discord-bot
```

If all machines show "stopped":

```bash
flyctl apps restart qwicky-discord-bot
```

2. **Check Logs**

```bash
flyctl logs --app qwicky-discord-bot --lines 100
```

Look for fatal errors.

3. **Verify Secrets**

```bash
flyctl secrets list --app qwicky-discord-bot
```

Ensure all 5 secrets exist.

4. **Redeploy from Last Known Good**

```bash
git log --oneline -5  # Find last working commit
git checkout <commit-hash>
flyctl deploy --app qwicky-discord-bot
```

5. **If Still Down: Rollback**

```bash
flyctl releases --app qwicky-discord-bot
flyctl releases rollback --app qwicky-discord-bot
```

**Expected recovery time:** 5-10 minutes

### Database Connection Lost

**Symptoms:**
- Submissions fail to save
- Error: `ECONNREFUSED` or `401`

**Actions:**

1. **Verify Supabase Status**

Check Supabase dashboard - is project paused?

2. **Test Connection**

```bash
curl -H "apikey: $SUPABASE_SERVICE_KEY" \
     "$SUPABASE_URL/rest/v1/tournament_channels?limit=1"
```

3. **Regenerate Keys (if needed)**

- Supabase Dashboard → Settings → API
- Generate new service key
- Update Fly.io secret:

```bash
flyctl secrets set SUPABASE_SERVICE_KEY="new_key" --app qwicky-discord-bot
```

4. **Restart Bot**

```bash
flyctl apps restart qwicky-discord-bot
```

### Discord Token Invalidated

**Symptoms:**
- Bot offline
- Error: `Token invalid` in logs

**Actions:**

1. **Generate New Token**

- Discord Developer Portal → Your App → Bot
- Click "Reset Token"
- Copy new token

2. **Update Secret**

```bash
flyctl secrets set DISCORD_TOKEN="new_token" --app qwicky-discord-bot
```

Bot will restart automatically after secret update.

3. **Verify**

```bash
flyctl logs --app qwicky-discord-bot
# Look for: ✅ QWICKY Bot online as ...
```

### Fly.io Outage

**Actions:**

1. **Check Status**

https://status.fly.io

2. **Wait for Resolution**

Fly.io has 99.9% uptime SLA. Outages are rare and usually resolved quickly.

3. **Alternative: Quick Deploy to Railway**

If outage is prolonged:

```bash
# See RAILWAY-MIGRATION.md for full guide

# Quick steps:
# 1. Go to railway.app
# 2. New Project → Deploy from GitHub
# 3. Add environment variables
# 4. Deploy (takes ~5 minutes)
```

### Critical Bug in Production

**Actions:**

1. **Assess Impact**

- Is bot crashing?
- Are submissions failing?
- Severity: P0 (critical), P1 (high), P2 (medium)

2. **Immediate Mitigation**

**Option A: Rollback**

```bash
flyctl releases rollback --app qwicky-discord-bot
```

**Option B: Hot Fix**

```bash
# Fix bug in code
git commit -am "Hot fix: <description>"
git push origin main
flyctl deploy --app qwicky-discord-bot
```

3. **Notify Users (if needed)**

Post in Discord announcements:
```
⚠️ QWICKY Bot is experiencing issues. We're working on a fix.
ETA: <time>
Workaround: <if any>
```

4. **Root Cause Analysis**

After issue resolved:
- Document what happened
- How it was fixed
- How to prevent in future

---

## Development Workflow

### Making Code Changes

1. **Create Branch**

```bash
git checkout -b fix/issue-description
```

2. **Make Changes**

Edit code, following existing patterns.

3. **Test Locally**

```bash
npm run dev
```

Test in Discord:
- Slash commands
- Hub URL detection
- Error cases

4. **Commit**

```bash
git add .
git commit -m "Fix: <description>"
```

Follow commit message conventions:
- `feat:` for new features
- `fix:` for bug fixes
- `docs:` for documentation
- `refactor:` for code improvements

5. **Push**

```bash
git push origin fix/issue-description
```

6. **Create Pull Request**

- Go to GitHub repo
- Create PR from branch
- Request review (if applicable)

7. **Merge**

After approval, merge to `main`.

8. **Deploy**

```bash
git checkout main
git pull
flyctl deploy --app qwicky-discord-bot
```

### Testing Checklist

Before deploying:

- [ ] Bot starts without errors locally
- [ ] `/register` command works
- [ ] `/unregister` command works
- [ ] `/status` command works
- [ ] Hub URL detection works
- [ ] Duplicate detection works
- [ ] Error messages are user-friendly
- [ ] Health endpoint responds
- [ ] No console errors

### Code Style

- **Use ESLint** (if configured)
- **Follow existing patterns**
- **Add comments for complex logic**
- **Use meaningful variable names**
- **Handle errors gracefully**

### Adding New Features

**Example: Add new slash command**

1. **Create command file:** `src/commands/mycommand.js`

```javascript
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mycommand')
    .setDescription('Description'),

  async execute(interaction) {
    await interaction.reply('Response');
  },
};
```

2. **Deploy commands:**

```bash
npm run deploy-commands
```

3. **Test locally:**

```bash
npm run dev
# Try /mycommand in Discord
```

4. **Commit and deploy:**

```bash
git add src/commands/mycommand.js
git commit -m "feat: Add /mycommand"
git push origin main
flyctl deploy --app qwicky-discord-bot
```

---

## Security

### Secrets Management

**Never commit secrets to Git!**

- `.env` is gitignored
- Use Fly.io secrets for production
- Use environment variables, never hardcode

**Rotate secrets regularly:**

- Discord token: Every 6 months
- Supabase keys: Every 6 months

### Access Control

**Discord Bot Permissions:**

- Read Messages/View Channels
- Send Messages
- Embed Links
- Manage Channels (for slash commands)

**Supabase RLS (Row Level Security):**

Bot uses service key (bypasses RLS). Ensure:
- QWICKY web app has proper RLS policies
- Bot service key is stored securely

### Rate Limiting

**Discord Rate Limits:**

- 50 requests per second per route
- Bot automatically handles rate limits (Discord.js)

**Supabase Rate Limits:**

- Free tier: 100 requests per minute
- Bot makes ~2-3 requests per submission (well under limit)

### Vulnerability Scanning

**Check for vulnerabilities:**

```bash
npm audit

# Fix vulnerabilities
npm audit fix

# Force fix (breaking changes)
npm audit fix --force
```

**Dependabot:**

GitHub Dependabot automatically creates PRs for security updates.

### Incident Response

**If Bot is Compromised:**

1. **Immediate Actions:**
   - Regenerate Discord token
   - Regenerate Supabase keys
   - Update all secrets in Fly.io
   - Review logs for suspicious activity

2. **Investigation:**
   - Check recent code changes
   - Review access logs
   - Check for unauthorized deployments

3. **Recovery:**
   - Deploy known-good version
   - Monitor for 24 hours
   - Document incident

---

## Cost Management

### Fly.io Costs

**Current Usage:**

- 1 active machine (shared-cpu-1x, 256MB)
- 1 standby machine (only active on failure)
- ~$0/month (within free tier)

**Free Tier Limits:**

- 3 shared-cpu-1x machines (we use 2)
- 160GB-hours per month
- 100GB outbound data transfer

**Estimated Costs (if exceed free tier):**

- Shared-cpu-1x: $1.94/month
- 256MB RAM: Included
- Outbound data: $0.02/GB

**Total estimated cost if no free tier:** ~$2-3/month

### Monitoring Costs

```bash
# Check current usage
flyctl dashboard --app qwicky-discord-bot
```

### Cost Optimization

**Current setup is already optimized:**

- Minimal memory (256MB sufficient)
- Shared CPU (no dedicated CPU needed)
- Single region deployment
- No persistent volumes

**If costs increase:**

1. Review metrics for unusual traffic
2. Check for memory leaks
3. Optimize Docker image size

### Alternative Hosting Costs

| Platform | Cost |
|----------|------|
| Fly.io | $0-3/month (free tier) |
| Railway | $0-3/month (free tier) |
| Render | $7/month (always-on required) |
| DigitalOcean | $6/month (VPS) |
| Self-hosted | $0 (if you have server) |

---

## Contact & Support

### Project Maintainer

- **GitHub:** Xerialen
- **Repository:** https://github.com/Xerialen/qwicky-discord-bot

### Getting Help

**Bug Reports:**

Open an issue: https://github.com/Xerialen/qwicky-discord-bot/issues

**Feature Requests:**

Open a feature request in GitHub Issues.

**Emergency Contact:**

- Check #announcements in Discord
- Email: (add email if applicable)

### Community

- **QWICKY Discord:** (add invite link if applicable)
- **QuakeWorld Community:** https://discord.quake.world

### Useful Links

| Resource | URL |
|----------|-----|
| Discord.js Docs | https://discord.js.org |
| Supabase Docs | https://supabase.com/docs |
| Fly.io Docs | https://fly.io/docs |
| QuakeWorld Hub | https://hub.quakeworld.nu |
| QWICKY Platform | https://qwicky.vercel.app |

---

## Appendix

### File Reference

| File | Purpose |
|------|---------|
| `src/index.js` | Main bot entry point |
| `src/deploy-commands.js` | Register slash commands with Discord |
| `src/health.js` | Health check HTTP server |
| `src/commands/register.js` | `/register` command handler |
| `src/commands/unregister.js` | `/unregister` command handler |
| `src/commands/status.js` | `/status` command handler |
| `src/listeners/messageCreate.js` | Hub URL detection logic |
| `src/services/supabase.js` | Supabase database operations |
| `src/services/hubApi.js` | QuakeWorld Hub API integration |
| `src/utils/parseUrl.js` | Hub URL parsing utility |
| `Dockerfile` | Docker container definition |
| `fly.toml` | Fly.io deployment config |
| `railway.json` | Railway deployment config (legacy) |
| `nixpacks.toml` | Nixpacks build config (Railway) |
| `.env` | Local environment variables (gitignored) |
| `.env.example` | Environment variable template |
| `RUNBOOK.md` | This document |
| `TROUBLESHOOTING.md` | Detailed troubleshooting guide |
| `RAILWAY-MIGRATION.md` | Railway deployment guide |

### Glossary

| Term | Definition |
|------|------------|
| **Hub** | QuakeWorld Hub (hub.quakeworld.nu) - game data source |
| **QWICKY** | Tournament management platform for QuakeWorld |
| **Guild** | Discord server |
| **Channel** | Discord text channel |
| **Slash Command** | Discord command starting with `/` |
| **Gateway** | Discord WebSocket API for real-time events |
| **Intent** | Permission for bot to receive certain events |
| **Supabase** | PostgreSQL database hosting platform |
| **Fly.io** | Container hosting platform |
| **RLS** | Row Level Security (Supabase access control) |

### Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-10 | Initial comprehensive runbook |

---

**Document End**

*This runbook is maintained as part of the qwicky-discord-bot repository. For updates, see the Git history.*
