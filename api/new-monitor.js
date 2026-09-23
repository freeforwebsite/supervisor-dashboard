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
    const r = await fetch('https://api.uptimerobot.com/v3/monitors', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        type: 1, // 1 = HTTP
        url: url,
        friendlyName: name,
        interval: 300,
        timeout: 30
      })
    });

    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      let errMsg = data.message || data.error?.message || 'Failed to create monitor in UptimeRobot';
      if (Array.isArray(errMsg)) errMsg = errMsg.join(', ');
      
      if (errMsg.toLowerCase().includes('not allowed to perform')) {
        errMsg = 'UptimeRobot blocked this. You are likely using a Read-Only API Key. Please provide a Main API Key in Settings to create monitors.';
      }
      return res.status(400).json({ error: errMsg });
    }

    const data = await r.json();
    return res.status(200).json({ success: true, monitor: data });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to create monitor' });
  }
}
