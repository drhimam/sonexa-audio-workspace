import { authenticateRequest } from '../../lib/crypto';

export async function onRequestPost(context: { request: Request; env: any }) {
  try {
    const { request, env } = context;

    const auth = await authenticateRequest(request, env);
    if (!auth) {
      return Response.json({ error: 'Unauthorized: invalid or expired session.' }, { status: 401 });
    }

    const userId = auth.userId;
    const body = await request.json();
    const sessions = body.sessions || [];
    const folders = body.folders || [];

    // Early exit if nothing to push (0 D1 operations)
    if (sessions.length === 0 && folders.length === 0) {
      return Response.json({
        success: true,
        pushedFolders: 0,
        pushedSessions: 0,
        timestamp: Date.now(),
      });
    }

    if (env.DB) {
      const statements: any[] = [];

      // Batch Upsert Folders
      for (const f of folders) {
        statements.push(
          env.DB.prepare(
            `INSERT INTO folders (id, user_id, name, created_at, updated_at, deleted)
             VALUES (?, ?, ?, ?, ?, 0)
             ON CONFLICT(user_id, id) DO UPDATE SET
               name = excluded.name,
               updated_at = excluded.updated_at`
          ).bind(f.id, userId, f.name, f.createdAt || Date.now(), f.updatedAt || Date.now())
        );
      }

      // Batch Upsert Sessions
      for (const s of sessions) {
        const { id, folderId, title, status, createdAt, updatedAt, ...rest } = s;
        const dataJson = JSON.stringify(rest);

        statements.push(
          env.DB.prepare(
            `INSERT INTO sessions (id, user_id, folder_id, title, status, data_json, created_at, updated_at, deleted)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
             ON CONFLICT(user_id, id) DO UPDATE SET
               folder_id = excluded.folder_id,
               title = excluded.title,
               status = excluded.status,
               data_json = excluded.data_json,
               updated_at = excluded.updated_at`
          ).bind(
            id,
            userId,
            folderId || null,
            title || 'Untitled Session',
            status || 'recorded',
            dataJson,
            createdAt || Date.now(),
            updatedAt || Date.now()
          )
        );
      }

      if (statements.length > 0) {
        await env.DB.batch(statements);
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
