const ALLOWED_ORIGIN = process.env.APP_URL || 'https://ritovo.net';

module.exports = async (req, res) => {
  const origin = req.headers.origin || '';
  const corsOrigin = origin === ALLOWED_ORIGIN ? ALLOWED_ORIGIN : '';
  if (corsOrigin) res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  // Verify caller is an authenticated Supabase user
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!bearer) return res.status(401).json({ message: 'Missing auth token' });

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return res.status(500).json({ message: 'Server misconfigured' });

  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${bearer}`, apikey: supabaseAnonKey },
  });
  if (!userRes.ok) return res.status(401).json({ message: 'Invalid or expired session' });

  const githubToken = process.env.GITHUB_FEEDBACK_TOKEN;
  if (!githubToken) return res.status(500).json({ message: 'Token not configured on server' });

  // Input validation
  const { title, body, labels } = req.body || {};
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return res.status(400).json({ message: 'title is required' });
  }
  if (title.length > 256) return res.status(400).json({ message: 'title too long' });
  if (body && typeof body !== 'string') return res.status(400).json({ message: 'body must be a string' });
  if (body && body.length > 65536) return res.status(400).json({ message: 'body too long' });

  const safeLabels = Array.isArray(labels)
    ? labels.filter(l => typeof l === 'string').slice(0, 10)
    : [];

  const response = await fetch('https://api.github.com/repos/admin73opp-cmyk/bandapp/issues', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${githubToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.github+json',
    },
    body: JSON.stringify({ title: title.trim(), body: body || '', labels: safeLabels }),
  });

  const data = await response.json();
  return res.status(response.status).json(data);
};
