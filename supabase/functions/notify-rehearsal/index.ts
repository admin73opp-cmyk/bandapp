// Edge Function: notify-rehearsal
// Sends email notifications to all band members when a rehearsal is confirmed.
// Requires RESEND_API_KEY set as a Supabase secret (supabase secrets set RESEND_API_KEY=...).
// Requires FROM_EMAIL set as a Supabase secret (e.g. noreply@yourdomain.com).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Security for this endpoint comes from the JWT check below, not CORS.
// Reflect the requesting origin so the function works from any Bandapp deployment.
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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })

  try {
    const resendKey = Deno.env.get('RESEND_API_KEY')
    const fromEmail = Deno.env.get('FROM_EMAIL') || 'noreply@bandapp.app'

    if (!resendKey) return json(req, { error: 'Email service not configured' }, 503)

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

    const { band_id, title, date, start, end, location, notes } = await req.json()
    if (!band_id || !title || !date) return json(req, { error: 'band_id, title, and date are required' }, 400)

    // Verify caller is admin of this band
    const { data: mem } = await admin
      .from('band_members')
      .select('role')
      .eq('band_id', band_id)
      .eq('user_id', caller.id)
      .single()

    if (mem?.role !== 'admin') return json(req, { error: 'Only band admins can send rehearsal notifications' }, 403)

    // Get band name
    const { data: band } = await admin.from('bands').select('name').eq('id', band_id).single()
    const bandName = band?.name || 'Your Band'

    // Fetch all band_members including guest fields so we can filter correctly
    const { data: memberRows } = await admin
      .from('band_members')
      .select('user_id, role, guest_start, guest_end, guest_status, profiles(first_name, last_name)')
      .eq('band_id', band_id)

    if (!memberRows?.length) return json(req, { success: true, sent: 0 })

    // Mirror the client-side activeMembers() / isGuestActive() logic:
    //   - Remove guests whose status is 'removed' (in Guest Directory, no longer active)
    //   - Remove guests whose validity window has passed (guest_end < today)
    //   - Always include admins and regular members
    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
    const activeRows = memberRows.filter(row => {
      if (row.guest_status === 'removed') return false          // in Guest Directory
      if (row.role !== 'guest') return true                     // admin / member — always active
      if (!row.guest_start || !row.guest_end) return false      // guest with no valid window
      return today >= row.guest_start && today <= row.guest_end // within validity period
    })

    if (!activeRows.length) return json(req, { success: true, sent: 0 })

    // Resolve emails via auth.admin.getUserById — works regardless of whether the
    // profiles.email column exists (that migration may not have been run yet).
    // Bands are small (<20 members) so N parallel lookups is fast.
    const recipientsRaw = await Promise.all(
      (activeRows as { user_id: string; profiles: { first_name?: string; last_name?: string } | null }[])
        .map(async row => {
          const { data } = await admin.auth.admin.getUserById(row.user_id)
          const email = data?.user?.email
          if (!email) return null
          const p = row.profiles || {}
          const name = [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || email
          return { email, name }
        })
    )

    const recipients = recipientsRaw.filter(
      (r): r is { email: string; name: string } => r !== null
    )

    if (!recipients.length) return json(req, { success: true, sent: 0 })

    // Build email content
    const h = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
    const timeStr = start ? ` at ${h(start)}${end ? `–${h(end)}` : ''}` : ''
    const locationStr = location ? `<p><strong>Location:</strong> ${h(location)}</p>` : ''
    const notesStr = notes ? `<p><strong>Notes:</strong> ${h(notes)}</p>` : ''

    const htmlBody = `
<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
  <h2 style="color:#6C63FF;margin-bottom:4px">🎸 Rehearsal Confirmed</h2>
  <p style="color:#666;margin-top:0">${h(bandName)}</p>
  <hr style="border:none;border-top:1px solid #eee;margin:16px 0">
  <p><strong>📅 Date:</strong> ${h(date)}${timeStr}</p>
  ${locationStr}
  ${notesStr}
  <hr style="border:none;border-top:1px solid #eee;margin:16px 0">
  <p style="font-size:.8rem;color:#999">You're receiving this because you're a member of ${h(bandName)} on Bandapp.</p>
</div>`

    const textBody = `Rehearsal Confirmed — ${bandName}\n\nDate: ${date}${timeStr}${location ? `\nLocation: ${location}` : ''}${notes ? `\nNotes: ${notes}` : ''}\n\nYou're receiving this because you're a member of ${bandName} on Bandapp.`

    // Send all emails in parallel via Resend
    const results = await Promise.all(recipients.map(async (recipient) => {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `Bandapp <${fromEmail}>`,
          to: [recipient.email],
          subject: `🎸 Rehearsal confirmed: ${title} — ${date}`,
          html: htmlBody,
          text: textBody,
        }),
      })
      if (res.ok) return null
      const err = await res.json().catch(() => ({ message: res.statusText }))
      return `${recipient.email}: ${err?.message || res.statusText}`
    }))

    const errors = results.filter((e): e is string => e !== null)
    return json(req, { success: true, sent: recipients.length - errors.length, errors: errors.length ? errors : undefined })

  } catch (e) {
    return json(req, { error: (e as Error).message }, 500)
  }
})
