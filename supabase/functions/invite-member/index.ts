// Edge Function: invite-member
// Records an invite (audit trail) and emails the invitee the band's join
// code plus a one-click link. No account is created here — the invitee
// signs up and joins on their own via the join code.
// Requires the caller to be an admin of the target band.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { emailLayout, btn, h } from '../_shared/email.ts'

function corsHeaders(req: Request) {
  return {
    'Access-Control-Allow-Origin': req.headers.get('origin') || '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  })
}

function buildInviteEmail(opts: {
  firstName: string
  bandName: string
  invitedByName: string
  joinCode: string
  joinUrl: string
  appUrl: string
}): { subject: string; html: string } {
  const { firstName, bandName, invitedByName, joinCode, joinUrl, appUrl } = opts
  const greeting = firstName ? `Hi ${h(firstName)},` : 'Hi,'
  const subject = `You've been invited to join ${bandName} on Ritovo`

  const body = `
    <p style="margin:0 0 20px;font-size:16px;color:#1a1a2e;font-weight:600">${greeting}</p>
    <p style="margin:0 0 16px;font-size:15px;color:#444;line-height:1.6">
      <strong>${h(invitedByName)}</strong> has invited you to join
      <strong>${h(bandName)}</strong> on Ritovo — the band management app
      for rehearsals, setlists, and staying in sync.
    </p>
    <p style="margin:0 0 4px;font-size:15px;color:#444;line-height:1.6">
      Click the button below, sign up or sign in, and you'll join automatically.
    </p>
    ${btn('Join ' + h(bandName) + ' →', joinUrl)}
    <p style="margin:20px 0 4px;font-size:13px;color:#666;line-height:1.6">
      Or open Ritovo and enter this join code:
    </p>
    <p style="margin:0 0 16px;font-size:32px;font-weight:700;letter-spacing:6px;font-family:monospace;color:#1a1a2e;background:#f4f3ff;padding:14px 18px;border-radius:8px;text-align:center">
      ${h(joinCode)}
    </p>
    <p style="margin:0;font-size:12px;color:#999;line-height:1.6">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <a href="${joinUrl}" style="color:#6C63FF;word-break:break-all">${joinUrl}</a>
    </p>`

  const html = emailLayout({
    appUrl,
    body,
    footer: `You received this because an admin of ${h(bandName)} invited you.`,
  })

  return { subject, html }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })

  try {
    const authHeader = req.headers.get('Authorization') ?? ''

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user: caller } } = await userClient.auth.getUser()
    if (!caller) return json(req, { error: 'Unauthorized' }, 401)

    const { band_id, email, first_name, last_name, instrument, role = 'member' } = await req.json()
    if (!band_id || !email) return json(req, { error: 'band_id and email are required' }, 400)

    // Verify caller is admin of this band and fetch caller's name in parallel
    const [{ data: mem }, { data: callerProfile }] = await Promise.all([
      admin.from('band_members').select('role').eq('band_id', band_id).eq('user_id', caller.id).single(),
      admin.from('profiles').select('first_name, last_name').eq('id', caller.id).single(),
    ])

    if (mem?.role !== 'admin') return json(req, { error: 'Only band admins can invite members' }, 403)

    // Strip trailing slash — Supabase strict-matches redirectTo against the allowed
    // redirect URLs list; a mismatch (e.g. trailing slash present in APP_URL but not
    // in the Dashboard allowlist) causes the redirect to arrive without auth tokens.
    const appUrl = (Deno.env.get('APP_URL') || '').replace(/\/$/, '')
    const resendKey = Deno.env.get('RESEND_API_KEY') || ''
    const fromEmail = Deno.env.get('FROM_EMAIL') || 'noreply@ritovo.app'

    // Record the invite — this is the audit trail, not an account.
    const { error: invRecordErr } = await admin
      .from('band_invites')
      .insert({
        band_id,
        email:      email        || null,
        first_name: first_name   || null,
        last_name:  last_name    || null,
        instrument: instrument   || null,
        role,
        invited_by: caller.id,
      })

    if (invRecordErr) return json(req, { error: invRecordErr.message }, 500)

    // Fetch the band's join code — this is what the invitee actually uses
    // to get in. No account or band_members row is created here.
    const { data: bandRow } = await admin
      .from('bands').select('name, join_code').eq('id', band_id).single()
    const joinCode = bandRow?.join_code ?? ''

    // Send branded invite email via Resend
    const bandName = bandRow?.name || 'your band'
    const invitedByName = [callerProfile?.first_name, callerProfile?.last_name].filter(Boolean).join(' ') || 'Your band admin'
    const joinUrl = `${appUrl}/?band=${band_id}`
    const { subject, html } = buildInviteEmail({ firstName: first_name || '', bandName, invitedByName, joinCode, joinUrl, appUrl })

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `Ritovo <${fromEmail}>`,
        to: [email],
        subject,
        html,
      }),
    })

    if (!emailRes.ok) {
      const emailErr = await emailRes.text()
      console.error('[invite-member] Resend error:', emailErr)
      // No account was created, so a failed send means nothing happened.
      return json(req, { error: 'email_failed',
        message: `Could not send the email. Share the code ${joinCode} with them directly.` }, 502)
    }

    return json(req, { success: true })

  } catch (e) {
    return json(req, { error: (e as Error).message }, 500)
  }
})
