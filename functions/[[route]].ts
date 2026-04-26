import app from '../src/worker/index';

export const onRequest: PagesFunction<{ ASSETS: Fetcher }> = async (context) => {
  const response = await app.fetch(context.request, context.env as never, context.waitUntil.bind(context));

  if (response.status === 404) {
    const indexUrl = new URL('/index.html', context.request.url);
    return context.env.ASSETS.fetch(new Request(indexUrl));
  }

  return response;
};
