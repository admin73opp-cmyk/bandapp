// Edge Function: invite-member
// Creates a new Ritovo user, generates an invite link, pre-creates their
// profile row, enrols them in the band, and sends a branded email via Resend.
// Requires the caller to be an admin of the target band.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
  inviteUrl: string
  appUrl: string
}): { subject: string; html: string } {
  const { firstName, bandName, invitedByName, inviteUrl, appUrl } = opts
  const greeting = firstName ? `Hi ${firstName},` : 'Hi,'

  const subject = `You've been invited to join ${bandName} on Ritovo`

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f8;padding:40px 20px">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">

          <!-- Logo / header -->
          <tr>
            <td align="center" style="padding-bottom:24px">
              <span style="font-size:28px;font-weight:800;color:#6C63FF;letter-spacing:-0.5px">Ritovo</span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#ffffff;border-radius:12px;padding:36px 40px;box-shadow:0 2px 8px rgba(0,0,0,0.07)">

              <p style="margin:0 0 20px;font-size:16px;color:#1a1a2e;font-weight:600">${greeting}</p>

              <p style="margin:0 0 16px;font-size:15px;color:#444;line-height:1.6">
                <strong>${invitedByName}</strong> has invited you to join
                <strong>${bandName}</strong> on Ritovo — the band management app
                for rehearsals, setlists, and staying in sync.
              </p>

              <p style="margin:0 0 28px;font-size:15px;color:#444;line-height:1.6">
                Click the button below to accept your invitation and set up your account.
                The link is valid for <strong>24 hours</strong>.
              </p>

              <!-- CTA button -->
              <table cellpadding="0" cellspacing="0" style="margin:0 0 28px">
                <tr>
                  <td style="background:#6C63FF;border-radius:8px">
                    <a href="${inviteUrl}"
                       style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px">
                      Accept Invitation →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:12px;color:#999;line-height:1.6">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="${inviteUrl}" style="color:#6C63FF;word-break:break-all">${inviteUrl}</a>
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:24px">
              <p style="margin:0;font-size:12px;color:#aaa">
                © Ritovo · <a href="${appUrl}" style="color:#aaa;text-decoration:none">ritovo.app</a>
              </p>
              <p style="margin:4px 0 0;font-size:11px;color:#bbb">
                You received this because an admin of ${bandName} invited you.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

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

    // Verify caller is admin of this band and fetch band + caller names in parallel
    const [{ data: mem }, { data: band }, { data: callerProfile }] = await Promise.all([
      admin.from('band_members').select('role').eq('band_id', band_id).eq('user_id', caller.id).single(),
      admin.from('bands').select('name').eq('id', band_id).single(),
      admin.from('profiles').select('first_name, last_name').eq('id', caller.id).single(),
    ])

    if (mem?.role !== 'admin') return json(req, { error: 'Only band admins can invite members' }, 403)

    const appUrl = Deno.env.get('APP_URL') || ''
    const resendKey = Deno.env.get('RESEND_API_KEY') || ''
    const fromEmail = Deno.env.get('FROM_EMAIL') || 'noreply@ritovo.app'

    // Create the invite record to get an opaque token
    const { data: invRecord, error: invRecordErr } = await admin
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
      .select('id')
      .single()

    if (invRecordErr) return json(req, { error: invRecordErr.message }, 500)

    const inviteToken = invRecord.id

    // Generate the invite link — this creates the user account without sending any email.
    // user_metadata is accessible on the client as session.user.user_metadata after sign-in.
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'invite',
      email,
      options: {
        redirectTo: appUrl,
        data: {
          first_name:       first_name || null,
          last_name:        last_name  || null,
          instrument:       instrument || null,
          needs_onboarding: true,
          invited_band_id:  band_id,
          invite_token:     inviteToken,
        },
      },
    })

    if (linkErr) {
      if (linkErr.message?.toLowerCase().includes('already registered') ||
          linkErr.message?.toLowerCase().includes('already been registered')) {
        return json(req, {
          error: 'already_registered',
          message: 'This email already has a Ritovo account. Use "Already on Ritovo?" above to find and add them.',
        }, 409)
      }
      return json(req, { error: linkErr.message }, 400)
    }

    const uid = linkData.user.id
    const inviteUrl = linkData.properties.action_link

    // Pre-create profile row so the member appears in the roster immediately
    await admin.from('profiles').upsert({
      id:         uid,
      first_name: first_name || null,
      last_name:  last_name  || null,
      instrument: instrument || null,
      lang:       'en',
    })

    // Enrol in band — they're already a member when they click their invite link
    const { error: bmErr } = await admin
      .from('band_members')
      .upsert({ band_id, user_id: uid, role }, { onConflict: 'band_id,user_id' })

    if (bmErr) return json(req, { error: bmErr.message }, 500)

    // Send branded invite email via Resend
    const bandName = band?.name || 'your band'
    const invitedByName = [callerProfile?.first_name, callerProfile?.last_name].filter(Boolean).join(' ') || 'Your band admin'
    const { subject, html } = buildInviteEmail({ firstName: first_name || '', bandName, invitedByName, inviteUrl, appUrl })

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
      // User was created and enrolled — return success but flag the email failure
      return json(req, { success: true, user_id: uid, email_warning: 'Invite created but email delivery failed' })
    }

    return json(req, { success: true, user_id: uid })

  } catch (e) {
    return json(req, { error: (e as Error).message }, 500)
  }
})
