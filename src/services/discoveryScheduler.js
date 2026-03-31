const { supabase } = require('./supabase');

const DISCOVERY_HOUR = 22; // 22:00 UTC
const QWICKY_BASE_URL = process.env.QWICKY_URL || 'https://qwicky.vercel.app';

// Schedule checks: which days to run for each schedule type
const SCHEDULE_DAYS = {
  daily: null, // every day
  'twice-weekly': [3, 0], // Wednesday + Sunday
  weekly: [0], // Sunday only
  manual: [], // never auto-run
};

async function checkAndRunDiscovery() {
  const now = new Date();
  const hour = now.getUTCHours();
  const dayOfWeek = now.getUTCDay(); // 0=Sun

  if (hour !== DISCOVERY_HOUR) return;

  // Find tournaments with discovery enabled
  const { data: tournaments, error } = await supabase.from('tournaments').select('id, settings');

  if (error) {
    console.error('[DiscoveryScheduler] Error fetching tournaments:', error.message);
    return;
  }

  if (!tournaments) return;

  for (const t of tournaments) {
    const disc = t.settings?.discovery;
    if (!disc?.enabled) continue;

    const schedule = disc.schedule || 'daily';
    const allowedDays = SCHEDULE_DAYS[schedule];

    // manual = never auto-run
    if (Array.isArray(allowedDays) && allowedDays.length === 0) continue;
    // Check day-of-week for non-daily schedules
    if (allowedDays !== null && !allowedDays.includes(dayOfWeek)) continue;

    console.log(`[DiscoveryScheduler] Running discovery for ${t.id} (schedule: ${schedule})`);

    try {
      const res = await fetch(`${QWICKY_BASE_URL}/api/discord?action=run-discovery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId: t.id }),
        signal: AbortSignal.timeout(30000),
      });

      if (res.ok) {
        const data = await res.json();
        console.log(
          `[DiscoveryScheduler] ${t.id}: ${data.candidatesFound} candidates, ${data.posted} posted, ${data.autoImported} auto-imported, ${data.skippedDuplicates} dupes skipped`
        );
      } else {
        const err = await res.text();
        console.error(`[DiscoveryScheduler] ${t.id}: HTTP ${res.status} — ${err}`);
      }
    } catch (err) {
      console.error(`[DiscoveryScheduler] ${t.id}: Error — ${err.message}`);
    }
  }
}

module.exports = { checkAndRunDiscovery };
