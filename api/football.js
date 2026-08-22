// api/football.js
// Résultats, calendrier officiel et top buteurs de la Ligue 2 BKT via API-Football (api-sports.io).
// Nécessite la variable d'environnement API_FOOTBALL_KEY, à définir dans
// Vercel > Project Settings > Environment Variables.
//
// Utilisation :
//   /api/football?type=fixtures&journee=5   -> résultats de la journée 5
//   /api/football?type=calendar             -> calendrier complet de la saison
//   /api/football?type=topscorers           -> top buteurs de la Ligue 2 BKT

const axios = require('axios');

const API_BASE = 'https://v3.football.api-sports.io';

const CLUBS = [
  "AS Saint-Étienne", "FC Annecy", "USL Dunkerque", "FC Metz", "Montpellier HSC",
  "Red Star FC", "Rodez AF", "EA Guingamp", "Pau FC", "Stade Lavallois",
  "Stade de Reims", "Dijon FCO", "US Boulogne", "AS Nancy-Lorraine",
  "Grenoble Foot 38", "Clermont Foot 63", "FC Sochaux-Montbéliard", "FC Nantes"
];

function normalize(str) {
  return str
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\b(fc|as|sc|us|ea|usl|hsc|fco|foot|38|63)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Fait correspondre un nom d'équipe renvoyé par l'API à un nom de club de l'appli
function matchClub(apiName) {
  const n = normalize(apiName);
  for (const club of CLUBS) {
    const cn = normalize(club);
    if (cn === n || cn.includes(n) || n.includes(cn)) return club;
  }
  return apiName; // pas de correspondance trouvée : on garde le nom brut
}

function currentSeasonYear() {
  const now = new Date();
  const month = now.getMonth() + 1;
  return month >= 7 ? now.getFullYear() : now.getFullYear() - 1;
}

async function apiCall(path, apiKey) {
  const response = await axios.get(`${API_BASE}${path}`, {
    timeout: 8000,
    headers: { 'x-apisports-key': apiKey }
  });
  return response.data;
}

// Mise en cache légère au niveau du process (utile si l'instance serverless reste "chaude")
let cachedLeague = null;

async function resolveLeague(apiKey) {
  if (cachedLeague) return cachedLeague;
  const data = await apiCall('/leagues?name=Ligue 2&country=France', apiKey);
  const league = data.response && data.response[0];
  if (!league) throw new Error("Ligue 2 introuvable via l'API");
  const wantedYear = currentSeasonYear();
  const season = league.seasons.find(s => s.year === wantedYear)
    || league.seasons.find(s => s.current)
    || league.seasons[league.seasons.length - 1];
  cachedLeague = { id: league.league.id, season: season.year };
  return cachedLeague;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) {
    return res.status(500).json({ success: false, error: "Clé API-Football manquante (variable API_FOOTBALL_KEY non définie sur Vercel)" });
  }

  const { type, journee } = req.query;

  try {
    const { id: leagueId, season } = await resolveLeague(apiKey);

    if (type === 'debug') {
      const r = await apiCall(`/leagues?name=Ligue 2&country=France`, apiKey);
      const league = r.response && r.response[0];
      const allSeasons = league ? league.seasons.map(s => ({ year: s.year, current: s.current, start: s.start, end: s.end })) : [];

      const fixturesRaw = await apiCall(`/fixtures?league=${leagueId}&season=${season}`, apiKey);
      const sampleRounds = (fixturesRaw.response || []).slice(0, 5).map(f => ({
        round: f.league.round,
        home: f.teams.home.name,
        away: f.teams.away.name,
        date: f.fixture.date,
        status: f.fixture.status.short
      }));

      return res.status(200).json({
        success: true,
        resolvedLeagueId: leagueId,
        resolvedSeason: season,
        leagueNameFound: league ? league.league.name : null,
        countryFound: league ? league.country.name : null,
        allAvailableSeasons: allSeasons,
        totalFixturesReturned: (fixturesRaw.response || []).length,
        fixturesApiErrors: fixturesRaw.errors,
        sampleRounds
      });
    }

    if (type === 'topscorers') {
      res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
      const data = await apiCall(`/players/topscorers?league=${leagueId}&season=${season}`, apiKey);
      const topScorers = (data.response || []).map(p => ({
        name: p.player.name,
        club: matchClub(p.statistics[0].team.name),
        goals: p.statistics[0].goals.total || 0
      }));
      return res.status(200).json({ success: true, topScorers });
    }

    if (type === 'calendar') {
      res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
      const data = await apiCall(`/fixtures?league=${leagueId}&season=${season}`, apiKey);
      const calendar = {};
      (data.response || []).forEach(f => {
        const roundMatch = /(\d+)\s*$/.exec(f.league.round || '');
        if (!roundMatch) return;
        const j = roundMatch[1];
        if (!calendar[j]) calendar[j] = [];
        const finished = ['FT', 'AET', 'PEN'].includes(f.fixture.status.short);
        calendar[j].push({
          home: matchClub(f.teams.home.name),
          away: matchClub(f.teams.away.name),
          homeScore: finished ? f.goals.home : null,
          awayScore: finished ? f.goals.away : null
        });
      });
      return res.status(200).json({ success: true, calendar });
    }

    if (type === 'fixtures') {
      if (!journee) return res.status(400).json({ success: false, error: "Paramètre journee manquant" });
      res.setHeader('Cache-Control', 's-maxage=180, stale-while-revalidate=600');
      const data = await apiCall(`/fixtures?league=${leagueId}&season=${season}&round=Regular Season - ${journee}`, apiKey);
      const fixtures = (data.response || []).map(f => ({
        home: matchClub(f.teams.home.name),
        away: matchClub(f.teams.away.name),
        homeScore: f.goals.home,
        awayScore: f.goals.away,
        status: f.fixture.status.short
      }));
      return res.status(200).json({ success: true, journee: Number(journee), fixtures });
    }

    return res.status(400).json({ success: false, error: "Paramètre type invalide (fixtures, calendar ou topscorers)" });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
};
