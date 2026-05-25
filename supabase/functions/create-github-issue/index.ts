import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { title, body, labels } = await req.json()
    const token = Deno.env.get('GITHUB_FEEDBACK_TOKEN')
    if (!token) return new Response(JSON.stringify({ message: 'Token not configured' }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })

    const res = await fetch('https://api.github.com/repos/admin73opp-cmyk/bandapp/issues', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github+json',
      },
      body: JSON.stringify({ title, body, labels }),
    })

    const data = await res.json()
    return new Response(JSON.stringify(data), { status: res.status, headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ message: err.message }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
