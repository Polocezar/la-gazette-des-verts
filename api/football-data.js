module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Content-Type', 'application/json');

  const officialScorers = [
    { name: "Irvin Cardona", club: "ASSE", goals: 2 },
    { name: "Egor Prutsev", club: "Dunkerque", goals: 2 },
    { name: "Yadaly Diaby", club: "Grenoble", goals: 2 },
    { name: "Jakob Breum", club: "ASSE", goals: 1 },
    { name: "Thierno Ballo", club: "ASSE", goals: 1 }
  ];

  const officialJournee2Matches = [
    { home: "FC Annecy", homeScore: 1, awayScore: 1, away: "FC Sochaux-Montbéliard" },
    { home: "AS Saint-Étienne", homeScore: 3, awayScore: 1, away: "Clermont Foot 63" },
    { home: "Pau FC", homeScore: 0, awayScore: 2, away: "Stade de Reims" },
    { home: "US Boulogne", homeScore: 1, awayScore: 1, away: "Dijon FCO" },
    { home: "AS Nancy-Lorraine", homeScore: 1, awayScore: 2, away: "Montpellier HSC" },
    { home: "EA Guingamp", homeScore: 0, awayScore: 0, away: "USL Dunkerque" },
    { home: "FC Metz", homeScore: 1, awayScore: 1, away: "Grenoble Foot 38" },
    { home: "Red Star FC", homeScore: 2, awayScore: 1, away: "Rodez AF" },
    { home: "FC Nantes", homeScore: 0, awayScore: 0, away: "Stade Lavallois" }
  ];

  return res.status(200).json({
    success: true,
    currentJournee: 2,
    topScorers: officialScorers,
    journeeMatches: officialJournee2Matches
  });
};
