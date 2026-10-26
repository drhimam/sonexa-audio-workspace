import { generateNumericOtp, generateToken } from '../../lib/crypto';
import { sendZeptoEmail, getPasswordResetEmailHtml } from '../../lib/zeptomail';

export async function onRequestPost(context: { request: Request; env: any }) {
  try {
    const { request, env } = context;
    const { email } = await request.json();

    if (!email) {
      return Response.json({ error: 'Email is required.' }, { status: 400 });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const otp = generateNumericOtp(6);
    const expiresAt = Date.now() + 15 * 60 * 1000;

    let userName = normalizedEmail.split('@')[0];

    if (env.DB) {
      const user = await env.DB.prepare('SELECT id, name FROM users WHERE email = ?').bind(normalizedEmail).first();
      // Even if user does not exist, return generic message for security, but only send email if user exists
      if (user) {
        userName = user.name;
        // Invalidate old reset tokens
        await env.DB.prepare('DELETE FROM auth_tokens WHERE user_id = ? AND type = "password_reset"').bind(user.id).run();

        // Save new reset token
        await env.DB.prepare(
          'INSERT INTO auth_tokens (id, user_id, token, type, expires_at, created_at) VALUES (?, ?, ?, "password_reset", ?, ?)'
        )
          .bind(`tok_${generateToken(12)}`, user.id, otp, expiresAt, Date.now())
          .run();

        // Dispatch email via ZeptoMail
        const htmlBody = getPasswordResetEmailHtml(userName, otp);
        const mailResult = await sendZeptoEmail(env, {
          toEmail: normalizedEmail,
          toName: userName,
          subject: 'Reset your Sonexa password',
          htmlBody,
        });

        if (!mailResult.success) {
          console.error('[ForgotPassword] ZeptoMail dispatch failed:', mailResult.error);
          return Response.json(
            {
              error: `Could not send password reset email: ${mailResult.error || 'ZeptoMail dispatch failed'}. Please check your ZeptoMail configuration.`,
              mailError: mailResult.error,
            },
            { status: 400 }
          );
        }
      }
    }

    return Response.json({
      success: true,
      message: 'If an account exists with this email, password reset instructions have been sent via ZeptoMail.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
