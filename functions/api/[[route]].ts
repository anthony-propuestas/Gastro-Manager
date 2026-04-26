import app from '../../src/worker/index';

export const onRequest: PagesFunction = async (context) => {
  return app.fetch(context.request, context.env as never, context.waitUntil.bind(context));
};
