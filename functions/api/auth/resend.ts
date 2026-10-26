import { generateNumericOtp, generateToken } from '../../lib/crypto';
import { sendZeptoEmail, getVerificationEmailHtml } from '../../lib/zeptomail';

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
      if (!user) {
        return Response.json({ error: 'No account found with this email.' }, { status: 404 });
      }
      userName = user.name;

      // Invalidate previous OTPs
      await env.DB.prepare('DELETE FROM auth_tokens WHERE user_id = ? AND type = "email_verification"').bind(user.id).run();

      // Store new OTP
      await env.DB.prepare(
        'INSERT INTO auth_tokens (id, user_id, token, type, expires_at, created_at) VALUES (?, ?, ?, "email_verification", ?, ?)'
      )
        .bind(`tok_${generateToken(12)}`, user.id, otp, expiresAt, Date.now())
        .run();
    }

    // Send email via ZeptoMail
    const htmlBody = getVerificationEmailHtml(userName, otp);
    await sendZeptoEmail(env, {
      toEmail: normalizedEmail,
      toName: userName,
      subject: 'Your new verification code - Sonexa',
      htmlBody,
    });

    return Response.json({
      success: true,
      message: 'New verification code dispatched via ZeptoMail.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
