const HUB_DB_URL = 'https://ncsphkjfominimxztjip.supabase.co/rest/v1/v1_games';
const HUB_SUPABASE_KEY = process.env.HUB_SUPABASE_KEY;

async function fetchGameData(gameId) {
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

  return data[0];
}

module.exports = { fetchGameData };
