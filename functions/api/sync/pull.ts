export async function onRequestGet(context: { request: Request; env: any }) {
  try {
    const { request, env } = context;
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
      return Response.json({ error: 'Unauthorized: missing session token.' }, { status: 401 });
    }

    const url = new URL(request.url);
    const since = parseInt(url.searchParams.get('since') || '0', 10);

    if (env.DB) {
      // Find session user
      const tokenRecord = await env.DB.prepare(
        'SELECT user_id, expires_at FROM auth_tokens WHERE token = ? AND type = "session"'
      )
        .bind(token)
        .first();

      if (!tokenRecord || Date.now() > tokenRecord.expires_at) {
        return Response.json({ error: 'Unauthorized: invalid or expired session.' }, { status: 401 });
      }

      const userId = tokenRecord.user_id;

      // Pull folders updated after timestamp
      const foldersResult = await env.DB.prepare(
        'SELECT id, name, created_at, updated_at FROM folders WHERE user_id = ? AND updated_at > ? AND deleted = 0 ORDER BY updated_at ASC'
      )
        .bind(userId, since)
        .all();

      // Pull sessions updated after timestamp
      const sessionsResult = await env.DB.prepare(
        'SELECT id, folder_id, title, status, data_json, created_at, updated_at FROM sessions WHERE user_id = ? AND updated_at > ? AND deleted = 0 ORDER BY updated_at ASC'
      )
        .bind(userId, since)
        .all();

      const folders = (foldersResult.results || []).map((f: any) => ({
        id: f.id,
        name: f.name,
        createdAt: f.created_at,
        updatedAt: f.updated_at,
      }));

      const sessions = (sessionsResult.results || []).map((s: any) => {
        let parsedData = {};
        try {
          parsedData = JSON.parse(s.data_json);
        } catch {}
        return {
          id: s.id,
          folderId: s.folder_id,
          title: s.title,
          status: s.status,
          createdAt: s.created_at,
          updatedAt: s.updated_at,
          ...parsedData,
        };
      });

      return Response.json({ folders, sessions, timestamp: Date.now() });
    }

    return Response.json({ folders: [], sessions: [], timestamp: Date.now() });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
