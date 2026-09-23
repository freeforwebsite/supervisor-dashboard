// GET /api/uptime
// Fetches all monitors from UptimeRobot and returns status, response time, and uptime ratio.
//
// Supports two env-var patterns:
//   Single account:   UPTIMEROBOT_API_KEY=ur1234...
//   Multi account:    UPTIMEROBOT_API_KEY_1=ur1234...  UPTIMEROBOT_API_KEY_2=ur5678...  (up to 10)
//
// The monitors are matched to Render services by URL on the client side.

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Collect all configured UptimeRobot API keys
  const keys = [];

  // Support a plain UPTIMEROBOT_API_KEY (single account shorthand)
  if (process.env.UPTIMEROBOT_API_KEY) {
    keys.push(process.env.UPTIMEROBOT_API_KEY);
  }

  // Support UPTIMEROBOT_API_KEY_1 .. _10 (multi-account)
  for (let i = 1; i <= 10; i++) {
    const k = process.env[`UPTIMEROBOT_API_KEY_${i}`];
    if (k && !keys.includes(k)) keys.push(k);
  }

  if (keys.length === 0) {
    return res.status(500).json({
      error: 'No UPTIMEROBOT_API_KEY (or UPTIMEROBOT_API_KEY_1..10) environment variables are set',
    });
  }

  try {
    const results = await Promise.all(
      keys.map(async (apiKey) => {
        // UptimeRobot v2 API — POST with form body
        const body = new URLSearchParams({
          api_key: apiKey,
          format: 'json',
          response_times: '1',         // include response time
          response_times_limit: '1',   // only latest response time
          custom_uptime_ratios: '30',  // 30-day uptime %
          logs: '0',
        });

        const r = await fetch('https://api.uptimerobot.com/v2/getMonitors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        });

        const data = await r.json();

        if (data.stat !== 'ok') {
          return { error: data.error?.message || 'UptimeRobot API error', monitors: [] };
        }

        const monitors = (data.monitors || []).map((m) => ({
          id: m.id,
          name: m.friendly_name,
          url: m.url,
          // status: 0=paused, 1=not checked yet, 2=up, 8=seems down, 9=down
          status: m.status,
          statusLabel:
            m.status === 2 ? 'up'
            : m.status === 9 ? 'down'
            : m.status === 8 ? 'seems_down'
            : m.status === 0 ? 'paused'
            : 'unknown',
          // latest response time in ms (from response_times array)
          responseTime: m.response_times?.[0]?.value ?? null,
          // 30-day uptime ratio (string like "99.800")
          uptimeRatio30d: m.custom_uptime_ratio ? parseFloat(m.custom_uptime_ratio) : null,
          // last check timestamp (unix)
          lastCheckedAt: m.last_check_time ? new Date(m.last_check_time * 1000).toISOString() : null,
        }));

        return { monitors };
      })
    );

    const allMonitors = results.flatMap((r) => r.monitors);
    const errors = results.filter((r) => r.error).map((r) => r.error);

    return res.status(200).json({ monitors: allMonitors, errors });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to fetch UptimeRobot monitors' });
  }
}
