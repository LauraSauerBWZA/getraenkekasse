// API-Client für die Game-Scores (B_GAME.8).
//
// `/api` wird im Standalone-Dev vom Vite-Proxy ans Backend (Port 4000)
// weitergeleitet, in der späteren React-Integration läuft es same-origin.
// credentials:'include' schickt den Session-Cookie mit, sobald es einen gibt —
// im Standalone-Dev ohne Cookie greift serverseitig der Stub-User.
const BASE = '/api';

export async function postScore(stats) {
  const res = await fetch(`${BASE}/game/scores`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      level: stats.level,
      score: stats.score,
      timeMs: stats.timeMs,
      collectiblesFound: stats.collectiblesFound,
      enemiesDefeated: stats.enemiesDefeated,
      livesLost: stats.livesLost,
    }),
  });
  if (!res.ok) throw new Error(`Score speichern fehlgeschlagen (${res.status})`);
  return res.json();
}

export async function fetchLeaderboard(timeframe = 'week') {
  const res = await fetch(`${BASE}/game/scores/leaderboard?timeframe=${timeframe}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Bestenliste laden fehlgeschlagen (${res.status})`);
  const data = await res.json();
  return data.leaderboard ?? [];
}
