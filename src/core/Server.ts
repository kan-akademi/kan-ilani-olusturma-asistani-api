import http, { IncomingMessage, ServerResponse } from 'http';
import { Router } from './Router';
import { Request, Response } from '../types';
import { Logger } from './Logger';
import dotenv from 'dotenv';

dotenv.config();

export class Server {
  private router: Router;
  private server: http.Server;

  constructor() {
    this.router = new Router();
    this.server = http.createServer(this.handleRequest.bind(this));
  }

  private handleRequest(req: IncomingMessage, res: ServerResponse) {
    const request = req as Request;
    const response = res as Response;

    response.json = (data: any, statusCode = 200) => {
      response.writeHead(statusCode, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify(data));
    };

    response.send = (data: string, statusCode = 200) => {
      response.writeHead(statusCode, { 'Content-Type': 'text/plain' });
      response.end(data);
    };

    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['*'];
    const origin = req.headers.origin || '';

    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      response.setHeader('Access-Control-Allow-Origin', origin || '*');
      Logger.debug('CORS headers set', { origin });
    }

    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (request.method === 'OPTIONS') {
      Logger.debug('OPTIONS request handled');
      response.writeHead(200);
      response.end();
      return; // Prevent further handling
    }

    this.router.handle(request, response);
  }

  use(router: Router) {
    this.router = router;
    Logger.info('Router attached to server');
  }

  listen(port: number, host: string = '0.0.0.0', callback?: () => void) {
    this.server.listen(port, host, callback);
  }

  getRouter() {
    return this.router;
  }
}