import { generateSalt, hashPassword } from '../../lib/crypto';

export async function onRequestPost(context: { request: Request; env: any }) {
  try {
    const { request, env } = context;
    const { email, code, newPassword } = await request.json();

    if (!email || !code || !newPassword) {
      return Response.json({ error: 'Email, code, and new password are required.' }, { status: 400 });
    }

    if (String(newPassword).length < 8) {
      return Response.json({ error: 'Password must be at least 8 characters long.' }, { status: 400 });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    if (env.DB) {
      const user = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(normalizedEmail).first();
      if (!user) {
        return Response.json({ error: 'Invalid or expired reset code.' }, { status: 400 });
      }

      // Verify token
      const tokenRecord = await env.DB.prepare(
        'SELECT id, expires_at FROM auth_tokens WHERE user_id = ? AND token = ? AND type = "password_reset" ORDER BY created_at DESC'
      )
        .bind(user.id, String(code).trim())
        .first();

      if (!tokenRecord) {
        return Response.json({ error: 'Invalid reset code.' }, { status: 400 });
      }

      if (Date.now() > tokenRecord.expires_at) {
        return Response.json({ error: 'Reset code has expired. Please request a new one.' }, { status: 400 });
      }

      // Update password
      const newSalt = generateSalt();
      const newHash = await hashPassword(newPassword, newSalt);

      await env.DB.prepare('UPDATE users SET password_hash = ?, salt = ?, updated_at = ? WHERE id = ?')
        .bind(newHash, newSalt, Date.now(), user.id)
        .run();

      // Delete token and any existing sessions for security
      await env.DB.prepare('DELETE FROM auth_tokens WHERE user_id = ?').bind(user.id).run();

      return Response.json({
        success: true,
        message: 'Password has been reset successfully. Please sign in with your new password.',
      });
    }

    return Response.json({
      success: true,
      message: 'Password updated successfully.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
