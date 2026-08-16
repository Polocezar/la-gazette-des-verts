// api/news.js
// Agrégateur d'actualités ASSE.
// Interroge plusieurs flux RSS directement côté serveur (pas de service tiers
// comme rss2json), fusionne les résultats, supprime les doublons et trie par date.

const cheerio = require('cheerio');

const FEEDS = [
  {
    url: 'https://news.google.com/rss/search?q=%22AS%20Saint-%C3%89tienne%22%20OR%20%22ASSE%22&hl=fr&gl=FR&ceid=FR:fr',
    label: 'Google Actualités',
    isGoogleNews: true
  },
  {
    url: 'https://news.google.com/rss/search?q=%22Les%20Verts%22%20%22Saint-%C3%89tienne%22%20football&hl=fr&gl=FR&ceid=FR:fr',
    label: 'Google Actualités',
    isGoogleNews: true
  },
  { url: 'https://peuple-vert.fr/feed/', label: 'Peuple-Vert.fr' },
  { url: 'https://www.madeinsaint-etienne.com/feed/', label: 'Made in Saint-Étienne' },
  { url: 'https://www.envertetcontretous.fr/feed/', label: 'En Vert et Contre Tous' }
];

const TIMEOUT_MS = 6000;

function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return fetch(url, {
    signal: controller.signal,
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GazetteDesVertsBot/1.0)' }
  }).finally(() => clearTimeout(timer));
}

// Google Actualités formate ses titres "Titre réel - Nom du média"
function extractGoogleNewsSource(rawTitle) {
  const parts = rawTitle.split(' - ');
  if (parts.length > 1) {
    const source = parts.pop().trim();
    return { title: parts.join(' - ').trim(), source };
  }
  return { title: rawTitle.trim(), source: 'Presse Web' };
}

async function parseFeed(feed) {
  const response = await fetchWithTimeout(feed.url);
  if (!response.ok) throw new Error(`HTTP ${response.status} sur ${feed.url}`);
  const xml = await response.text();
  const $ = cheerio.load(xml, { xmlMode: true });

  const items = [];
  $('item').each((_, el) => {
    const $el = $(el);
    let title = $el.find('title').first().text().trim();
    const link = $el.find('link').first().text().trim();
    const pubDateRaw = $el.find('pubDate').first().text().trim();
    const pubDate = pubDateRaw ? new Date(pubDateRaw) : null;

    let source = feed.label;
    if (feed.isGoogleNews) {
      const extracted = extractGoogleNewsSource(title);
      title = extracted.title;
      source = extracted.source;
    } else {
      const src = $el.find('source').first().text().trim();
      if (src) source = src;
    }

    if (title && link) {
      items.push({
        title,
        link,
        source,
        pubDate: pubDate && !isNaN(pubDate) ? pubDate.toISOString() : null
      });
    }
  });
  return items;
}

function normalizeForDedupe(title) {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .trim();
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Content-Type', 'application/json');
  // Cache CDN Vercel : 10 min, revalidation silencieuse ensuite
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1800');

  const results = await Promise.allSettled(FEEDS.map(parseFeed));

  let allItems = [];
  results.forEach((r) => {
    if (r.status === 'fulfilled') allItems = allItems.concat(r.value);
  });

  // Suppression des doublons (même actu reprise par plusieurs flux)
  const seen = new Set();
  const deduped = [];
  for (const item of allItems) {
    const key = normalizeForDedupe(item.title);
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(item);
    }
  }

  // Tri du plus récent au plus ancien
  deduped.sort((a, b) => {
    if (!a.pubDate && !b.pubDate) return 0;
    if (!a.pubDate) return 1;
    if (!b.pubDate) return -1;
    return new Date(b.pubDate) - new Date(a.pubDate);
  });

  return res.status(200).json({
    success: deduped.length > 0,
    count: deduped.length,
    generatedAt: new Date().toISOString(),
    articles: deduped.slice(0, 60)
  });
};
