// Shared email layout for all Ritovo transactional emails.
// Usage: wrap your card body HTML with emailLayout({ appUrl, body, footer })

export function emailLayout(opts: {
  appUrl: string
  body: string       // HTML for the white card content
  footer?: string    // optional extra line below the standard footer
}): string {
  const base = opts.appUrl.replace(/\/$/, '')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f4f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f8;padding:40px 20px">
  <tr>
    <td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">

        <!-- Logo — pure HTML/CSS so it renders in all email clients without external image requests -->
        <tr>
          <td align="center" style="padding-bottom:28px">
            <table cellpadding="0" cellspacing="0" align="center">
              <tr>
                <!-- Vertical bar + wordmark -->
                <td valign="bottom" style="border-left:1.5px solid #1a1a18;padding:10px 0 8px 14px;font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:300;letter-spacing:9px;color:#1a1a18;line-height:1;white-space:nowrap">
                  ritovo
                </td>
                <!-- Dot above the final o -->
                <td valign="top" style="padding:8px 0 0 2px;line-height:1;font-size:0">
                  <span style="display:inline-block;width:5px;height:5px;background:#1a1a18;border-radius:50%;font-size:0;line-height:0"> </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Card -->
        <tr>
          <td style="background:#ffffff;border-radius:12px;padding:36px 40px;box-shadow:0 2px 8px rgba(0,0,0,0.07)">
            ${opts.body}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td align="center" style="padding-top:24px">
            <p style="margin:0;font-size:12px;color:#aaa">
              © Ritovo · <a href="${base}" style="color:#aaa;text-decoration:none">ritovo.app</a>
            </p>
            ${opts.footer ? `<p style="margin:4px 0 0;font-size:11px;color:#bbb">${opts.footer}</p>` : ''}
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`
}

export const PURPLE = '#6C63FF'

export function btn(label: string, url: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:28px 0">
  <tr>
    <td style="background:${PURPLE};border-radius:8px">
      <a href="${url}" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px">${label}</a>
    </td>
  </tr>
</table>`
}

export function h(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

// One-click RSVP buttons (Yes / No / Maybe) for rehearsal emails.
// Each link hits the SPA /rsvp page with the member's opaque token; the page
// records the response via the submit_rsvp_by_token RPC — no login required.
export function rsvpButtons(appUrl: string, token: string): string {
  const base = appUrl.replace(/\/$/, '')
  const link = (status: string) => `${base}/rsvp?token=${encodeURIComponent(token)}&status=${status}`
  const cell = (label: string, color: string, status: string) =>
    `<td style="padding:0 6px">
      <a href="${link(status)}" style="display:inline-block;padding:12px 22px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;background:${color}">${label}</a>
    </td>`
  return `<p style="margin:0 0 10px;font-size:14px;color:#1a1a2e;font-weight:600">Can you make it?</p>
  <table cellpadding="0" cellspacing="0" style="margin:0 0 24px">
    <tr>
      ${cell('✅ Yes',   '#22A565', 'yes')}
      ${cell('❌ No',    '#E5484D', 'no')}
      ${cell('❓ Maybe', '#8B8B96', 'maybe')}
    </tr>
  </table>`
}
