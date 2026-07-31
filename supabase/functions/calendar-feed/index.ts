import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Public, unauthenticated endpoint — deploy with `--no-verify-jwt`.
// Security is the unguessable per-band token in the query string.
// Serves a universal iCalendar (.ics) feed that Google Calendar, Apple
// Calendar, Outlook, etc. can subscribe to by URL.

function corsHeaders(req: Request) {
  return {
    'Access-Control-Allow-Origin': req.headers.get('origin') || '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}

const pad = (n: number) => String(n).padStart(2, '0')
const timeRe = /^(\d{1,2}):(\d{2})$/

// RFC 5545 text escaping
function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

// Fold long property lines at 73 octets (RFC 5545 §3.1)
function fold(line: string): string {
  if (line.length <= 73) return line
  const out: string[] = []
  let s = line
  while (s.length > 73) {
    out.push(s.slice(0, 73))
    s = ' ' + s.slice(73)
  }
  out.push(s)
  return out.join('\r\n')
}

// Times are stored as the band's local wall-clock time. Floating ICS times
// (no Z, no TZID) are NOT portable: Google Calendar interprets them as UTC in
// subscribed feeds, shifting every event by the local UTC offset. So we
// convert wall-clock time in the band's IANA timezone to a real UTC instant
// and emit "YYYYMMDDTHHMMSSZ", which every client handles identically.
const FEED_TZ = Deno.env.get('CALENDAR_FEED_TZ') || 'Europe/Brussels'

// Minutes the zone is ahead of UTC at the given instant (DST-aware via Intl).
function tzOffsetMinutes(tz: string, at: Date): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(at).map((p) => [p.type, p.value]),
  )
  const asUTC = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute, +parts.second)
  return Math.round((asUTC - at.getTime()) / 60000)
}

// Wall-clock "YYYY-MM-DD" + "HH:MM" in tz → UTC Date. Two-pass so DST
// transitions on the event day resolve to the correct offset. An "24:00"
// end time rolls naturally into 00:00 the next day via Date.UTC.
function zonedToUTC(dateStr: string, timeStr: string, tz: string): Date | null {
  const m = timeStr.match(timeRe)
  if (!m) return null
  const [y, mo, d] = dateStr.split('-').map(Number)
  const naive = Date.UTC(y, mo - 1, d, +m[1], +m[2])
  let guess = new Date(naive - tzOffsetMinutes(tz, new Date(naive)) * 60000)
  const off = tzOffsetMinutes(tz, guess)
  if (naive - off * 60000 !== guess.getTime()) guess = new Date(naive - off * 60000)
  return guess
}

function utcStamp(dt: Date): string {
  return `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}T${pad(dt.getUTCHours())}${pad(dt.getUTCMinutes())}00Z`
}

// "YYYY-MM-DD" + "HH:MM" in the band's zone → "YYYYMMDDTHHMM00Z" (UTC).
function floatingDT(dateStr: string, timeStr: string): string | null {
  const dt = zonedToUTC(dateStr, timeStr, FEED_TZ)
  return dt ? utcStamp(dt) : null
}

// Add minutes to a zoned date/time, returning "YYYYMMDDTHHMM00Z" (UTC).
function addMinutes(dateStr: string, timeStr: string, mins: number): string | null {
  const dt = zonedToUTC(dateStr, timeStr, FEED_TZ)
  return dt ? utcStamp(new Date(dt.getTime() + mins * 60000)) : null
}

// All-day fallback: DTEND is exclusive, so add one day.
function dateOnly(dateStr: string, addDays = 0): string {
  const [y, mo, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, mo - 1, d + addDays))
  return `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}`
}

function nowStamp(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
}

interface VEvent {
  uid: string
  start: string        // floating datetime or date
  end: string
  allDay: boolean
  summary: string
  location?: string
  description?: string
  cancelled: boolean
}

function renderEvent(e: VEvent, stamp: string): string {
  const lines = ['BEGIN:VEVENT', `UID:${e.uid}`, `DTSTAMP:${stamp}`]
  if (e.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${e.start}`, `DTEND;VALUE=DATE:${e.end}`)
  } else {
    lines.push(`DTSTART:${e.start}`, `DTEND:${e.end}`)
  }
  lines.push(`SUMMARY:${esc(e.summary)}`)
  if (e.location) lines.push(`LOCATION:${esc(e.location)}`)
  if (e.description) lines.push(`DESCRIPTION:${esc(e.description)}`)
  lines.push(`STATUS:${e.cancelled ? 'CANCELLED' : 'CONFIRMED'}`)
  if (e.cancelled) lines.push('TRANSP:TRANSPARENT')
  lines.push('END:VEVENT')
  return lines.map(fold).join('\r\n')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders(req) })
  }

  try {
    const url = new URL(req.url)
    const token = url.searchParams.get('token')
    if (!token) return new Response('Missing token', { status: 400, headers: corsHeaders(req) })

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    const { data: feed } = await admin
      .from('band_calendar_feeds')
      .select('band_id')
      .eq('token', token)
      .maybeSingle()

    if (!feed) return new Response('Not found', { status: 404, headers: corsHeaders(req) })
    const bandId = feed.band_id

    const [{ data: band }, { data: concerts }, { data: rehearsals }] = await Promise.all([
      admin.from('bands').select('name').eq('id', bandId).maybeSingle(),
      admin.from('concerts').select('*').eq('band_id', bandId),
      admin.from('rehearsals').select('*').eq('band_id', bandId),
    ])

    const bandName = band?.name || 'Ritovo'
    const stamp = nowStamp()
    const events: VEvent[] = []

    for (const c of concerts || []) {
      if (!c.date) continue
      const start = floatingDT(c.date, c.time || '')
      const dur = Number(c.duration) > 0 ? Number(c.duration) : 120 // minutes
      const allDay = !start
      events.push({
        uid: `concert-${c.id}@ritovo.app`,
        start: allDay ? dateOnly(c.date) : start!,
        end: allDay ? dateOnly(c.date, 1) : (addMinutes(c.date, c.time, dur) || start!),
        allDay,
        summary: c.title || 'Concert',
        location: c.address || c.venue || undefined,
        description: c.notes || undefined,
        cancelled: !!c.cancelled,
      })
    }

    for (const r of rehearsals || []) {
      if (!r.date) continue
      const start = floatingDT(r.date, r.start_time || '')
      const allDay = !start
      let end = allDay ? dateOnly(r.date, 1) : null
      if (!allDay) {
        end = (r.end_time && floatingDT(r.date, r.end_time)) || addMinutes(r.date, r.start_time, 120) || start!
        // guard against an end at/before start (e.g. blank or malformed end_time)
        if (end <= start!) end = addMinutes(r.date, r.start_time, 120) || start!
      }
      events.push({
        uid: `rehearsal-${r.id}@ritovo.app`,
        start: allDay ? dateOnly(r.date) : start!,
        end: end!,
        allDay,
        summary: r.title ? `🎵 ${r.title}` : '🎵 Rehearsal',
        location: r.location || undefined,
        description: r.notes || undefined,
        cancelled: !!r.cancelled,
      })
    }

    const cal = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Ritovo//Calendar Feed//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      fold(`X-WR-CALNAME:${esc(bandName)} · Ritovo`),
      fold(`NAME:${esc(bandName)} · Ritovo`),
      'X-PUBLISHED-TTL:PT6H',
      'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
      ...events.map((e) => renderEvent(e, stamp)),
      'END:VCALENDAR',
    ].join('\r\n')

    return new Response(cal, {
      status: 200,
      headers: {
        ...corsHeaders(req),
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="ritovo.ics"',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (err) {
    console.error('[calendar-feed]', err)
    return new Response('Internal error', { status: 500, headers: corsHeaders(req) })
  }
})
