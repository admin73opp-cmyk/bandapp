// Shared email layout for all Ritovo transactional emails.
// Usage: wrap your card body HTML with emailLayout({ appUrl, body, footer })

export function emailLayout(opts: {
  appUrl: string
  body: string       // HTML for the white card content
  footer?: string    // optional extra line below the standard footer
}): string {
  const base = opts.appUrl.replace(/\/$/, '')
  const logoUrl = `${base}/logo/files/ritovo-wordmark-light.svg`

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

        <!-- Logo -->
        <tr>
          <td align="center" style="padding-bottom:24px">
            <!--[if !mso]><!-->
            <img src="${logoUrl}"
                 alt="Ritovo"
                 width="200" height="46"
                 style="display:block;border:0;height:auto;max-width:200px">
            <!--<![endif]-->
            <!--[if mso]>
            <span style="font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:300;letter-spacing:8px;color:#1a1a18">ritovo</span>
            <![endif]-->
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
