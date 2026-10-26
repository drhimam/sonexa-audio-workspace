import { generateSalt, hashPassword, generateNumericOtp, generateToken } from '../../lib/crypto';
import { sendZeptoEmail, getVerificationEmailHtml } from '../../lib/zeptomail';

export async function onRequestPost(context: { request: Request; env: any }) {
  try {
    const { request, env } = context;
    const { name, email, password } = await request.json();

    if (!name || !email || !password) {
      return Response.json({ error: 'Name, email, and password are required.' }, { status: 400 });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const userId = `usr_${generateToken(12)}`;
    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt);
    const otp = generateNumericOtp(6);
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 mins

    // 1. If Cloudflare D1 is bound, save to D1 database
    if (env.DB) {
      // Check if user already exists
      const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(normalizedEmail).first();
      if (existing) {
        return Response.json({ error: 'An account with this email already exists.' }, { status: 409 });
      }

      // Insert new user
      await env.DB.prepare(
        'INSERT INTO users (id, email, name, password_hash, salt, email_verified, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)'
      )
        .bind(userId, normalizedEmail, name.trim(), passwordHash, salt, Date.now(), Date.now())
        .run();

      // Store OTP token
      const tokenId = `tok_${generateToken(12)}`;
      await env.DB.prepare(
        'INSERT INTO auth_tokens (id, user_id, token, type, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      )
        .bind(tokenId, userId, otp, 'email_verification', expiresAt, Date.now())
        .run();
    }

    // 2. Dispatch verification email via ZeptoMail
    const htmlBody = getVerificationEmailHtml(name.trim(), otp);
    const mailResult = await sendZeptoEmail(env, {
      toEmail: normalizedEmail,
      toName: name.trim(),
      subject: 'Verify your Sonexa account',
      htmlBody,
    });

    return Response.json({
      success: true,
      message: 'Verification code sent via ZeptoMail.',
      emailSent: mailResult.success,
      requiresVerification: true,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
