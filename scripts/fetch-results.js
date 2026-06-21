// Fetches FIFA World Cup 2026 results from football-data.org and writes results.json.
// Runs in GitHub Actions (Node 20+, global fetch). No npm dependencies.
//
// Requires env var FOOTBALL_DATA_TOKEN (set as a GitHub Actions secret).
// football-data.org free tier includes competition code "WC" (World Cup).

const fs = require('fs');
const path = require('path');

const TOKEN = process.env.FOOTBALL_DATA_TOKEN;
if (!TOKEN) {
  console.error('Missing FOOTBALL_DATA_TOKEN env var.');
  process.exit(1);
}

const API_URL = 'https://api.football-data.org/v4/competitions/WC/matches';

// The 48 team names exactly as the app uses them.
const APP_TEAMS = new Set([
  'Mexico','South Africa','Korea Republic','Czechia','Canada','Bosnia and Herzegovina',
  'Qatar','Switzerland','Brazil','Morocco','Haiti','Scotland','United States','Paraguay',
  'Australia','Türkiye','Germany','Curaçao','Ivory Coast','Ecuador','Netherlands','Japan',
  'Sweden','Tunisia','Belgium','Egypt','Iran','New Zealand','Spain','Cape Verde',
  'Saudi Arabia','Uruguay','France','Senegal','Iraq','Norway','Argentina','Algeria',
  'Austria','Jordan','Portugal','DR Congo','Uzbekistan','Colombia','England','Croatia',
  'Ghana','Panama',
]);

// Maps football-data.org names -> app names. Only the ones that are likely to differ;
// names not listed are passed through unchanged. Extend this after the first real run
// if the log reports any "unmapped" teams.
const NAME_MAP = {
  'Turkey': 'Türkiye',
  'Türkiye': 'Türkiye',
  'Czech Republic': 'Czechia',
  'South Korea': 'Korea Republic',
  'Republic of Korea': 'Korea Republic',
  'USA': 'United States',
  'United States of America': 'United States',
  'Ivory Coast': 'Ivory Coast',
  "Côte d'Ivoire": 'Ivory Coast',
  'Cote d Ivoire': 'Ivory Coast',
  'Cabo Verde': 'Cape Verde',
  'Curacao': 'Curaçao',
  'DR Congo': 'DR Congo',
  'Congo DR': 'DR Congo',
  'Democratic Republic of the Congo': 'DR Congo',
  'Bosnia & Herzegovina': 'Bosnia and Herzegovina',
  'Bosnia-Herzegovina': 'Bosnia and Herzegovina',
};

function mapName(name) {
  if (!name) return null;
  const mapped = NAME_MAP[name] || name;
  return mapped;
}

async function main() {
  const res = await fetch(API_URL, { headers: { 'X-Auth-Token': TOKEN } });
  if (!res.ok) {
    console.error(`API request failed: ${res.status} ${res.statusText}`);
    const body = await res.text().catch(() => '');
    console.error(body.slice(0, 500));
    process.exit(1);
  }

  const data = await res.json();
  const rawMatches = Array.isArray(data.matches) ? data.matches : [];
  const out = [];
  const unmapped = new Set();

  for (const m of rawMatches) {
    const home = mapName(m.homeTeam && m.homeTeam.name);
    const away = mapName(m.awayTeam && m.awayTeam.name);
    if (!home || !away) continue;

    // Flag names we couldn't reconcile so they can be added to NAME_MAP.
    if (!APP_TEAMS.has(home)) unmapped.add(`${m.homeTeam && m.homeTeam.name} -> ${home}`);
    if (!APP_TEAMS.has(away)) unmapped.add(`${m.awayTeam && m.awayTeam.name} -> ${away}`);

    const ft = (m.score && m.score.fullTime) || {};
    const hs = ft.home;
    const as = ft.away;
    // Only emit matches that have an actual score (played or in progress).
    if (hs == null || as == null) continue;

    out.push({
      stage: m.stage || null,        // GROUP_STAGE, LAST_32, LAST_16, QUARTER_FINALS, SEMI_FINALS, THIRD_PLACE, FINAL
      group: m.group || null,        // e.g. "GROUP_A"
      status: m.status || null,      // FINISHED, IN_PLAY, PAUSED, etc.
      home, away,
      homeScore: hs,
      awayScore: as,
      // Qualifier for knockout matches incl. penalty shootouts: HOME_TEAM/AWAY_TEAM/DRAW.
      winner: (m.score && m.score.winner) || null,
    });
  }

  if (unmapped.size) {
    console.warn('⚠ Unmapped team names (add these to NAME_MAP in fetch-results.js):');
    for (const u of unmapped) console.warn('  ' + u);
  }

  const payload = { updated: new Date().toISOString(), count: out.length, matches: out };
  const outPath = path.join(__dirname, '..', 'results.json');
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + '\n');
  console.log(`Wrote ${out.length} scored matches to results.json`);
}

main().catch((e) => { console.error(e); process.exit(1); });
