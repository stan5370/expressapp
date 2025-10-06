const { Client } = require('@elastic/elasticsearch');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

const es = new Client({
  node: process.env.ELASTIC_NODE,
  auth: { apiKey: process.env.ELASTIC_API_KEY }
});

function extractTextFromSSE(sse) {
  const lines = sse.split(/\r?\n/);
  let out = '';
  for (const line of lines) {
    if (!line.startsWith('data:')) continue;
    const jsonStr = line.slice(5).trim();
    if (!jsonStr) continue;
    try {
      const evt = JSON.parse(jsonStr);
      const delta = evt?.choices?.[0]?.delta;
      if (delta?.content) out += delta.content;
    } catch {}
  }
  return out.trim();
}

function buildMessages(starCoords) {
  return [
    {
      role: 'system',
      content: 'Given the name of a star, return ONLY the following scientific properties without giving a range; use all of this in single paragraph description of the Star:\n' +
        '- Star Name\n' +
        '- Radius (Solar Masses)\n' +
        '- Radius Units (In Solar Masses): \n' +
        '- Absolute Magnitude\n' +
        '- Color\n' +
        '- Distance from Earth in Light Years\n\n' +
        '- Distance Units\n' +
        "- Coordinate of the Star in this format '00 00 00' for Right Ascension, '00 00 00' for Declination\n\n" +
        "- List out any exoplanets in a list [exoplanet_one, exoplanet_2,...]\n"
    },
    { role: 'user', content: `Star coordinates: ${starCoords}` }
  ];
}

module.exports = async (req, res) => {
  console.log('Received /api/namesToDesc request');
  
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(204).set(CORS_HEADERS).send();
  }

  try {
    console.log("entered try block");

    const ra = req.query.RA || '00 00 00';
    console.log("RA:", ra);
    const dec = req.query.Declination || '+00 00 00';
    console.log("Dec:", dec);
    
    if (!ra) {
      return res.status(400).set(CORS_HEADERS).json({ 
        error: 'Missing RA parameter',
        message: 'RA (Right Ascension) is required'
      });
    }

    const modelId = process.env.ELASTIC_LLM_ID || '.rainbow-sprinkles-elastic';
    const messages = buildMessages(ra + " " + dec);
    console.log("Messages:", messages);
    console.log("Model ID:", modelId);
    console.log("Sending request to Elastic LLM");
    
    // Streamed chat completion
    const stream = await es.transport.request(
      {
        method: 'POST',
        path: `/_inference/chat_completion/${encodeURIComponent(modelId)}/_stream`,
        body: { messages }
      },
      { asStream: true }
    );

    let raw = '';
    for await (const chunk of stream) {
      raw += chunk.toString('utf8'); 
      console.log(chunk.toString('utf8'));
    }
    
    const text = extractTextFromSSE(raw) || 'No response.';
    console.log("LLM response text:", text);

    // Return JSON response to client
    return res.set(CORS_HEADERS).json({
      success: true,
      data: {
        llmResponse: text,
        coordinates: {
          ra: ra,
          dec: dec
        },
        timestamp: new Date().toISOString()
      }
    });

  } catch (err) {
    console.error('LLM completion failed:', err);
    return res.status(500).set(CORS_HEADERS).json({ 
      success: false,
      error: 'LLM completion failed',
      message: err.message 
    });
  }
};