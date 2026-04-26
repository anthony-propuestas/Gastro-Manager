import app from '../src/worker/index';

export const onRequest: PagesFunction<{ ASSETS: Fetcher }> = async (context) => {
  const url = new URL(context.request.url);

  if (url.pathname.startsWith('/api/')) {
    return app.fetch(context.request, context.env as never, context.waitUntil.bind(context));
  }

  // Serve the static asset if it exists, otherwise serve index.html for SPA routing
  const assetResponse = await context.env.ASSETS.fetch(context.request);
  if (assetResponse.status === 404) {
    return context.env.ASSETS.fetch(new Request(new URL('/index.html', context.request.url)));
  }
  return assetResponse;
};
