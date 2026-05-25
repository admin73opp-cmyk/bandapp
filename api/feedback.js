module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  const token = process.env.GITHUB_FEEDBACK_TOKEN;
  if (!token) return res.status(500).json({ message: 'Token not configured on server' });

  const { title, body, labels } = req.body;
  const response = await fetch('https://api.github.com/repos/admin73opp-cmyk/bandapp/issues', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.github+json',
    },
    body: JSON.stringify({ title, body, labels }),
  });

  const data = await response.json();
  return res.status(response.status).json(data);
};
