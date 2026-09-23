// POST /api/suspend
// Body: { "serviceId": "srv-xxxx", "account": 1 }
// Suspends a running service on the given account (1-10).

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { serviceId, account } = req.body || {};
  if (!serviceId || typeof serviceId !== 'string') {
    return res.status(400).json({ error: 'serviceId is required' });
  }
  if (!account) {
    return res.status(400).json({ error: 'account (1-10) is required' });
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
    const r = await fetch(`https://api.render.com/v1/services/${serviceId}/suspend`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${key}`,
      },
    });

    if (r.status === 202) {
      return res.status(200).json({ ok: true, serviceId, status: 'suspending' });
    }

    const body = await r.json().catch(() => ({}));
    return res.status(r.status).json({ ok: false, error: body.message || `Render API ${r.status}` });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to suspend service' });
  }
}
