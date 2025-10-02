import { Route, Request, Response } from '../types';

export class Router {
  private routes: Route[] = [];

  private addRoute(method: string, path: string, handler: (req: Request, res: Response) => void) {
    this.routes.push({ method, path, handler });
  }

  get(path: string, handler: (req: Request, res: Response) => void) {
    this.addRoute('GET', path, handler);
  }

  post(path: string, handler: (req: Request, res: Response) => void) {
    this.addRoute('POST', path, handler);
  }

  put(path: string, handler: (req: Request, res: Response) => void) {
    this.addRoute('PUT', path, handler);
  }

  delete(path: string, handler: (req: Request, res: Response) => void) {
    this.addRoute('DELETE', path, handler);
  }

  private matchRoute(method: string, path: string): { route: Route; params: Record<string, string> } | null {
    for (const route of this.routes) {
      if (route.method !== method) continue;

      const routeParts = route.path.split('/').filter(Boolean);
      const pathParts = path.split('/').filter(Boolean);

      if (routeParts.length !== pathParts.length) continue;

      const params: Record<string, string> = {};
      let isMatch = true;

      for (let i = 0; i < routeParts.length; i++) {
        if (routeParts[i].startsWith(':')) {
          params[routeParts[i].slice(1)] = pathParts[i];
        } else if (routeParts[i] !== pathParts[i]) {
          isMatch = false;
          break;
        }
      }

      if (isMatch) return { route, params };
    }

    return null;
  }

  async handle(req: Request, res: Response) {
    // WHATWG URL API kullanımı
    const baseURL = `http://${req.headers.host || 'localhost'}`;
    const parsedUrl = new URL(req.url || '/', baseURL);
    const pathname = parsedUrl.pathname;

    // Query parametrelerini object'e çevir
    const query: Record<string, string> = {};
    parsedUrl.searchParams.forEach((value, key) => {
      query[key] = value;
    });
    req.query = query;

    const match = this.matchRoute(req.method || 'GET', pathname);

    if (!match) {
      res.json({ error: 'Route not found' }, 404);
      return;
    }

    req.params = match.params;

    if (req.method === 'POST' || req.method === 'PUT') {
      let body = '';
      req.on('data', chunk => body += chunk.toString());
      req.on('end', async () => {
        try {
          req.body = JSON.parse(body);
        } catch (e) {
          req.body = body;
        }
        await match.route.handler(req, res);
      });
    } else {
      await match.route.handler(req, res);
    }
  }
}