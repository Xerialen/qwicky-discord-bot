# qwicky-discord-bot — Developer Reference

## Required Environment Variables

### Bot process (Fly.io secrets)

| Variable | Description |
|---|---|
| `DISCORD_BOT_TOKEN` | Discord bot token from the Developer Portal |
| `DISCORD_CLIENT_ID` | Application (client) ID for slash command registration |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (full DB access) |

Set via Fly.io:
```bash
flyctl secrets set DISCORD_BOT_TOKEN=... DISCORD_CLIENT_ID=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...
```

### Supabase Edge Functions

| Secret | Description |
|---|---|
| `ANNOUNCE_WEBHOOK_KEY` | Shared secret for the `announce-approved` webhook. Callers must send `Authorization: Bearer <key>`. |
| `SUPABASE_URL` | Auto-injected by Supabase runtime. |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-injected by Supabase runtime. |

Set via Supabase dashboard (Project Settings → Edge Functions → Secrets) or CLI:
```bash
supabase secrets set ANNOUNCE_WEBHOOK_KEY=<your-secret-key>
```

### Edge Function URL

After deploying `announce-approved`, callers use:
```
POST https://<project-ref>.supabase.co/functions/v1/announce-approved
Authorization: Bearer <ANNOUNCE_WEBHOOK_KEY>
```

## Deployment

```bash
# Deploy bot
flyctl deploy

# Deploy Edge Functions
supabase functions deploy announce-approved

# Register slash commands (run once after adding/changing commands)
npm run deploy-commands
```

## Architecture Notes

- Bot runs on Fly.io (256 MB RAM, CommonJS / Node.js 20)
- `discord_notifications` table in Supabase is the message queue
- Notification poller (`src/services/notificationPoller.js`) polls every N seconds and dispatches by `notification_type`
- Announcement pipeline: `/announce` slash command OR `announce-approved` Edge Function → `discord_notifications` row → poller → `channel.send()`
- `allowedMentions: { parse: [] }` is enforced on all bot sends — no @everyone/@here pings possible
