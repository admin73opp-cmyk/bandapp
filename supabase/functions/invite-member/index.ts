// Edge Function: invite-member
// Creates a new Bandapp user via Supabase invite email, pre-creates their
// profile row, and enrols them in the band — all before they ever log in.
// Requires the caller to be an admin of the target band.

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
    const authHeader = req.headers.get('Authorization') ?? ''

    // Admin client — service role key is safe here (server-side only, never sent to browser)
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // User client — used only to verify the caller's identity via their JWT
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user: caller } } = await userClient.auth.getUser()
    if (!caller) return json(req, { error: 'Unauthorized' }, 401)

    const { band_id, email, first_name, last_name, instrument, role = 'member' } = await req.json()
    if (!band_id || !email) return json(req, { error: 'band_id and email are required' }, 400)

    // Verify caller is admin of this band
    const { data: mem } = await admin
      .from('band_members')
      .select('role')
      .eq('band_id', band_id)
      .eq('user_id', caller.id)
      .single()

    if (mem?.role !== 'admin') return json(req, { error: 'Only band admins can invite members' }, 403)

    // Derive redirect URL: APP_URL env var only — do not fall back to request origin (open-redirect risk)
    const appUrl = Deno.env.get('APP_URL') || ''

    // Send invite email — creates the user account and delivers a magic sign-in link.
    // user_metadata is accessible on the client as session.user.user_metadata after they sign in.
    const { data: invData, error: invErr } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: appUrl,
      data: {
        first_name:       first_name || null,
        last_name:        last_name  || null,
        instrument:       instrument || null,
        needs_onboarding: true,
        invited_band_id:  band_id,
      },
    })

    if (invErr) {
      // User already has a confirmed account — admin should use the lookup flow instead
      if (invErr.message?.toLowerCase().includes('already registered') ||
          invErr.message?.toLowerCase().includes('already been registered')) {
        return json(req, {
          error: 'already_registered',
          message: 'This email already has a Bandapp account. Use "Already on Bandapp?" above to find and add them.',
        }, 409)
      }
      return json(req, { error: invErr.message }, 400)
    }

    const uid = invData.user.id

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

    return json(req, { success: true, user_id: uid })

  } catch (e) {
    return json(req, { error: (e as Error).message }, 500)
  }
})
