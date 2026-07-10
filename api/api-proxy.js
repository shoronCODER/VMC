const https = require('https');

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { targetUrl } = req.query;

  if (!targetUrl) {
    res.status(400).json({ error: 'Missing targetUrl parameter' });
    return;
  }

  let apiKey = '';
  let finalUrl = targetUrl;

  if (targetUrl.includes('serpapi.com')) {
    apiKey = process.env.SERPAPI_KEY || '';
    // Always inject the server-side API key – strip any client-supplied key
    // and replace it with the trusted env-var value so the server key is
    // always authoritative.
    finalUrl = finalUrl.replace(/([?&])api_key=[^&]*/g, '$1');
    // Clean up any trailing/duplicate & or ? left after stripping
    finalUrl = finalUrl.replace(/[?&]+$/, '').replace(/\?&/, '?').replace(/&&+/g, '&');
    finalUrl += (finalUrl.includes('?') ? '&' : '?') + 'api_key=' + apiKey;
  } else if (targetUrl.includes('gravatar.com')) {
    apiKey = process.env.GRAVATAR_KEY || '';
  }

  try {
    https.get(finalUrl, (apiRes) => {
      let data = '';
      apiRes.on('data', (chunk) => {
        data += chunk;
      });
      apiRes.on('end', () => {
        res.setHeader('Content-Type', apiRes.headers['content-type'] || 'application/json');
        res.status(apiRes.statusCode).send(data);
      });
    }).on('error', (err) => {
      res.status(500).json({ error: err.message });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
