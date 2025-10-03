import { Route, Request, Response, RouteHandler } from '../types';
import { Logger } from './Logger';

export class Router {
  private routes: Route[] = [];

  private addRoute(method: string, path: string, handler: RouteHandler) {
    this.routes.push({ method, path, handler });
    Logger.debug('Route registered', { method, path });
  }

  get(path: string, handler: RouteHandler) {
    this.addRoute('GET', path, handler);
  }

  post(path: string, handler: RouteHandler) {
    this.addRoute('POST', path, handler);
  }

  put(path: string, handler: RouteHandler) {
    this.addRoute('PUT', path, handler);
  }

  delete(path: string, handler: RouteHandler) {
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
    const startTime = Date.now();
    
    try {
      // WHATWG URL API kullanımı
      const baseURL = `http://${req.headers.host || 'localhost'}`;
      const parsedUrl = new URL(req.url || '/', baseURL);
      const pathname = parsedUrl.pathname;

      Logger.info('Incoming request', { 
        method: req.method, 
        path: pathname,
        ip: req.socket.remoteAddress 
      });

      // Query parametrelerini object'e çevir
      const query: Record<string, string> = {};
      parsedUrl.searchParams.forEach((value, key) => {
        query[key] = value;
      });
      req.query = query;

      const match = this.matchRoute(req.method || 'GET', pathname);

      if (!match) {
        Logger.warn('Route not found', { method: req.method, path: pathname });
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
          
          try {
            await match.route.handler(req, res);
            const duration = Date.now() - startTime;
            Logger.info('Request completed', { 
              method: req.method, 
              path: pathname, 
              duration: `${duration}ms`,
              statusCode: res.statusCode
            });
          } catch (error) {
            Logger.error('Handler error', error as Error, { method: req.method, path: pathname });
            res.json({ error: 'Internal server error' }, 500);
          }
        });
      } else {
        try {
          await match.route.handler(req, res);
          const duration = Date.now() - startTime;
          Logger.info('Request completed', { 
            method: req.method, 
            path: pathname, 
            duration: `${duration}ms`,
            statusCode: res.statusCode
          });
        } catch (error) {
          Logger.error('Handler error', error as Error, { method: req.method, path: pathname });
          res.json({ error: 'Internal server error' }, 500);
        }
      }
    } catch (error) {
      Logger.error('Router error', error as Error);
      res.json({ error: 'Internal server error' }, 500);
    }
  }
}