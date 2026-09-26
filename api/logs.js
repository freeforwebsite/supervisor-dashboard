// GET /api/logs?serviceId=srv-xxxx&ownerId=tea-xxxx&account=1
// Returns the recent logs for one service on one account.

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { serviceId, ownerId, account } = req.query;
  if (!serviceId || !ownerId || !account) {
    return res.status(400).json({ error: 'serviceId, ownerId, and account are required' });
  }

  let key = null;
  if (String(account).startsWith('custom-')) {
    const idx = parseInt(String(account).replace('custom-', ''), 10);
    const customKeysHeader = req.headers['x-custom-render'] || '';
    const customKeys = customKeysHeader.split(',').map(k => k.trim()).filter(Boolean);
    key = customKeys[idx];
  } else {
    key = process.env[`RENDER_API_KEY_${account}`];
  }

  if (!key) {
    return res.status(400).json({ error: `No API key configured for account ${account}` });
  }

  try {
    const r = await fetch(`https://api.render.com/v1/logs?resource=${serviceId}&ownerId=${ownerId}&limit=100`, {
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${key}`,
      },
    });

    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      return res.status(r.status).json({ error: body.message || `Render API ${r.status}` });
    }

    const data = await r.json();
    const logs = (data.logs || []).map(entry => ({
      timestamp: entry.timestamp,
      message: entry.message,
    }));

    return res.status(200).json({ logs });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to fetch logs' });
  }
}
