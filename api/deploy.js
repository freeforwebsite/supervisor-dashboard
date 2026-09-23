// POST /api/deploy
// Triggers a new deployment for a Render service.

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { serviceId, account, clearCache } = req.body;
  if (!serviceId || !account) {
    return res.status(400).json({ error: 'serviceId and account are required' });
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
    const body = clearCache ? JSON.stringify({ clearCache: 'clear' }) : '{}';
    const r = await fetch(`https://api.render.com/v1/services/${encodeURIComponent(serviceId)}/deploys`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: `Bearer ${key}`,
      },
      body
    });

    const data = await r.json();
    if (!r.ok) {
      return res.status(r.status).json({ error: data.message || `Render API error ${r.status}` });
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to trigger deploy' });
  }
}
