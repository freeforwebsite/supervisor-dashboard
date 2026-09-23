// DELETE /api/delete-service
// Deletes a web service from Render

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { account, serviceId } = req.body;
  
  if (!account || !serviceId) {
    return res.status(400).json({ error: 'Missing account or serviceId' });
  }

  // Helper to resolve API key
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
    const r = await fetch(`https://api.render.com/v1/services/${serviceId}`, {
      method: 'DELETE',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${key}`
      }
    });
    
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      return res.status(r.status).json({ error: data.message || `Failed to delete service (Status ${r.status})` });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
