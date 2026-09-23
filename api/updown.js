// GET /api/updown
// Fetches all checks from updown.io across multiple accounts.
//
// Supports two env-var patterns:
//   Single account:   UPDOWN_API_KEY=ro-xxxx
//   Multi account:    UPDOWN_API_KEY_1=ro-xxxx  UPDOWN_API_KEY_2=ro-yyyy  (up to 12)
//
// updown.io API: GET https://updown.io/api/checks?api-key=KEY
// Returns: token, url, alias, last_status, uptime, down, error,
//          period, last_check_at, next_check_at, ssl, metrics

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Collect all configured updown.io API keys (de-duped)
  const accounts = [];

  if (process.env.UPDOWN_API_KEY) {
    accounts.push({ id: 'UPDOWN_API_KEY', key: process.env.UPDOWN_API_KEY });
  }
  for (let i = 1; i <= 20; i++) {
    const k = process.env[`UPDOWN_API_KEY_${i}`];
    if (k && !accounts.find(a => a.key === k)) {
      accounts.push({ id: `UPDOWN_API_KEY_${i}`, key: k });
    }
  }

  const customKeysHeader = req.headers['x-custom-updown'] || '';
  const customKeys = customKeysHeader.split(',').map(k => k.trim()).filter(Boolean);
  customKeys.forEach((k, idx) => {
    if (!accounts.find(a => a.key === k)) {
      accounts.push({ id: `custom-${idx}`, key: k });
    }
  });

  if (accounts.length === 0) {
    return res.status(500).json({
      error: 'No UPDOWN_API_KEY (or UPDOWN_API_KEY_1..12) environment variables are set',
    });
  }

  try {
    const results = await Promise.all(
      accounts.map(async (acc, idx) => {
        const r = await fetch(
          `https://updown.io/api/checks?api-key=${encodeURIComponent(acc.key)}`,
          { headers: { accept: 'application/json' } }
        );

        if (!r.ok) {
          return { error: `updown.io API ${r.status} for account ${idx + 1}`, checks: [] };
        }

        const data = await r.json();

        const checks = (data || []).map((c) => ({
          id: c.token,
          token: c.token,
          name: c.alias || c.url,
          url: c.url,
          statusLabel: c.down ? 'down' : c.error ? 'seems_down' : 'up',
          lastHttpStatus: c.last_status || null,
          uptimeRatio30d: typeof c.uptime === 'number' ? c.uptime : null,
          responseTime: c.metrics?.timings?.total ?? null,
          lastCheckedAt: c.last_check_at || null,
          period: c.period || null,
          ssl: c.ssl || null,
          source: 'updown',
          account: acc.id
        }));

        return { checks };
      })
    );

    const allChecks = results.flatMap((r) => r.checks);
    const errors = results.filter((r) => r.error).map((r) => r.error);

    return res.status(200).json({ checks: allChecks, errors });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to fetch updown.io checks' });
  }
}
