export default async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });
  const { monitorId, source, account } = req.body || {};
  if (!monitorId || !source || !account) return res.status(400).json({ error: 'Missing monitorId, source, or account' });

  // Resolve API key
  let apiKey = null;
  if (account.startsWith('custom-')) {
    const idx = parseInt(account.replace('custom-', ''), 10);
    const headerName = source === 'uptimerobot' ? 'x-custom-uptimerobot' : 'x-custom-updown';
    const customKeys = (req.headers[headerName] || '').split(',').map(k => k.trim()).filter(Boolean);
    apiKey = customKeys[idx];
  } else {
    apiKey = process.env[account];
  }

  if (!apiKey) return res.status(401).json({ error: 'Invalid or missing API key for account' });

  try {
    if (source === 'uptimerobot') {
      const r = await fetch(`https://api.uptimerobot.com/v3/monitors/${monitorId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        let msg = data.message || data.error?.message || 'UptimeRobot API error';
        if (Array.isArray(msg)) msg = msg.join(', ');
        if (msg.toLowerCase().includes('not allowed to perform')) {
          msg = 'UptimeRobot blocked this. You are likely using a Read-Only API Key. Please provide a Main API Key to delete monitors.';
        }
        throw new Error(msg);
      }
    } else if (source === 'updown') {
      const r = await fetch(`https://updown.io/api/checks/${encodeURIComponent(monitorId)}?api-key=${encodeURIComponent(apiKey)}`, {
        method: 'DELETE',
        headers: { accept: 'application/json' }
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.error || 'updown.io API error');
      }
    } else {
      return res.status(400).json({ error: 'Unknown source' });
    }
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
