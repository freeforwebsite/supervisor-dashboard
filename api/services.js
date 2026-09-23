// GET /api/services
// Loops through RENDER_API_KEY_1 .. RENDER_API_KEY_10 (skips any that aren't set),
// fetches each account's services from Render, and returns one merged list.
// Each returned service is tagged with which account (1-10) it belongs to,
// so start/suspend calls know which key to use.

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const accounts = [];
  for (let i = 1; i <= 20; i++) {
    const key = process.env[`RENDER_API_KEY_${i}`];
    if (key) {
      accounts.push({
        index: i,
        key,
        name: process.env[`RENDER_ACCOUNT_${i}_NAME`] || `Account ${i}`,
      });
    }
  }

  const customKeysHeader = req.headers['x-custom-render'] || '';
  const customKeys = customKeysHeader.split(',').map(k => k.trim()).filter(Boolean);
  
  customKeys.forEach((key, idx) => {
    accounts.push({
      index: `custom-${idx}`,
      key,
      name: `Local Account ${idx + 1}`,
    });
  });

  if (accounts.length === 0) {
    return res.status(500).json({ error: 'No RENDER_API_KEY_1..10 environment variables are set, and no custom keys provided.' });
  }

  try {
    const results = await Promise.all(
      accounts.map(async (acc) => {
        const r = await fetch('https://api.render.com/v1/services?limit=100', {
          headers: {
            accept: 'application/json',
            authorization: `Bearer ${acc.key}`,
          },
        });
        if (!r.ok) {
          return { account: acc.index, accountName: acc.name, error: `Render API ${r.status}`, services: [] };
        }
        const data = await r.json();
        const services = (data || []).map((entry) => {
          const s = entry.service || entry;
          return {
            id: s.id,
            name: s.name,
            type: s.type,
            status: s.suspended === 'suspended' ? 'suspended' : (s.status || 'running'),
            region: s.serviceDetails?.region || null,
            url: s.serviceDetails?.url || null,
            updatedAt: s.updatedAt,
            account: acc.index,
            accountName: acc.name,
            buildCommand: s.serviceDetails?.envSpecificDetails?.buildCommand || null,
            startCommand: s.serviceDetails?.envSpecificDetails?.startCommand || null,
          };
        });
        return { account: acc.index, accountName: acc.name, services };
      })
    );

    const merged = results.flatMap((r) => r.services);
    const errors = results.filter((r) => r.error).map((r) => ({ account: r.account, error: r.error }));
    const activeAccounts = accounts.map(a => ({ index: a.index, name: a.name }));

    return res.status(200).json({ services: merged, errors, accounts: activeAccounts });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to fetch services' });
  }
}
