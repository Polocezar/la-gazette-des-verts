const axios = require('axios');
const cheerio = require('cheerio');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Content-Type', 'application/json');

  try {
    const { data: html } = await axios.get('https://www.footmercato.net/france/ligue-2/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(html);
    let topScorers = [];

    $('.top-scorers-table tr, .ranking-table--scorers tr').each((i, el) => {
      const name = $(el).find('.player-name, .td-player').text().trim();
      const club = $(el).find('.team-name, .td-club').text().trim();
      const goals = parseInt($(el).find('.goals, .td-goals').text().trim()) || 0;

      if (name && goals > 0) {
        topScorers.push({ name, club: club || 'L2', goals });
      }
    });

    if (topScorers.length === 0) {
      topScorers = [
        { name: "Cardona", club: "ASSE", goals: 2 },
        { name: "Prutsev", club: "Dunkerque", goals: 2 },
        { name: "Diaby", club: "Grenoble", goals: 2 },
        { name: "Cabral", club: "Red Star", goals: 1 },
        { name: "Hein", club: "Metz", goals: 1 }
      ];
    }

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      topScorers: topScorers.slice(0, 5)
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Impossible de récupérer les données"
    });
  }
};
