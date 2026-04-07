const { createClient } = require('@libsql/client');

let client = null;

function getClient() {
  if (!client) {
    if (!process.env.TURSO_DB_URL || !process.env.TURSO_AUTH_TOKEN) {
      console.warn('[Turso] Credentials not configured, Turso disabled.');
      return null;
    }
    client = createClient({
      url: process.env.TURSO_DB_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return client;
}

async function getGameByHubId(hubId) {
  const c = getClient();
  if (!c) return null;
  const r = await c.execute({
    sql: `SELECT g.sha256, g.mode, g.map, g.date, g.duration, g.server,
                 g.team1, g.team2, g.score1, g.score2, g.winner, g.raw_ktxstats
          FROM games g
          JOIN hub_ids h ON g.sha256 = h.sha256
          WHERE h.hub_id = ?`,
    args: [hubId],
  });
  return r.rows.length > 0 ? r.rows[0] : null;
}

async function getGameBySha256(sha256) {
  const c = getClient();
  if (!c) return null;
  const r = await c.execute({
    sql: `SELECT sha256, mode, map, date, duration, server,
                 team1, team2, score1, score2, winner, raw_ktxstats
          FROM games WHERE sha256 = ?`,
    args: [sha256],
  });
  return r.rows.length > 0 ? r.rows[0] : null;
}

async function insertGame({ hubId, sha256, mode, ktxstats }) {
  const c = getClient();
  if (!c) return false;

  const data = typeof ktxstats === 'string' ? JSON.parse(ktxstats) : ktxstats;
  const raw = typeof ktxstats === 'string' ? ktxstats : JSON.stringify(ktxstats);
  const players = data.players || [];
  if (players.length === 0) return false;

  let team1, team2, score1, score2;
  const teamsList = data.teams;

  if (mode === '1on1') {
    if (players.length < 2) return false;
    team1 = players[0].name || '';
    team2 = players[1].name || '';
    score1 = players[0].stats?.frags ?? players[0].frags ?? 0;
    score2 = players[1].stats?.frags ?? players[1].frags ?? 0;
  } else {
    if (!teamsList || teamsList.length < 2) return false;
    team1 = teamsList[0];
    team2 = teamsList[1];
    const scores = {};
    for (const p of players) {
      const t = p.team || '';
      scores[t] = (scores[t] || 0) + (p.stats?.frags ?? p.frags ?? 0);
    }
    score1 = scores[teamsList[0]] || 0;
    score2 = scores[teamsList[1]] || 0;
  }

  const winner = score1 > score2 ? team1 : (score2 > score1 ? team2 : 'draw');

  const batch = [
    {
      sql: `INSERT OR IGNORE INTO games (sha256, mode, map, date, duration, server,
            team1, team2, score1, score2, winner, raw_ktxstats)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [sha256, mode, data.map || '', data.date || '', data.duration || null,
             data.hostname || '', team1, team2, score1, score2, winner, raw],
    },
  ];

  for (const p of players) {
    const s = p.stats || {};
    const dmg = p.dmg || {};
    const w = p.weapons || {};
    const items = p.items || {};
    const rl = w.rl || {};
    const lg = w.lg || {};
    const pName = p.name || '';
    const pTeam = mode === '1on1' ? pName : (p.team || '');

    batch.push({
      sql: `INSERT OR IGNORE INTO player_games
            (sha256, player_name, team, mode, map, date, frags, deaths, kills,
             damage_given, damage_taken, damage_enemy_weapons, taken_to_die,
             rl_kills_enemy, rl_dropped, rl_picked_up, rl_hits,
             lg_kills_enemy, lg_dropped, lg_acc_attacks, lg_acc_hits,
             quad_pickups, pent_pickups, ra_pickups, ya_pickups, ga_pickups, mh_pickups)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        sha256, pName, pTeam, mode, data.map || '', data.date || '',
        s.frags ?? 0, s.deaths ?? 0, s.kills ?? 0,
        dmg.given ?? 0, dmg.taken ?? 0,
        dmg['enemy-weapons'] ?? 0, dmg['taken-to-die'] ?? 0,
        rl.kills?.enemy ?? 0, rl.pickups?.dropped ?? 0,
        rl.pickups?.['total-taken'] ?? 0, rl.acc?.hits ?? 0,
        lg.kills?.enemy ?? 0, lg.pickups?.dropped ?? 0,
        lg.acc?.attacks ?? 0, lg.acc?.hits ?? 0,
        items.q?.took ?? 0, items.p?.took ?? 0,
        items.ra?.took ?? 0, items.ya?.took ?? 0,
        items.ga?.took ?? 0, items.health_100?.took ?? 0,
      ],
    });
  }

  if (hubId) {
    batch.push({
      sql: `INSERT OR IGNORE INTO hub_ids (hub_id, sha256, mode) VALUES (?, ?, ?)`,
      args: [hubId, sha256, mode],
    });
  }

  try {
    await c.batch(batch);
    return true;
  } catch (err) {
    console.error('[Turso] Insert failed:', err.message);
    return false;
  }
}

module.exports = { getClient, getGameByHubId, getGameBySha256, insertGame };
