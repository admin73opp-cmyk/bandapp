// Edge Function: rsvp-remind
//
// Two modes (selected by body.mode):
//   'cron'           — daily job (pg_cron). For every rehearsal ~24h out, email
//                      each active member who hasn't responded a reminder with
//                      one-click RSVP buttons. Authorized by the CRON_SECRET header.
//   'check_complete' — fired after an RSVP is recorded. If every active member has
//                      now responded, email the band admin(s) once (spec 4.2).
//                      Authorized by a valid RSVP token (one-click path) or by a
//                      member JWT (in-app path).
//
// verify_jwt is disabled for this function (see supabase/config.toml) — all paths
// are authorized explicitly below.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { emailLayout, btn, h, rsvpButtons } from '../_shared/email.ts'

function corsHeaders(req: Request) {
  return {
    'Access-Control-Allow-Origin': req.headers.get('origin') || '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  }
}
function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  })
}

type MemberRow = {
  user_id: string
  role: string
  guest_start: string | null
  guest_end: string | null
  guest_status: string | null
  profiles: { first_name?: string; last_name?: string } | null
}

// Mirror client-side activeMembers() / isGuestActive() — same logic as notify-rehearsal.
function activeMembers(rows: MemberRow[], today: string): MemberRow[] {
  return rows.filter(row => {
    if (row.guest_status === 'removed') return false
    if (row.role !== 'guest') return true
    if (!row.guest_start || !row.guest_end) return false
    return today >= row.guest_start && today <= row.guest_end
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })

  try {
    const resendKey = Deno.env.get('RESEND_API_KEY')
    const fromEmail = Deno.env.get('FROM_EMAIL') || 'noreply@ritovo.app'
    const appUrl    = Deno.env.get('APP_URL') || ''
    if (!resendKey) return json(req, { error: 'Email service not configured' }, 503)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const send = async (to: string, subject: string, body: string, footer: string) => {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `Ritovo <${fromEmail}>`,
          to: [to],
          subject,
          html: emailLayout({ appUrl, body, footer }),
        }),
      })
      return res.ok
    }

    const emailFor = async (userId: string) => {
      const { data } = await admin.auth.admin.getUserById(userId)
      return data?.user?.email || null
    }

    const today = new Date().toISOString().split('T')[0]
    const payload = await req.json().catch(() => ({}))
    const mode = payload.mode || 'cron'

    // ─────────────────────────────────────────────────────────
    // MODE: cron — daily reminder to non-responders ~24h out
    // ─────────────────────────────────────────────────────────
    if (mode === 'cron') {
      if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) {
        return json(req, { error: 'Unauthorized' }, 401)
      }

      // Target rehearsals dated tomorrow (the day-before reminder).
      const tmrw = new Date(`${today}T00:00:00Z`)
      tmrw.setUTCDate(tmrw.getUTCDate() + 1)
      const tomorrow = tmrw.toISOString().split('T')[0]

      const { data: rehs } = await admin
        .from('rehearsals')
        .select('id, band_id, title, date, start_time, end_time, location, notes, cancelled')
        .eq('date', tomorrow)
        .eq('cancelled', false)

      let sent = 0
      for (const reh of (rehs || [])) {
        const { data: band } = await admin.from('bands').select('name').eq('id', reh.band_id).single()
        const bandName = band?.name || 'Your Band'

        const { data: memberRows } = await admin
          .from('band_members')
          .select('user_id, role, guest_start, guest_end, guest_status, profiles(first_name, last_name)')
          .eq('band_id', reh.band_id)
        const actives = activeMembers((memberRows || []) as MemberRow[], today)
        if (!actives.length) continue

        const { data: rsvps } = await admin
          .from('rehearsal_rsvps')
          .select('user_id')
          .eq('rehearsal_id', reh.id)
        const responded = new Set((rsvps || []).map(r => r.user_id))
        const pending = actives.filter(m => !responded.has(m.user_id))
        if (!pending.length) continue

        // Mint/reuse tokens for the pending members.
        const expiresAt = new Date(`${reh.date}T00:00:00Z`)
        expiresAt.setUTCDate(expiresAt.getUTCDate() + 1)
        const { data: tokenRows } = await admin
          .from('rehearsal_rsvp_tokens')
          .upsert(
            pending.map(m => ({ rehearsal_id: reh.id, user_id: m.user_id, expires_at: expiresAt.toISOString() })),
            { onConflict: 'rehearsal_id,user_id' }
          )
          .select('user_id, token')
        const tokenByUser: Record<string, string> = {}
        ;(tokenRows || []).forEach((r: { user_id: string; token: string }) => { tokenByUser[r.user_id] = r.token })

        const timeStr = reh.start_time ? ` at ${h(reh.start_time)}${reh.end_time ? `–${h(reh.end_time)}` : ''}` : ''
        const locationHtml = reh.location ? `<p style="margin:0 0 10px;font-size:15px;color:#444"><strong>📍 Location:</strong> ${h(reh.location)}</p>` : ''
        const subject = `⏰ Reminder: RSVP for ${reh.title} — tomorrow`

        for (const m of pending) {
          const email = await emailFor(m.user_id)
          if (!email) continue
          const p = m.profiles || {}
          const name = [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || email
          const token = tokenByUser[m.user_id]
          const body = `
            <p style="margin:0 0 20px;font-size:16px;color:#1a1a2e;font-weight:600">Hi ${h(name.split(' ')[0] || name)},</p>
            <p style="margin:0 0 20px;font-size:15px;color:#444;line-height:1.6">
              We haven't heard from you yet about <strong>${h(bandName)}</strong>'s rehearsal tomorrow. A quick tap lets everyone know if you're coming.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f7ff;border-radius:8px;padding:20px;margin:0 0 20px">
              <tr><td>
                <p style="margin:0 0 10px;font-size:15px;color:#1a1a2e"><strong>🎸 ${h(reh.title)}</strong></p>
                <p style="margin:0 0 10px;font-size:15px;color:#444"><strong>📅 Date:</strong> ${h(reh.date)}${timeStr}</p>
                ${locationHtml}
              </td></tr>
            </table>
            ${token ? rsvpButtons(appUrl, token) : ''}
            ${btn('Open in Ritovo', appUrl)}`
          if (await send(email, subject, body, `You're receiving this because you're a member of ${h(bandName)} on Ritovo.`)) sent++
        }
      }
      return json(req, { success: true, sent })
    }

    // ─────────────────────────────────────────────────────────
    // MODE: check_complete — notify admins when everyone responded
    // ─────────────────────────────────────────────────────────
    if (mode === 'check_complete') {
      const rehearsalId = payload.rehearsal_id
      if (!rehearsalId) return json(req, { error: 'rehearsal_id required' }, 400)

      const { data: reh } = await admin
        .from('rehearsals')
        .select('id, band_id, title, date, start_time, rsvp_complete_notified')
        .eq('id', rehearsalId)
        .single()
      if (!reh) return json(req, { error: 'not_found' }, 404)

      // Authorize: a valid RSVP token for this rehearsal (one-click path) OR a
      // band-member JWT (in-app path).
      let authorized = false
      if (payload.token) {
        const { data: tok } = await admin
          .from('rehearsal_rsvp_tokens')
          .select('rehearsal_id')
          .eq('token', payload.token)
          .single()
        authorized = !!tok && tok.rehearsal_id === rehearsalId
      }
      if (!authorized) {
        const authHeader = req.headers.get('Authorization') ?? ''
        if (authHeader) {
          const userClient = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_ANON_KEY')!,
            { global: { headers: { Authorization: authHeader } } }
          )
          const { data: { user } } = await userClient.auth.getUser()
          if (user) {
            const { data: mem } = await admin
              .from('band_members')
              .select('user_id')
              .eq('band_id', reh.band_id)
              .eq('user_id', user.id)
              .maybeSingle()
            authorized = !!mem
          }
        }
      }
      if (!authorized) return json(req, { error: 'Unauthorized' }, 401)

      if (reh.rsvp_complete_notified) return json(req, { success: true, notified: false, reason: 'already' })

      const { data: memberRows } = await admin
        .from('band_members')
        .select('user_id, role, guest_start, guest_end, guest_status, profiles(first_name, last_name)')
        .eq('band_id', reh.band_id)
      const rows = (memberRows || []) as MemberRow[]
      const actives = activeMembers(rows, today)
      if (!actives.length) return json(req, { success: true, notified: false })

      const { data: rsvps } = await admin
        .from('rehearsal_rsvps')
        .select('user_id, status')
        .eq('rehearsal_id', reh.id)
      const responded = new Set((rsvps || []).map(r => r.user_id))
      const allIn = actives.every(m => responded.has(m.user_id))
      if (!allIn) return json(req, { success: true, notified: false })

      // Claim the notification atomically: only proceed if WE flip the flag.
      const { data: claimed } = await admin
        .from('rehearsals')
        .update({ rsvp_complete_notified: true })
        .eq('id', reh.id)
        .eq('rsvp_complete_notified', false)
        .select('id')
      if (!claimed || !claimed.length) return json(req, { success: true, notified: false, reason: 'already' })

      const { data: band } = await admin.from('bands').select('name').eq('id', reh.band_id).single()
      const bandName = band?.name || 'Your Band'
      const counts = { yes: 0, no: 0, maybe: 0 } as Record<string, number>
      ;(rsvps || []).forEach(r => { if (counts[r.status] !== undefined) counts[r.status]++ })

      const admins = rows.filter(m => m.role === 'admin')
      let sent = 0
      const subject = `✅ Everyone responded: ${reh.title}`
      for (const a of admins) {
        const email = await emailFor(a.user_id)
        if (!email) continue
        const p = a.profiles || {}
        const name = [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || email
        const body = `
          <p style="margin:0 0 20px;font-size:16px;color:#1a1a2e;font-weight:600">Hi ${h(name.split(' ')[0] || name)},</p>
          <p style="margin:0 0 20px;font-size:15px;color:#444;line-height:1.6">
            All ${actives.length} members have now responded for <strong>${h(reh.title)}</strong> on ${h(reh.date)}.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f7ff;border-radius:8px;padding:20px;margin:0 0 20px">
            <tr><td>
              <p style="margin:0;font-size:15px;color:#1a1a2e"><strong>✅ ${counts.yes} yes &nbsp; ❓ ${counts.maybe} maybe &nbsp; ❌ ${counts.no} no</strong></p>
            </td></tr>
          </table>
          ${btn('View attendance', appUrl)}`
        if (await send(email, subject, body, `You're receiving this because you're an admin of ${h(bandName)} on Ritovo.`)) sent++
      }
      return json(req, { success: true, notified: true, sent })
    }

    return json(req, { error: 'Unknown mode' }, 400)

  } catch (e) {
    return json(req, { error: (e as Error).message }, 500)
  }
})
