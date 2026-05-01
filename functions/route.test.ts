import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onRequest } from './[[route]]';

vi.mock('../src/worker/index', () => ({
  default: {
    fetch: vi.fn().mockResolvedValue(new Response('api response', { status: 200 })),
  },
}));

function makeContext(url: string, assetsFetch: ReturnType<typeof vi.fn>) {
  return {
    request: new Request(url),
    env: { ASSETS: { fetch: assetsFetch } },
    waitUntil: vi.fn(),
    params: {},
    data: {},
  } as unknown as Parameters<typeof onRequest>[0];
}

describe('onRequest — /assets/*', () => {
  beforeEach(() => vi.clearAllMocks());

  it('devuelve el asset cuando existe', async () => {
    const assetsFetch = vi.fn().mockResolvedValue(new Response('js bundle', { status: 200 }));
    const res = await onRequest(makeContext('https://lahoja.org/assets/index-BFSxencr.js', assetsFetch));

    expect(res.status).toBe(200);
    expect(await res.text()).toBe('js bundle');
    expect(assetsFetch).toHaveBeenCalledTimes(1);
  });

  it('devuelve 404 text/plain con Cache-Control: no-store cuando el asset no existe', async () => {
    const assetsFetch = vi.fn().mockResolvedValue(new Response('', { status: 404 }));
    const res = await onRequest(makeContext('https://lahoja.org/assets/index-BFSxencr.js', assetsFetch));

    expect(res.status).toBe(404);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.text()).toBe('Not found');
  });

  it('devuelve 404 con no-store para cualquier respuesta non-ok (ej. 500)', async () => {
    const assetsFetch = vi.fn().mockResolvedValue(new Response('', { status: 500 }));
    const res = await onRequest(makeContext('https://lahoja.org/assets/app.css', assetsFetch));

    expect(res.status).toBe(404);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('nunca hace fallback a index.html para assets faltantes', async () => {
    const assetsFetch = vi.fn().mockResolvedValue(new Response('', { status: 404 }));
    await onRequest(makeContext('https://lahoja.org/assets/index-BFSxencr.js', assetsFetch));

    expect(assetsFetch).toHaveBeenCalledTimes(1);
  });
});

describe('onRequest — SPA routing (rutas no-asset)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('devuelve el recurso estático cuando existe', async () => {
    const assetsFetch = vi.fn().mockResolvedValue(new Response('<html/>', { status: 200 }));
    const res = await onRequest(makeContext('https://lahoja.org/favicon.ico', assetsFetch));

    expect(res.status).toBe(200);
    expect(assetsFetch).toHaveBeenCalledTimes(1);
  });

  it('hace fallback a index.html para rutas SPA desconocidas', async () => {
    const indexHtml = new Response('<html>app</html>', { status: 200 });
    const assetsFetch = vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 404 }))
      .mockResolvedValueOnce(indexHtml);

    const res = await onRequest(makeContext('https://lahoja.org/dashboard/empleados', assetsFetch));

    expect(res.status).toBe(200);
    expect(assetsFetch).toHaveBeenCalledTimes(2);
    const fallbackRequest = assetsFetch.mock.calls[1][0] as Request;
    expect(new URL(fallbackRequest.url).pathname).toBe('/index.html');
  });
});

describe('onRequest — /api/*', () => {
  beforeEach(() => vi.clearAllMocks());

  it('delega al Hono worker sin tocar ASSETS', async () => {
    const { default: app } = await import('../src/worker/index');
    const assetsFetch = vi.fn();
    const res = await onRequest(makeContext('https://lahoja.org/api/employees', assetsFetch));

    expect(app.fetch).toHaveBeenCalledTimes(1);
    expect(assetsFetch).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
  });
});
