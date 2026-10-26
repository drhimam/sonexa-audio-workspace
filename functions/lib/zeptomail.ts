// ZeptoMail Transactional Email Dispatcher for Cloudflare Workers / Pages Functions
// Documentation: https://www.zoho.com/zeptomail/help/api/email-sending.html

export interface ZeptoMailOptions {
  toEmail: string;
  toName?: string;
  subject: string;
  htmlBody: string;
}

export interface ZeptoMailEnv {
  ZEPTOMAIL_API_KEY?: string;
  ZEPTOMAIL_FROM_ADDRESS?: string;
  ZEPTOMAIL_FROM_NAME?: string;
  ZEPTOMAIL_ENDPOINT?: string;
  ZEPTOMAIL_BOUNCE_ADDRESS?: string;
}

export async function sendZeptoEmail(
  env: ZeptoMailEnv,
  options: ZeptoMailOptions
): Promise<{ success: boolean; data?: any; error?: string }> {
  const apiKey = env.ZEPTOMAIL_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    const msg = 'ZEPTOMAIL_API_KEY secret is missing in Cloudflare environment.';
    console.error(`[ZeptoMail] ${msg}`);
    return {
      success: false,
      error: msg,
    };
  }

  // 1. Sanitize and format the Authorization header
  // ZeptoMail Send Mail Token requires: "Zoho-enczapikey <TOKEN>"
  let cleanKey = apiKey.trim().replace(/^["']|["']$/g, '').trim();
  cleanKey = cleanKey.replace(/^Zoho-enczapikey[:\s]+/i, '').trim();
  const authHeader = `Zoho-enczapikey ${cleanKey}`;

  // 2. Normalize ZeptoMail REST API endpoint (support regional domains e.g. .com, .ca, .eu, .in)
  let endpoint = (env.ZEPTOMAIL_ENDPOINT || 'https://api.zeptomail.com/v1.1/email').trim().replace(/^["']|["']$/g, '');
  if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
    endpoint = `https://${endpoint}`;
  }
  if (!endpoint.includes('/v1.1/email')) {
    endpoint = endpoint.replace(/\/+$/, '') + '/v1.1/email';
  }

  // 3. Sender configuration
  const fromAddress = (env.ZEPTOMAIL_FROM_ADDRESS || 'noreply@sonexa.app').trim().replace(/^["']|["']$/g, '');
  const fromName = (env.ZEPTOMAIL_FROM_NAME || 'Sonexa Audio Workspace').trim().replace(/^["']|["']$/g, '');

  // 4. Construct payload
  // CRITICAL: bounce_address is strictly optional in ZeptoMail Send Mail API.
  // If bounce_address is provided with an unverified or regular sender address,
  // ZeptoMail rejects the request with HTTP 400 (TM_3304: Invalid bounce address).
  // Only include bounce_address if explicitly defined as a dedicated bounce subdomain.
  const payload: Record<string, unknown> = {
    from: {
      address: fromAddress,
      name: fromName,
    },
    to: [
      {
        email_address: {
          address: options.toEmail.trim(),
          name: (options.toName || options.toEmail.split('@')[0]).trim(),
        },
      },
    ],
    subject: options.subject,
    htmlbody: options.htmlBody,
  };

  if (env.ZEPTOMAIL_BOUNCE_ADDRESS && env.ZEPTOMAIL_BOUNCE_ADDRESS.trim()) {
    payload.bounce_address = env.ZEPTOMAIL_BOUNCE_ADDRESS.trim().replace(/^["']|["']$/g, '');
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify(payload),
    });

    const rawText = await response.text();
    let data: any = null;
    try {
      data = JSON.parse(rawText);
    } catch {
      data = null;
    }

    if (!response.ok) {
      console.error('[ZeptoMail] Send error:', response.status, rawText);
      let errorMsg = `ZeptoMail HTTP ${response.status}`;
      if (data?.error?.message) {
        errorMsg = `${data.error.code ? `[${data.error.code}] ` : ''}${data.error.message}`;
        if (Array.isArray(data?.error?.details) && data.error.details.length > 0) {
          const detailsStr = data.error.details
            .map((d: any) => `${d.target || ''}: ${d.message || JSON.stringify(d)}`)
            .join('; ');
          errorMsg += ` (${detailsStr})`;
        }
      } else if (data?.message) {
        errorMsg = data.message;
      } else if (rawText) {
        errorMsg += `: ${rawText.slice(0, 300)}`;
      }

      return {
        success: false,
        error: errorMsg,
        data,
      };
    }

    return { success: true, data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[ZeptoMail] Network exception:', message);
    return { success: false, error: `ZeptoMail network error: ${message}` };
  }
}

// ---- Clean HTML Email Templates --------------------------------------------

export function getVerificationEmailHtml(name: string, otpCode: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Verify your Sonexa account</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f7f8fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #111827;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="540" style="max-width: 540px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.04);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 20px; background: linear-gradient(135deg, #10a37f, #0c8c6d); text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">Sonexa Audio Workspace</h1>
              <p style="color: rgba(255,255,255,0.85); margin: 6px 0 0; font-size: 13px;">Local-First Audio Intelligence & Cloud Sync</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 32px 32px 24px;">
              <h2 style="font-size: 18px; margin: 0 0 12px; color: #111827;">Hello ${name},</h2>
              <p style="font-size: 14px; line-height: 1.6; color: #4b5563; margin: 0 0 24px;">
                Thank you for creating your Sonexa account. To verify your email address and activate Cloudflare multi-device synchronization, please use the 6-digit confirmation code below:
              </p>
              
              <!-- OTP Box -->
              <div style="background: #f1f3f6; border: 1px solid #d1d5db; border-radius: 12px; padding: 18px; text-align: center; margin: 0 0 24px;">
                <div style="font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #10a37f;">
                  ${otpCode}
                </div>
                <div style="font-size: 11px; color: #9ca3af; margin-top: 6px;">
                  This code expires in 15 minutes.
                </div>
              </div>

              <p style="font-size: 13px; line-height: 1.5; color: #6b7280; margin: 0;">
                If you did not request this account creation, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background: #f9fafb; border-top: 1px solid #f3f4f6; text-align: center; font-size: 11px; color: #9ca3af;">
              Sent securely via ZeptoMail Transactional Engine · Sonexa
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

export function getPasswordResetEmailHtml(name: string, otpCode: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Reset your Sonexa password</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f7f8fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #111827;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="540" style="max-width: 540px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.04);">
          <tr>
            <td style="padding: 32px 32px 20px; background: linear-gradient(135deg, #10a37f, #0c8c6d); text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Sonexa Audio Workspace</h1>
              <p style="color: rgba(255,255,255,0.85); margin: 6px 0 0; font-size: 13px;">Security & Password Recovery</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 32px 24px;">
              <h2 style="font-size: 18px; margin: 0 0 12px; color: #111827;">Password Reset Request</h2>
              <p style="font-size: 14px; line-height: 1.6; color: #4b5563; margin: 0 0 24px;">
                We received a request to reset your password for your Sonexa account. Use the following code to proceed:
              </p>
              
              <div style="background: #f1f3f6; border: 1px solid #d1d5db; border-radius: 12px; padding: 18px; text-align: center; margin: 0 0 24px;">
                <div style="font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #10a37f;">
                  ${otpCode}
                </div>
                <div style="font-size: 11px; color: #9ca3af; margin-top: 6px;">
                  Expires in 15 minutes.
                </div>
              </div>

              <p style="font-size: 13px; line-height: 1.5; color: #ef4444; margin: 0 0 8px;">
                <strong>Security Notice:</strong> If you did not initiate this request, your account may be compromised. Please change your password immediately.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 32px; background: #f9fafb; border-top: 1px solid #f3f4f6; text-align: center; font-size: 11px; color: #9ca3af;">
              Sent securely via ZeptoMail Transactional Engine · Sonexa
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}
