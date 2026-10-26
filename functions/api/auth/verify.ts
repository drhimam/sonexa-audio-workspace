import { generateToken } from '../../lib/crypto';

export async function onRequestPost(context: { request: Request; env: any }) {
  try {
    const { request, env } = context;
    const { email, code } = await request.json();

    if (!email || !code) {
      return Response.json({ error: 'Email and verification code are required.' }, { status: 400 });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    if (env.DB) {
      // Find user
      const user = await env.DB.prepare('SELECT id, name, email, email_verified, created_at FROM users WHERE email = ?')
        .bind(normalizedEmail)
        .first();

      if (!user) {
        return Response.json({ error: 'User account not found.' }, { status: 404 });
      }

      // Check OTP in auth_tokens
      const tokenRecord = await env.DB.prepare(
        'SELECT id, expires_at FROM auth_tokens WHERE user_id = ? AND token = ? AND type = "email_verification" ORDER BY created_at DESC'
      )
        .bind(user.id, String(code).trim())
        .first();

      if (!tokenRecord) {
        return Response.json({ error: 'Invalid verification code.' }, { status: 400 });
      }

      if (Date.now() > tokenRecord.expires_at) {
        return Response.json({ error: 'Verification code has expired. Please request a new one.' }, { status: 400 });
      }

      // Mark user verified
      await env.DB.prepare('UPDATE users SET email_verified = 1, updated_at = ? WHERE id = ?')
        .bind(Date.now(), user.id)
        .run();

      // Delete used token
      await env.DB.prepare('DELETE FROM auth_tokens WHERE id = ?').bind(tokenRecord.id).run();

      // Issue session token
      const sessionToken = `sess_${generateToken(24)}`;
      const sessionExpiry = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
      await env.DB.prepare('INSERT INTO auth_tokens (id, user_id, token, type, expires_at, created_at) VALUES (?, ?, ?, "session", ?, ?)')
        .bind(`tok_${generateToken(12)}`, user.id, sessionToken, sessionExpiry, Date.now())
        .run();

      return Response.json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          emailVerified: true,
          createdAt: user.created_at,
        },
        token: sessionToken,
      });
    }

    // Fallback simulation mode
    return Response.json({
      success: true,
      user: {
        id: `usr_${Date.now()}`,
        name: normalizedEmail.split('@')[0],
        email: normalizedEmail,
        emailVerified: true,
        createdAt: Date.now(),
      },
      token: `sim_token_${Date.now()}`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
