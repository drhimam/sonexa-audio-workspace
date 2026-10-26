import { verifyPassword, generateToken } from '../../lib/crypto';

export async function onRequestPost(context: { request: Request; env: any }) {
  try {
    const { request, env } = context;
    const { email, password } = await request.json();

    if (!email || !password) {
      return Response.json({ error: 'Email and password are required.' }, { status: 400 });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    if (env.DB) {
      const user = await env.DB.prepare(
        'SELECT id, name, email, password_hash, salt, email_verified, created_at FROM users WHERE email = ?'
      )
        .bind(normalizedEmail)
        .first();

      if (!user) {
        return Response.json({ error: 'Invalid email or password.' }, { status: 401 });
      }

      const isValid = await verifyPassword(password, user.salt, user.password_hash);
      if (!isValid) {
        return Response.json({ error: 'Invalid email or password.' }, { status: 401 });
      }

      if (!user.email_verified) {
        return Response.json({
          error: 'Please verify your email address to sign in.',
          requiresVerification: true,
          email: user.email,
        }, { status: 403 });
      }

      // Generate session token
      const sessionToken = `sess_${generateToken(24)}`;
      const sessionExpiry = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
      await env.DB.prepare(
        'INSERT INTO auth_tokens (id, user_id, token, type, expires_at, created_at) VALUES (?, ?, ?, "session", ?, ?)'
      )
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
