// Edge Function: notify-rehearsal
// Sends email notifications to all band members when a rehearsal is confirmed.
// Requires RESEND_API_KEY set as a Supabase secret (supabase secrets set RESEND_API_KEY=...).
// Requires FROM_EMAIL set as a Supabase secret (e.g. noreply@yourdomain.com).

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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const resendKey = Deno.env.get('RESEND_API_KEY')
    const fromEmail = Deno.env.get('FROM_EMAIL') || 'noreply@bandapp.app'

    if (!resendKey) return json({ error: 'Email service not configured' }, 503)

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
    if (!caller) return json({ error: 'Unauthorized' }, 401)

    const { band_id, title, date, start, end, location, notes } = await req.json()
    if (!band_id || !title || !date) return json({ error: 'band_id, title, and date are required' }, 400)

    // Verify caller is admin of this band
    const { data: mem } = await admin
      .from('band_members')
      .select('role')
      .eq('band_id', band_id)
      .eq('user_id', caller.id)
      .single()

    if (mem?.role !== 'admin') return json({ error: 'Only band admins can send rehearsal notifications' }, 403)

    // Get band name
    const { data: band } = await admin.from('bands').select('name').eq('id', band_id).single()
    const bandName = band?.name || 'Your Band'

    // Get all band member user IDs
    const { data: members } = await admin
      .from('band_members')
      .select('user_id')
      .eq('band_id', band_id)

    if (!members?.length) return json({ success: true, sent: 0 })

    const memberIds = members.map((m: { user_id: string }) => m.user_id)

    // Fetch member emails and names from auth.users + profiles
    const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 })
    const profiles: Record<string, { first_name?: string; last_name?: string }> = {}

    const { data: profileRows } = await admin
      .from('profiles')
      .select('id, first_name, last_name')
      .in('id', memberIds)

    ;(profileRows || []).forEach((p: { id: string; first_name?: string; last_name?: string }) => {
      profiles[p.id] = p
    })

    const recipients = (users?.users || [])
      .filter((u) => memberIds.includes(u.id) && u.email)
      .map((u) => ({
        email: u.email!,
        name: (() => {
          const p = profiles[u.id]
          return p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() || u.email! : u.email!
        })(),
      }))

    if (!recipients.length) return json({ success: true, sent: 0 })

    // Build email content
    const timeStr = start ? ` at ${start}${end ? `–${end}` : ''}` : ''
    const locationStr = location ? `<p><strong>Location:</strong> ${location}</p>` : ''
    const notesStr = notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''

    const htmlBody = `
<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
  <h2 style="color:#6C63FF;margin-bottom:4px">🎸 Rehearsal Confirmed</h2>
  <p style="color:#666;margin-top:0">${bandName}</p>
  <hr style="border:none;border-top:1px solid #eee;margin:16px 0">
  <p><strong>📅 Date:</strong> ${date}${timeStr}</p>
  ${locationStr}
  ${notesStr}
  <hr style="border:none;border-top:1px solid #eee;margin:16px 0">
  <p style="font-size:.8rem;color:#999">You're receiving this because you're a member of ${bandName} on Bandapp.</p>
</div>`

    const textBody = `Rehearsal Confirmed — ${bandName}\n\nDate: ${date}${timeStr}${location ? `\nLocation: ${location}` : ''}${notes ? `\nNotes: ${notes}` : ''}\n\nYou're receiving this because you're a member of ${bandName} on Bandapp.`

    // Send via Resend — one email per recipient
    let sent = 0
    const errors: string[] = []

    for (const recipient of recipients) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `Bandapp <${fromEmail}>`,
          to: [recipient.email],
          subject: `🎸 Rehearsal confirmed: ${title} — ${date}`,
          html: htmlBody,
          text: textBody,
        }),
      })

      if (res.ok) {
        sent++
      } else {
        const err = await res.json().catch(() => ({ message: res.statusText }))
        errors.push(`${recipient.email}: ${err?.message || res.statusText}`)
      }
    }

    return json({ success: true, sent, errors: errors.length ? errors : undefined })

  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
