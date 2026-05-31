// Edge Function: notify-rehearsal
// Sends email notifications to all band members when a rehearsal is confirmed.

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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })

  try {
    const resendKey = Deno.env.get('RESEND_API_KEY')
    const fromEmail = Deno.env.get('FROM_EMAIL') || 'noreply@ritovo.app'
    const appUrl    = Deno.env.get('APP_URL') || ''

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

    const { data: band } = await admin.from('bands').select('name').eq('id', band_id).single()
    const bandName = band?.name || 'Your Band'

    // Fetch all band members including guest fields for active-member filtering
    const { data: memberRows } = await admin
      .from('band_members')
      .select('user_id, role, guest_start, guest_end, guest_status, profiles(first_name, last_name)')
      .eq('band_id', band_id)

    if (!memberRows?.length) return json(req, { success: true, sent: 0 })

    // Mirror client-side activeMembers() / isGuestActive() logic
    const today = new Date().toISOString().split('T')[0]
    const activeRows = memberRows.filter(row => {
      if (row.guest_status === 'removed') return false
      if (row.role !== 'guest') return true
      if (!row.guest_start || !row.guest_end) return false
      return today >= row.guest_start && today <= row.guest_end
    })

    if (!activeRows.length) return json(req, { success: true, sent: 0 })

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

    // Build email
    const timeStr    = start ? ` at ${h(start)}${end ? `–${h(end)}` : ''}` : ''
    const locationHtml = location ? `<p style="margin:0 0 10px;font-size:15px;color:#444"><strong>📍 Location:</strong> ${h(location)}</p>` : ''
    const notesHtml    = notes    ? `<p style="margin:0 0 10px;font-size:15px;color:#444"><strong>📝 Notes:</strong> ${h(notes)}</p>`    : ''

    const subject = `🎸 Rehearsal confirmed: ${title} — ${date}`

    const makeBody = (recipientName: string) => `
      <p style="margin:0 0 20px;font-size:16px;color:#1a1a2e;font-weight:600">Hi ${h(recipientName.split(' ')[0] || recipientName)},</p>
      <p style="margin:0 0 20px;font-size:15px;color:#444;line-height:1.6">
        A rehearsal has been confirmed for <strong>${h(bandName)}</strong>. See you there!
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f7ff;border-radius:8px;padding:20px;margin:0 0 20px">
        <tr><td>
          <p style="margin:0 0 10px;font-size:15px;color:#1a1a2e"><strong>🎸 ${h(title)}</strong></p>
          <p style="margin:0 0 10px;font-size:15px;color:#444"><strong>📅 Date:</strong> ${h(date)}${timeStr}</p>
          ${locationHtml}
          ${notesHtml}
        </td></tr>
      </table>
      ${btn('Open in Ritovo', appUrl)}
      <p style="margin:0;font-size:12px;color:#999;line-height:1.6">
        If the button doesn't work, visit <a href="${appUrl}" style="color:#6C63FF">${appUrl.replace(/\/$/, '')}</a>
      </p>`

    // Send all emails in parallel
    const results = await Promise.all(recipients.map(async (recipient) => {
      const html = emailLayout({
        appUrl,
        body: makeBody(recipient.name),
        footer: `You're receiving this because you're a member of ${h(bandName)} on Ritovo.`,
      })

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `Ritovo <${fromEmail}>`,
          to: [recipient.email],
          subject,
          html,
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
