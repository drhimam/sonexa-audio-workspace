import { authenticateRequest } from '../../lib/crypto';

export async function onRequestGet(context: { request: Request; env: any }) {
  try {
    const { request, env } = context;

    const auth = await authenticateRequest(request, env);
    if (!auth) {
      return Response.json({ error: 'Unauthorized: invalid or expired session.' }, { status: 401 });
    }

    const userId = auth.userId;
    const url = new URL(request.url);
    const since = parseInt(url.searchParams.get('since') || '0', 10);

    if (env.DB) {

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
        } catch {
          // ignore invalid json
        }
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
