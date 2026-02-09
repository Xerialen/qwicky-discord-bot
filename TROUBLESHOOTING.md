# qwicky-bot Troubleshooting Guide

## Critical Issue: Vercel is NOT Suitable for Discord Bots

**ROOT CAUSE:** Discord bots require a persistent WebSocket connection to Discord's Gateway API. Vercel serverless functions are designed for short-lived HTTP requests and **cannot maintain long-running WebSocket connections**.

### Why the Bot Keeps Failing on Vercel

| Issue | Explanation |
|-------|-------------|
| **Execution Time Limits** | Vercel functions timeout after 10s (Hobby) or 60s (Pro). Discord bots need to run 24/7. |
| **No WebSocket Support** | Vercel functions can't maintain the persistent Gateway connection Discord.js requires. |
| **Cold Starts** | Functions sleep when idle, meaning the bot won't be listening for messages. |
| **Process Model** | Serverless functions are stateless and ephemeral - Discord bots need a persistent process. |

### What Happens When You Deploy to Vercel

1. The bot tries to connect to Discord Gateway (WebSocket)
2. Vercel function starts executing `client.login()`
3. After 10-60 seconds, Vercel **kills the function** (timeout)
4. Bot disconnects from Discord
5. No messages are received because the bot isn't connected

**This is why the bot "yet again" stops picking up reports - it can never stay connected.**

---

## ✅ Recommended Solutions (Ranked)

### Option 1: Railway.app (EASIEST & RECOMMENDED)

Railway is designed for long-running Node.js processes and has a generous free tier.

**Setup (5 minutes):**

```bash
# 1. Sign up at railway.app (free)
# 2. Connect your GitHub repo
# 3. Add environment variables from .env
# 4. Deploy - it just works
```

**Pricing:**
- Free tier: $5 credit/month (enough for 1 bot)
- Pro: $5/month for 500 hours

**Why Railway:**
- ✅ Designed for WebSocket apps
- ✅ Zero-config deployment from GitHub
- ✅ Auto-restarts on crash
- ✅ Built-in logging dashboard
- ✅ Environment variable management
- ✅ Free SSL/custom domains

### Option 2: Render.com (SECOND BEST)

Similar to Railway, with a free tier.

**Setup:**
```bash
# 1. Create account at render.com
# 2. New Web Service → Connect GitHub
# 3. Build Command: npm install
# 4. Start Command: npm start
# 5. Add environment variables
```

**Pricing:**
- Free tier: Service sleeps after 15min inactivity (bot will miss messages!)
- Paid: $7/month for always-on

**Caveat:** Free tier **sleeps**, so you NEED the paid tier ($7/mo) for a reliable bot.

### Option 3: DigitalOcean App Platform

**Pricing:** $5/month for basic container
- ✅ Reliable
- ✅ Good uptime
- ✅ More expensive than Railway

### Option 4: Self-Host on VPS (MOST CONTROL)

Run on your own server with PM2 for process management.

**VPS Options:**
- DigitalOcean Droplet: $6/month (1GB RAM)
- Linode Nanode: $5/month
- Vultr: $6/month
- Hetzner: €4.51/month (cheapest)

**Setup with PM2:**

```bash
# Install pm2 globally
npm install -g pm2

# Start bot with pm2
cd /path/to/qwicky-discord-bot
pm2 start src/index.js --name qwicky-bot

# Enable auto-start on server reboot
pm2 startup
pm2 save

# View logs
pm2 logs qwicky-bot

# Monitor status
pm2 status
```

**Pros:**
- ✅ Full control
- ✅ Can run multiple apps on one server
- ✅ PM2 auto-restarts on crash

**Cons:**
- ❌ Requires server maintenance
- ❌ Need to manage security updates
- ❌ SSH access required for deployments

### Option 5: Systemd Service (Linux Server Only)

Create a systemd service for auto-start and restart on crash.

**Create `/etc/systemd/system/qwicky-bot.service`:**

```ini
[Unit]
Description=QWICKY Discord Bot
After=network.target

[Service]
Type=simple
User=quakeuser
WorkingDirectory=/home/quakeuser/projects/qwicky-discord-bot
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=10
StandardOutput=append:/var/log/qwicky-bot.log
StandardError=append:/var/log/qwicky-bot.log
Environment=NODE_ENV=production
EnvironmentFile=/home/quakeuser/projects/qwicky-discord-bot/.env

[Install]
WantedBy=multi-user.target
```

**Enable and start:**

```bash
sudo systemctl daemon-reload
sudo systemctl enable qwicky-bot
sudo systemctl start qwicky-bot

# Check status
sudo systemctl status qwicky-bot

# View logs
sudo journalctl -u qwicky-bot -f
```

---

## 🔧 Code Improvements for Stability

Even with proper hosting, the bot needs better error handling:

### 1. Add Discord Client Error Handlers

**Problem:** Missing error handlers for WebSocket disconnects, rate limits, etc.

**Add to `src/index.js` after `client.once('clientReady', ...)`:**

```javascript
// Handle Discord client errors
client.on('error', (error) => {
  console.error('[Discord Client Error]:', error);
});

client.on('warn', (warning) => {
  console.warn('[Discord Warning]:', warning);
});

client.on('shardError', (error) => {
  console.error('[Shard Error]:', error);
});

client.on('shardDisconnect', (event, id) => {
  console.warn(`[Shard ${id}] Disconnected:`, event);
});

client.on('shardReconnecting', (id) => {
  console.log(`[Shard ${id}] Reconnecting...`);
});

client.on('shardResume', (id, replayed) => {
  console.log(`[Shard ${id}] Resumed (${replayed} events replayed)`);
});
```

### 2. Add Graceful Shutdown

**Add to `src/index.js`:**

```javascript
// Graceful shutdown
async function shutdown(signal) {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  try {
    await client.destroy();
    console.log('Discord client destroyed');
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
```

### 3. Add Retry Logic for External API Calls

**Update `src/services/hubApi.js`:**

```javascript
async function fetchGameData(gameId, retries = 3) {
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // ... existing fetch logic ...
      return await statsResponse.json();
    } catch (err) {
      lastError = err;
      console.error(`[Attempt ${attempt}/${retries}] Failed to fetch game ${gameId}:`, err.message);

      if (attempt < retries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(`Failed to fetch game ${gameId} after ${retries} attempts: ${lastError.message}`);
}
```

### 4. Add Better Logging

**Replace all `console.log` with a proper logger:**

```bash
npm install winston
```

**Create `src/utils/logger.js`:**

```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, stack }) => {
      return `${timestamp} [${level.toUpperCase()}] ${message}${stack ? '\n' + stack : ''}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

module.exports = logger;
```

### 5. Add Health Check Endpoint (for Railway/Render)

**Create `src/health.js`:**

```javascript
const http = require('http');

function startHealthServer(port = 3000) {
  const server = http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  server.listen(port, () => {
    console.log(`Health check server listening on port ${port}`);
  });

  return server;
}

module.exports = { startHealthServer };
```

**Update `src/index.js`:**

```javascript
const { startHealthServer } = require('./health');

// ... after client.once('clientReady', ...)

// Start health check server (Railway/Render require an HTTP server)
const PORT = process.env.PORT || 3000;
startHealthServer(PORT);
```

---

## 📊 Monitoring & Debugging

### Check Bot Status

**Railway/Render:**
- Check deployment logs in dashboard
- Look for connection errors

**PM2:**
```bash
pm2 status
pm2 logs qwicky-bot --lines 100
```

**Systemd:**
```bash
sudo systemctl status qwicky-bot
sudo journalctl -u qwicky-bot -f
```

### Common Error Messages

| Error | Cause | Fix |
|-------|-------|-----|
| `Token invalid` | Wrong DISCORD_TOKEN | Check environment variable |
| `Intents missing` | Need MessageContent intent | Enable in Discord Developer Portal |
| `ECONNREFUSED` | Can't reach Supabase | Check SUPABASE_URL and keys |
| `Timeout` | Network issue or slow API | Add retry logic |
| `Process exited` | Uncaught exception | Add better error handling |

### Enable Debug Logging

Add to `.env`:
```
LOG_LEVEL=debug
NODE_ENV=development
```

---

## 🚀 Quick Migration Steps

### To Railway (RECOMMENDED):

1. **Sign up:** https://railway.app (GitHub login)
2. **New Project** → Deploy from GitHub repo
3. **Select repo:** `Xerialen/qwicky-discord-bot`
4. **Add variables:**
   - DISCORD_TOKEN
   - DISCORD_CLIENT_ID
   - SUPABASE_URL
   - SUPABASE_SERVICE_KEY
   - HUB_SUPABASE_KEY
5. **Deploy** - Railway auto-detects Node.js and runs `npm start`
6. **Monitor:** Check logs in dashboard

**Done!** Bot will stay online 24/7.

---

## Summary

**The fundamental issue:** Vercel cannot run Discord bots. You need a platform that supports persistent WebSocket connections.

**Best solution for you:**
1. **Railway.app** - Easiest, free tier works, great DX
2. Add error handlers and health checks (code improvements above)
3. Monitor logs for the first 24 hours

**Time to fix:**
- Migration to Railway: ~10 minutes
- Code improvements: ~30 minutes
- Total: ~40 minutes for a rock-solid bot

**Cost:**
- Railway free tier: $0/month (sufficient for this bot)
- If you exceed free tier: $5/month

Let me know which option you'd like to pursue and I can help with the setup!
