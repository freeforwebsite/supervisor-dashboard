// POST /api/create-service
// Deploys a new web service to Render

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { account, name, repo, branch, envType, buildCommand, startCommand, sourceServiceId, sourceAccount } = req.body;
  
  if (!account || !name || !repo || !envType) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Helper to resolve API key
  function resolveKey(accId) {
    if (String(accId).startsWith('custom-')) {
      const idx = parseInt(String(accId).replace('custom-', ''), 10);
      const customKeysHeader = req.headers['x-custom-render'] || '';
      const customKeys = customKeysHeader.split(',').map(k => k.trim()).filter(Boolean);
      return customKeys[idx];
    }
    return process.env[`RENDER_API_KEY_${accId}`];
  }

  const targetKey = resolveKey(account);
  if (!targetKey) {
    return res.status(400).json({ error: `No API key configured for account ${account}` });
  }

  try {
    // 1. Fetch owner ID
    const ownerRes = await fetch('https://api.render.com/v1/owners', {
      headers: { accept: 'application/json', authorization: `Bearer ${targetKey}` }
    });
    const ownerData = await ownerRes.json();
    if (!ownerRes.ok || !ownerData.length) {
      return res.status(400).json({ error: 'Failed to fetch Render owner profile for this account.' });
    }
    const ownerId = ownerData[0].owner.id;

    // 2. Fetch Env Vars if requested
    let envVarsToApply = undefined;
    if (sourceServiceId && sourceAccount) {
      const sourceKey = resolveKey(sourceAccount);
      if (!sourceKey) {
        return res.status(400).json({ error: 'Source account API key not found for cloning env vars.' });
      }
      const sourceRes = await fetch(`https://api.render.com/v1/services/${sourceServiceId}/env-vars`, {
        headers: { accept: 'application/json', authorization: `Bearer ${sourceKey}` }
      });
      if (sourceRes.ok) {
        const sourceData = await sourceRes.json();
        envVarsToApply = (sourceData || []).map(item => ({
          key: item.envVar.key,
          value: item.envVar.value || ''
        })).filter(item => item.key);
      } else {
        return res.status(400).json({ error: 'Failed to fetch env vars from source service.' });
      }
    }

    // 3. Build payload
    const payload = {
      type: 'web_service',
      name: name,
      ownerId: ownerId,
      repo: repo,
      branch: branch || 'main',
      autoDeploy: 'yes',
      envVars: envVarsToApply,
      serviceDetails: {
        plan: 'free',
        env: envType,
        envSpecificDetails: envType === 'node' ? {
          buildCommand: buildCommand || 'npm install',
          startCommand: startCommand || 'npm start'
        } : undefined
      }
    };

    // 4. Create service
    const createRes = await fetch('https://api.render.com/v1/services', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: `Bearer ${targetKey}`
      },
      body: JSON.stringify(payload)
    });
    
    const createData = await createRes.json();
    if (!createRes.ok) {
      return res.status(createRes.status).json({ error: createData.message || 'Failed to create service' });
    }

    return res.status(200).json({ success: true, service: createData });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
