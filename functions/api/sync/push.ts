export async function onRequestPost(context: { request: Request; env: any }) {
  try {
    const { request, env } = context;
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
      return Response.json({ error: 'Unauthorized: missing session token.' }, { status: 401 });
    }

    const body = await request.json();
    const sessions = body.sessions || [];
    const folders = body.folders || [];

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

      // Upsert Folders
      for (const f of folders) {
        await env.DB.prepare(
          `INSERT INTO folders (id, user_id, name, created_at, updated_at, deleted)
           VALUES (?, ?, ?, ?, ?, 0)
           ON CONFLICT(user_id, id) DO UPDATE SET
             name = excluded.name,
             updated_at = excluded.updated_at`
        )
          .bind(f.id, userId, f.name, f.createdAt || Date.now(), f.updatedAt || Date.now())
          .run();
      }

      // Upsert Sessions
      for (const s of sessions) {
        const { id, folderId, title, status, createdAt, updatedAt, ...rest } = s;
        const dataJson = JSON.stringify(rest);

        await env.DB.prepare(
          `INSERT INTO sessions (id, user_id, folder_id, title, status, data_json, created_at, updated_at, deleted)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
           ON CONFLICT(user_id, id) DO UPDATE SET
             folder_id = excluded.folder_id,
             title = excluded.title,
             status = excluded.status,
             data_json = excluded.data_json,
             updated_at = excluded.updated_at`
        )
          .bind(
            id,
            userId,
            folderId || null,
            title || 'Untitled Session',
            status || 'recorded',
            dataJson,
            createdAt || Date.now(),
            updatedAt || Date.now()
          )
          .run();
      }

      return Response.json({
        success: true,
        pushedFolders: folders.length,
        pushedSessions: sessions.length,
        timestamp: Date.now(),
      });
    }

    return Response.json({
      success: true,
      pushedFolders: folders.length,
      pushedSessions: sessions.length,
      timestamp: Date.now(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
