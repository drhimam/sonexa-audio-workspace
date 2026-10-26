export async function onRequestGet(context: { request: Request; env: any }) {
  const { env } = context;

  const apiKey = env.ZEPTOMAIL_API_KEY;
  const hasKey = typeof apiKey === 'string' && apiKey.trim().length > 0;
  const keyPreview = hasKey ? `${apiKey.trim().slice(0, 16)}...` : null;

  return Response.json({
    status: 'ok',
    timestamp: Date.now(),
    d1DatabaseBound: !!env.DB,
    zeptomail: {
      isApiKeySet: hasKey,
      apiKeyPreview: keyPreview,
      fromAddress: env.ZEPTOMAIL_FROM_ADDRESS || 'noreply@sonexa.app (default)',
      fromName: env.ZEPTOMAIL_FROM_NAME || 'Sonexa Audio Workspace (default)',
      endpoint: env.ZEPTOMAIL_ENDPOINT || 'https://api.zeptomail.com/v1.1/email (default)',
      customBounceAddressSet: !!env.ZEPTOMAIL_BOUNCE_ADDRESS,
    },
  });
}
