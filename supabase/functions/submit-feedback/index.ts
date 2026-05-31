// Edge Function: submit-feedback
// Receives a feedback submission, creates a GitHub Issue with the appropriate
// label (bug / feedback / suggestion), and stores the record in Supabase.
//
// Required secrets (set via Supabase Dashboard → Project Settings → Edge Functions):
//   GITHUB_TOKEN  — PAT with repo scope (issues:write) for admin73opp-cmyk/bandapp
// Optional secrets / env vars:
//   GITHUB_OWNER  — default: admin73opp-cmyk
//   GITHUB_REPO   — default: bandapp

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

const LABEL_MAP: Record<string, string> = {
  bug:        'bug',
  feedback:   'feedback',
  suggestion: 'suggestion',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace(/^Bearer\s+/i, '')

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Verify the caller's JWT using the admin client — more reliable than userClient.auth.getUser()
    const { data: { user }, error: authErr } = await admin.auth.getUser(token)

    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Unauthorized' }, 401)

    const { category, description, page, band_id, band_name } = await req.json()
    if (!category || !description) {
      return json({ error: 'category and description are required' }, 400)
    }
    if (!LABEL_MAP[category]) {
      return json({ error: 'category must be bug, feedback, or suggestion' }, 400)
    }

    // Fetch submitter's display name
    const { data: profile } = await admin
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', user.id)
      .single()
    const userName = profile
      ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
      : ''

    // ── GitHub Issue ──────────────────────────────────────────
    const GITHUB_TOKEN = Deno.env.get('GITHUB_TOKEN')
    const GITHUB_OWNER = Deno.env.get('GITHUB_OWNER') || 'admin73opp-cmyk'
    const GITHUB_REPO  = Deno.env.get('GITHUB_REPO')  || 'bandapp'

    const shortDesc = description.length > 72 ? description.slice(0, 72) + '…' : description
    const title = `[${category.charAt(0).toUpperCase() + category.slice(1)}] ${shortDesc}`

    const body = [
      `**Category:** ${category}`,
      `**Page:** ${page || '—'}`,
      `**Band:** ${band_name || '—'}`,
      `**User:** ${userName || '—'} (${user.email || '—'})`,
      '',
      '**Description:**',
      description,
      '',
      '---',
      `_Submitted via Bandapp on ${new Date().toISOString().slice(0, 10)}_`,
    ].join('\n')

    let issueNumber: number | null = null
    let issueUrl:    string | null = null

    if (GITHUB_TOKEN) {
      const ghResp = await fetch(
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues`,
        {
          method: 'POST',
          headers: {
            Authorization:  `token ${GITHUB_TOKEN}`,
            Accept:         'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            'User-Agent':   'Bandapp-Feedback/1.0',
          },
          body: JSON.stringify({ title, body, labels: [LABEL_MAP[category]] }),
        }
      )

      if (ghResp.ok) {
        const issue = await ghResp.json()
        issueNumber = issue.number
        issueUrl    = issue.html_url
      } else {
        const errText = await ghResp.text()
        console.error('[submit-feedback] GitHub API error:', ghResp.status, errText)
        // Non-fatal: record still saved to DB below
      }
    } else {
      console.warn('[submit-feedback] GITHUB_TOKEN not set — skipping GitHub Issue creation')
    }

    // ── Persist to Supabase ───────────────────────────────────
    const { error: dbErr } = await admin.from('feedback').insert({
      user_id:             user.id,
      user_name:           userName || null,
      user_email:          user.email || null,
      band_id:             band_id   || null,
      page:                page      || null,
      category,
      description,
      github_issue_number: issueNumber,
      github_issue_url:    issueUrl,
    })

    if (dbErr) {
      console.error('[submit-feedback] DB insert error:', dbErr)
      // Still report success if GitHub issue was created
    }

    return json({ success: true, issueNumber, issueUrl })

  } catch (e) {
    console.error('[submit-feedback] Unexpected error:', e)
    return json({ error: (e as Error).message }, 500)
  }
})
