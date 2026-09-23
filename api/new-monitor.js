// POST /api/new-monitor
// Creates a new UptimeRobot monitor (HTTP type).
// We default to using the primary UPTIMEROBOT_API_KEY (or _1, or the first custom key).

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url, name } = req.body;
  if (!url || !name) {
    return res.status(400).json({ error: 'url and name are required' });
  }

  // Find a valid UptimeRobot API key to use
  let apiKey = null;
  
  // 1. Check custom browser keys first
  const customKeysHeader = req.headers['x-custom-uptimerobot'] || '';
  const customKeys = customKeysHeader.split(',').map(k => k.trim()).filter(Boolean);
  if (customKeys.length > 0) apiKey = customKeys[0];
  
  // 2. Fallback to Env vars
  if (!apiKey) apiKey = process.env.UPTIMEROBOT_API_KEY;
  if (!apiKey) apiKey = process.env.UPTIMEROBOT_API_KEY_1;
  
  // 3. Fallback to any of the 20 env vars
  if (!apiKey) {
    for (let i = 1; i <= 20; i++) {
      if (process.env[`UPTIMEROBOT_API_KEY_${i}`]) {
        apiKey = process.env[`UPTIMEROBOT_API_KEY_${i}`];
        break;
      }
    }
  }

  if (!apiKey) {
    return res.status(500).json({ error: 'No UptimeRobot API key found to create monitor.' });
  }

  try {
    const params = new URLSearchParams();
    params.append('api_key', apiKey);
    params.append('format', 'json');
    params.append('type', '1'); // 1 = HTTP
    params.append('url', url);
    params.append('friendly_name', name);

    const r = await fetch('https://api.uptimerobot.com/v2/newMonitor', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'cache-control': 'no-cache',
      },
      body: params.toString()
    });

    const data = await r.json();
    if (data.stat !== 'ok') {
      return res.status(400).json({ error: data.error?.message || 'Failed to create monitor in UptimeRobot' });
    }

    return res.status(200).json({ success: true, monitor: data.monitor });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to create monitor' });
  }
}
