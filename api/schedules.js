// Serverless API endpoint for IT Onsite Shift - Upstash Redis Cloud Database
const REDIS_KEY = 'it_onsite_shift_data';

module.exports = async (req, res) => {
  // CORS & Cache Prevention Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;

  if (!kvUrl || !kvToken) {
    return res.status(500).json({
      error: 'configuration_error',
      message: 'KV_REST_API_URL or KV_REST_API_TOKEN is missing.'
    });
  }

  // --- GET: Fetch schedules from Cloud Redis ---
  if (req.method === 'GET') {
    try {
      const getRes = await fetch(`${kvUrl}/get/${REDIS_KEY}`, {
        headers: { Authorization: `Bearer ${kvToken}` }
      });

      if (!getRes.ok) {
        return res.status(getRes.status).json({
          error: 'redis_error',
          message: 'Failed to read from Upstash Redis'
        });
      }

      const json = await getRes.json();
      if (!json.result) {
        return res.status(200).json({ schedules: null, updated_at: 0 });
      }

      const data = typeof json.result === 'string' ? JSON.parse(json.result) : json.result;
      return res.status(200).json({
        schedules: data.schedules || null,
        updated_at: data.updated_at || 0
      });
    } catch (err) {
      console.error('API GET error:', err);
      return res.status(500).json({ error: 'internal_error', message: err.message });
    }
  }

  // --- POST: Save schedules to Cloud Redis with conflict detection ---
  if (req.method === 'POST') {
    try {
      let body = req.body;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch (e) {}
      }

      if (!body || !body.schedules) {
        return res.status(400).json({
          error: 'invalid_payload',
          message: 'Missing schedules in request body.'
        });
      }

      const { schedules, lastKnownUpdatedAt, force } = body;

      // Conflict detection: Check existing timestamp if lastKnownUpdatedAt provided and not forced
      if (lastKnownUpdatedAt && !force) {
        const curRes = await fetch(`${kvUrl}/get/${REDIS_KEY}`, {
          headers: { Authorization: `Bearer ${kvToken}` }
        });
        if (curRes.ok) {
          const curJson = await curRes.json();
          if (curJson.result) {
            const currentData = typeof curJson.result === 'string' ? JSON.parse(curJson.result) : curJson.result;
            if (currentData && typeof currentData.updated_at === 'number' && currentData.updated_at > lastKnownUpdatedAt) {
              return res.status(409).json({
                error: 'conflict',
                message: 'Newer schedule data exists on cloud.',
                currentUpdatedAt: currentData.updated_at
              });
            }
          }
        }
      }

      const newUpdatedAt = Date.now();
      const envelope = {
        schedules: schedules,
        updated_at: newUpdatedAt
      };

      const setRes = await fetch(`${kvUrl}/set/${REDIS_KEY}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${kvToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(envelope)
      });

      if (!setRes.ok) {
        return res.status(setRes.status).json({
          error: 'redis_error',
          message: 'Failed to write to Upstash Redis'
        });
      }

      return res.status(200).json({
        success: true,
        updated_at: newUpdatedAt
      });
    } catch (err) {
      console.error('API POST error:', err);
      return res.status(500).json({ error: 'internal_error', message: err.message });
    }
  }

  return res.status(405).json({ error: 'method_not_allowed', message: 'Method not allowed' });
};
