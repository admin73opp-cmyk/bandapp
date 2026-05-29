import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const APP_URL = Deno.env.get('APP_URL') || ''

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') || ''
  const allowed = APP_URL && origin === APP_URL ? origin : ''
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })

  try {
    // Verify the caller is an authenticated Supabase user
    const authHeader = req.headers.get('Authorization') ?? ''
    if (!authHeader) return json(req, { error: 'Unauthorized' }, 401)

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json(req, { error: 'Unauthorized' }, 401)

    const { title, body, labels } = await req.json()

    // Input validation
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return json(req, { error: 'title is required' }, 400)
    }
    if (title.length > 256) return json(req, { error: 'title too long' }, 400)
    if (body && typeof body !== 'string') return json(req, { error: 'body must be a string' }, 400)
    if (body && body.length > 65536) return json(req, { error: 'body too long' }, 400)

    const safeLabels = Array.isArray(labels)
      ? labels.filter((l: unknown) => typeof l === 'string').slice(0, 10)
      : []

    const token = Deno.env.get('GITHUB_FEEDBACK_TOKEN')
    if (!token) return json(req, { message: 'Token not configured' }, 500)

    const res = await fetch('https://api.github.com/repos/admin73opp-cmyk/bandapp/issues', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github+json',
      },
      body: JSON.stringify({ title: title.trim(), body: body || '', labels: safeLabels }),
    })

    const data = await res.json()
    return json(req, data, res.status)
  } catch (err) {
    return json(req, { message: (err as Error).message }, 500)
  }
})
