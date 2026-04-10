const { getGameByHubId, insertGame } = require('./tursoClient');

const HUB_DB_URL = 'https://ncsphkjfominimxztjip.supabase.co/rest/v1/v1_games';
const HUB_ANON_KEY = process.env.HUB_ANON_KEY || process.env.HUB_SUPABASE_KEY;

async function fetchGameData(gameId) {
  // 1. Try Turso
  const cached = await getGameByHubId(Number(gameId));
  if (cached && cached.raw_ktxstats) {
    return JSON.parse(cached.raw_ktxstats);
  }

  // 2. Fallback: fetch from Hub
  if (!HUB_ANON_KEY) {
    throw new Error('Game not yet indexed and HUB_ANON_KEY not configured');
  }

  const url = `${HUB_DB_URL}?id=eq.${gameId}&select=id,demo_sha256,mode`;
  const response = await fetch(url, {
    headers: {
      apikey: HUB_ANON_KEY,
      Authorization: `Bearer ${HUB_ANON_KEY}`,
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`Hub returned ${response.status} for game ${gameId}`);
  }

  const data = await response.json();
  if (!data || data.length === 0) {
    throw new Error(`Game ${gameId} not found`);
  }

  const game = data[0];
  const sha256 = game.demo_sha256;
  if (!sha256) {
    throw new Error(`No demo hash for game ${gameId}`);
  }

  // 3. Fetch ktxstats
  const prefix = sha256.substring(0, 3);
  const statsUrl = `https://d.quake.world/${prefix}/${sha256}.mvd.ktxstats.json`;
  const statsResponse = await fetch(statsUrl, {
    headers: { 'User-Agent': 'QwickyBot/1.0' },
    signal: AbortSignal.timeout(10000),
  });

  if (!statsResponse.ok) {
    throw new Error(`Stats fetch failed (${statsResponse.status}) for game ${gameId}`);
  }

  const ktxstats = await statsResponse.json();

  // 4. Insert into Turso (fire-and-forget)
  const mode =
    game.mode === 'duel'
      ? '1on1'
      : game.mode === '2on2tdm'
        ? '2on2'
        : game.mode === '4on4tdm'
          ? '4on4'
          : game.mode;

  insertGame({ hubId: game.id, sha256, mode, ktxstats }).catch((err) => {
    console.error('[HubApi] Turso insert failed (non-blocking):', err.message);
  });

  return ktxstats;
}

module.exports = { fetchGameData };
