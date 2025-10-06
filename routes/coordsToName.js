const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

module.exports = async (req, res) => {
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(204).set(CORS_HEADERS).send();
  }

  try {
    const ra = req.query.RA || '00 00 00';
    const dec = req.query.Declination || '+00 00 00';
    const radius = req.query.radius || 0.05;

    // TODO: Implement your coordinate to name lookup logic
    const queryURL = ``;
    const response = await fetch(queryURL);
    const text = await response.text();

    res.set({
      ...CORS_HEADERS,
      'Content-Type': 'text/plain'
    }).send(text);
  } catch (error) {
    console.error('coordsToName error:', error);
    res.status(500).set(CORS_HEADERS).json({ error: 'Internal Server Error' });
  }
};