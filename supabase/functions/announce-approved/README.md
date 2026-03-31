# announce-approved Edge Function

Receives approved announcement requests and enqueues them as `discord_notifications` for the bot's notification poller to deliver.

## Required Supabase secrets

Set these via the Supabase dashboard (Project Settings → Edge Functions → Secrets) or with the CLI:

```bash
supabase secrets set ANNOUNCE_WEBHOOK_KEY=<your-secret-key>
```

| Secret | Description |
|---|---|
| `ANNOUNCE_WEBHOOK_KEY` | Shared secret for webhook authentication. Callers must send `Authorization: Bearer <key>`. |
| `SUPABASE_URL` | Auto-injected by Supabase runtime. |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-injected by Supabase runtime. |

## Deploy

```bash
supabase functions deploy announce-approved
```

## Usage

```http
POST /functions/v1/announce-approved
Authorization: Bearer <ANNOUNCE_WEBHOOK_KEY>
Content-Type: application/json

{
  "content": "Plain text message (max 2000 chars)",
  "channelId": "1467942158135853218"  // optional, defaults to #qwicky
}
```

## Notes

- `allowedMentions: { parse: [] }` is set on all Discord sends — no @everyone/@here/role pings possible even if content contains them.
- Content is limited to 2000 characters (Discord message limit).
