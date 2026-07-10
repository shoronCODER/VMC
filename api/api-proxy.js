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
    apiKey = process.env.SERPAPI_KEY || '9fd5315b9d743e7d525f5453f377d223aa029c13ab618c29f7572c0301ee4990';
    // Always inject the server-side API key – strip any client-supplied key
    // and replace it with the trusted env-var value so the server key is
    // always authoritative.
    finalUrl = finalUrl.replace(/([?&])api_key=[^&]*/g, '$1');
    // Clean up any trailing/duplicate & or ? left after stripping
    finalUrl = finalUrl.replace(/[?&]+$/, '').replace(/\?&/, '?').replace(/&&+/g, '&');
    finalUrl += (finalUrl.includes('?') ? '&' : '?') + 'api_key=' + apiKey;
  } else if (targetUrl.includes('gravatar.com')) {
    apiKey = process.env.GRAVATAR_KEY || '9779:gk-o329SkDSSggxt5mjw3In179SDd8h5EszGrwceCLss3E6ihlwHXVkxv6fOh6KA';
  } else if (targetUrl.includes('api.imgbb.com')) {
    apiKey = process.env.IMGBB_KEY || process.env.IMGBB_API_KEY || 'f8d14329b0afdd729258591e14bdca77';
    finalUrl = finalUrl.replace(/([?&])key=[^&]*/g, '$1');
    finalUrl = finalUrl.replace(/[?&]+$/, '').replace(/\?&/, '?').replace(/&&+/g, '&');
    finalUrl += (finalUrl.includes('?') ? '&' : '?') + 'key=' + apiKey;
  }

  try {
    https.get(finalUrl, (apiRes) => {
      let data = '';
      apiRes.on('data', (chunk) => {
        data += chunk;
      });
      apiRes.on('end', () => {
        if (apiRes.statusCode !== 200) {
          // For debugging purposes, return finalUrl
          res.setHeader('Content-Type', 'application/json');
          res.status(apiRes.statusCode).send(JSON.stringify({
            originalResponse: data,
            debug_finalUrl: finalUrl
          }));
          return;
        }
        res.setHeader('Content-Type', apiRes.headers['content-type'] || 'application/json');
        res.status(apiRes.statusCode).send(data);
      });
    }).on('error', (err) => {
      res.status(500).json({ error: err.message, debug_finalUrl: finalUrl });
    });
  } catch (err) {
    res.status(500).json({ error: err.message, debug_finalUrl: finalUrl });
  }
};
