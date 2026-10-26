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

    let isNewUser = true;

    // 1. If Cloudflare D1 is bound, save to D1 database
    if (env.DB) {
      // Check if user already exists
      const existing = await env.DB.prepare('SELECT id, email_verified FROM users WHERE email = ?').bind(normalizedEmail).first();
      if (existing) {
        if (existing.email_verified) {
          return Response.json({ error: 'An account with this email already exists and is verified. Please sign in instead.' }, { status: 409 });
        }
        // Account exists but was never verified (e.g. prior ZeptoMail failure or expired code).
        // Update user record and allow re-verification.
        isNewUser = false;
        await env.DB.prepare(
          'UPDATE users SET name = ?, password_hash = ?, salt = ?, updated_at = ? WHERE id = ?'
        )
          .bind(name.trim(), passwordHash, salt, Date.now(), existing.id)
          .run();

        // Invalidate old OTPs
        await env.DB.prepare('DELETE FROM auth_tokens WHERE user_id = ? AND type = "email_verification"').bind(existing.id).run();

        // Store new OTP token
        const tokenId = `tok_${generateToken(12)}`;
        await env.DB.prepare(
          'INSERT INTO auth_tokens (id, user_id, token, type, expires_at, created_at) VALUES (?, ?, ?, "email_verification", ?, ?)'
        )
          .bind(tokenId, existing.id, otp, expiresAt, Date.now())
          .run();
      } else {
        // Insert new user
        await env.DB.prepare(
          'INSERT INTO users (id, email, name, password_hash, salt, email_verified, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)'
        )
          .bind(userId, normalizedEmail, name.trim(), passwordHash, salt, Date.now(), Date.now())
          .run();

        // Store OTP token
        const tokenId = `tok_${generateToken(12)}`;
        await env.DB.prepare(
          'INSERT INTO auth_tokens (id, user_id, token, type, expires_at, created_at) VALUES (?, ?, ?, "email_verification", ?, ?)'
        )
          .bind(tokenId, userId, otp, expiresAt, Date.now())
          .run();
      }
    }

    // 2. Dispatch verification email via ZeptoMail
    const htmlBody = getVerificationEmailHtml(name.trim(), otp);
    const mailResult = await sendZeptoEmail(env, {
      toEmail: normalizedEmail,
      toName: name.trim(),
      subject: 'Verify your Sonexa account',
      htmlBody,
    });

    if (!mailResult.success) {
      console.error('[Signup] ZeptoMail dispatch failed:', mailResult.error);
      // Clean up newly created user if this was a first-time registration attempt
      if (env.DB && isNewUser) {
        await env.DB.prepare('DELETE FROM auth_tokens WHERE user_id = ?').bind(userId).run().catch(() => {});
        await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId).run().catch(() => {});
      }
      return Response.json(
        {
          error: `Could not send verification email: ${mailResult.error || 'ZeptoMail dispatch failed'}. Please check your ZeptoMail configuration.`,
          mailError: mailResult.error,
        },
        { status: 400 }
      );
    }

    return Response.json({
      success: true,
      message: 'Verification code sent via ZeptoMail.',
      emailSent: true,
      requiresVerification: true,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
