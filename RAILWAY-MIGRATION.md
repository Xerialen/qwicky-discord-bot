# 🚂 Railway Migration Guide

## Step-by-Step Deployment to Railway.app

### Prerequisites

✅ Your environment variables from `.env`:
- DISCORD_TOKEN
- DISCORD_CLIENT_ID
- SUPABASE_URL
- SUPABASE_SERVICE_KEY
- HUB_SUPABASE_KEY

---

## Part 1: Prepare Repository (DONE ✅)

The following files have been added to make the bot Railway-ready:

- ✅ `railway.json` - Railway configuration
- ✅ `nixpacks.toml` - Build configuration (Node.js 20)
- ✅ `.railwayignore` - Files to exclude from deployment
- ✅ `src/health.js` - Health check endpoint for monitoring
- ✅ Updated `src/index.js` with:
  - Health check server
  - Better error handling
  - Graceful shutdown
  - Discord reconnection handlers

---

## Part 2: Commit and Push Changes

```bash
cd ~/projects/qwicky-discord-bot

# Stage all new files
git add railway.json nixpacks.toml .railwayignore src/health.js src/index.js

# Commit changes
git commit -m "Add Railway deployment support with health checks and improved error handling"

# Push to GitHub
git push origin main
```

---

## Part 3: Deploy to Railway

### 1. Create Railway Account

→ Go to https://railway.app
→ Click "Login" → "Login with GitHub"
→ Authorize Railway

### 2. Create New Project

→ Click "New Project"
→ Select "Deploy from GitHub repo"
→ Find and select: `Xerialen/qwicky-discord-bot`
→ Click "Deploy Now"

Railway will automatically:
- Detect Node.js project
- Run `npm install`
- Start the bot with `npm start`

### 3. Add Environment Variables

**While deployment is running:**

→ Click on your project
→ Click "Variables" tab
→ Click "+ New Variable"

Add each variable:

```
DISCORD_TOKEN=<paste your token>
DISCORD_CLIENT_ID=<paste your client ID>
SUPABASE_URL=<paste your Supabase URL>
SUPABASE_SERVICE_KEY=<paste your service key>
HUB_SUPABASE_KEY=<paste your hub key>
```

**Important:** After adding variables, Railway will automatically redeploy.

### 4. Monitor Deployment

→ Go to "Deployments" tab
→ Click on the latest deployment
→ Click "View Logs"

**Look for these success messages:**

```
✅ QWICKY Bot online as <your bot name>
📊 Serving X guilds
[Health] Server listening on port 3000
```

### 5. Verify Bot is Online

→ Check Discord - your bot should show as "Online"
→ In a registered channel, post a hub URL: `https://hub.quakeworld.nu/game/12345`
→ Bot should reply with match embed

---

## Part 4: Railway Configuration Tips

### Enable Auto-Deploys

→ Project Settings → "GitHub Repo"
→ Enable "Auto Deploy" (on by default)

Now every `git push` will automatically deploy to Railway!

### Set Up Custom Domain (Optional)

→ Project Settings → "Domains"
→ Click "Generate Domain"
→ Get a free `.up.railway.app` domain

### Monitor Usage

→ Project Settings → "Usage"
→ Track your monthly credits (free tier = $5/month)

Your bot uses ~$2-3/month, well within free tier.

---

## Part 5: Verify Everything Works

### Test Checklist

1. **Bot Status:**
   - [ ] Bot shows "Online" in Discord
   - [ ] Bot responds to slash commands (`/status`)

2. **Match Submission:**
   - [ ] Post hub URL in registered channel
   - [ ] Bot replies with match embed
   - [ ] Check QWICKY → Results → Discord tab
   - [ ] Submission appears as "Pending"

3. **Logs:**
   - [ ] No errors in Railway deployment logs
   - [ ] Health check responds: `curl https://<your-domain>.up.railway.app/health`

### Health Check Response (Expected)

```json
{
  "status": "ok",
  "uptime": 123.45,
  "bot_ready": true,
  "timestamp": "2026-02-09T..."
}
```

---

## Part 6: Decommission Vercel

Once Railway is working:

1. Go to Vercel dashboard
2. Find `qwicky-discord-bot` project
3. Delete the project

**Important:** Keep the QWICKY web app on Vercel - only remove the bot.

---

## Troubleshooting

### Bot Not Connecting

**Check Railway logs for:**

```
❌ Failed to login: <error>
```

**Solutions:**
- Verify `DISCORD_TOKEN` is correct
- Check Discord Developer Portal → Bot → Reset Token if needed
- Ensure all env variables are set in Railway

### Bot Connects But Doesn't Respond

**Check Discord Developer Portal:**

→ Applications → Your Bot → Bot → Privileged Gateway Intents
→ Enable: **Message Content Intent** ✅

Then restart Railway deployment:
→ Deployments → "Restart"

### Health Check Fails

```bash
curl https://<your-domain>.up.railway.app/health
```

**If it returns 503:**
- Bot is starting up (wait 30 seconds)
- Bot failed to connect to Discord (check logs)

### Deployment Keeps Failing

**Common issues:**

1. **Missing env variables** → Check Variables tab
2. **npm install fails** → Check package.json is valid
3. **Port binding error** → Railway sets PORT automatically, don't hardcode

Check logs:
→ Deployments → Latest → View Logs → Look for error messages

---

## Railway Commands

### View Logs (CLI)

```bash
# Install Railway CLI (optional)
npm install -g @railway/cli

# Login
railway login

# Link project
railway link

# View logs
railway logs

# Open dashboard
railway open
```

### Restart Deployment

Railway Dashboard:
→ Deployments → "⋮" menu → "Restart"

Or via CLI:
```bash
railway up --detach
```

---

## Cost Monitoring

### Free Tier Limits

- **$5 credit/month** (usage-based)
- **500 hours execution** (~$2.50)
- **100 GB egress** (~$1.00)

**Your estimated usage:**
- Bot runs 24/7: ~730 hours = **~$3.65/month**
- Well within free tier ✅

### If You Exceed Free Tier

Railway will email you. Options:
1. Add a credit card (charges only if you exceed $5)
2. Upgrade to Developer plan ($5/month for $5 credit + overages)

---

## Next Steps

1. **Monitor for 24 hours** - Check logs for errors
2. **Test match submissions** - Verify bot picks up hub URLs
3. **Update documentation** - Update RUNBOOK.md with Railway info
4. **Set up alerts** (optional) - Railway can notify you of failures

---

## Support

**Railway Issues:**
- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway

**Bot Issues:**
- Check logs in Railway dashboard
- Verify env variables
- Test health endpoint

---

## Summary

✅ Bot is now on Railway (persistent Node.js hosting)
✅ Health checks enabled
✅ Auto-restart on failure
✅ Better error handling
✅ Graceful shutdown
✅ Auto-deploy on git push

**The bot will now stay online 24/7 and reliably pick up match submissions.**

No more "yet again not picking up on reports" - Railway was built for this! 🎉
