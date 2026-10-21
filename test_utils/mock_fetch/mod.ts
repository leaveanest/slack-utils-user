/**
 * Minimal in-repo replacement for https://deno.land/x/mock_fetch@0.3.0.
 *
 * The upstream module imports https://crux.land/router@0.0.5, which no longer
 * resolves, so tests could not load. Only the API used by our tests is kept:
 * `install`, `mock("METHOD@/path", handler)` and `reset`.
 */
type Handler = () => Response | Promise<Response>;

const routes = new Map<string, Handler>();
const originalFetch = globalThis.fetch;

function routeKey(input: string | URL | Request, init?: RequestInit): string {
  const request = input instanceof Request ? input : undefined;
  const url = new URL(request ? request.url : input.toString());
  const method = (init?.method ?? request?.method ?? "GET").toUpperCase();
  return `${method}@${url.pathname}`;
}

export function mock(route: string, handler: Handler): void {
  routes.set(route, handler);
}

export function reset(): void {
  routes.clear();
}

export function install(): void {
  globalThis.fetch = (input, init) => {
    const key = routeKey(input, init);
    const handler = routes.get(key);
    if (!handler) {
      return Promise.reject(new Error(`No mock registered for ${key}`));
    }
    return Promise.resolve(handler());
  };
}

export function uninstall(): void {
  globalThis.fetch = originalFetch;
}
