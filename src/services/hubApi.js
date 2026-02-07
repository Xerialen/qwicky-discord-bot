const HUB_DB_URL = 'https://ncsphkjfominimxztjip.supabase.co/rest/v1/v1_games';
const HUB_SUPABASE_KEY = process.env.HUB_SUPABASE_KEY;

async function fetchGameData(gameId) {
  // 1. Fetch game record from hub DB
  const url = `${HUB_DB_URL}?id=eq.${gameId}&select=*`;
  const response = await fetch(url, {
    headers: {
      'apikey': HUB_SUPABASE_KEY,
      'Authorization': `Bearer ${HUB_SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Hub DB returned ${response.status} for game ${gameId}`);
  }

  const data = await response.json();
  if (!data || data.length === 0) {
    throw new Error(`Game ${gameId} not found`);
  }

  const game = data[0];

  // 2. Build ktxstats URL from demo hash
  let statsUrl = null;
  if (game.demo_sha256) {
    const chk = game.demo_sha256;
    statsUrl = `https://d.quake.world/${chk.substring(0,3)}/${chk}.mvd.ktxstats.json`;
  } else {
    statsUrl = game.demo_source_url || game.url;
  }

  if (!statsUrl) {
    throw new Error(`No demo path found for game ${gameId}`);
  }

  // 3. Fetch the actual ktxstats JSON (same format the API proxy uses)
  const statsResponse = await fetch(statsUrl, {
    headers: {
      'User-Agent': 'QwickyBot/1.0',
      'Accept': '*/*',
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!statsResponse.ok) {
    throw new Error(`Stats fetch failed (${statsResponse.status}) for game ${gameId}`);
  }

  return await statsResponse.json();
}

module.exports = { fetchGameData };
