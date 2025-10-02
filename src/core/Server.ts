import http, { IncomingMessage, ServerResponse } from 'http';
import { Router } from './Router';
import { Request, Response } from '../types';

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

    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (request.method === 'OPTIONS') {
      response.writeHead(200);
      response.end();
      return;
    }

    this.router.handle(request, response);
  }

  use(router: Router) {
    this.router = router;
  }

  listen(port: number, callback?: () => void) {
    this.server.listen(port, callback);
  }

  getRouter() {
    return this.router;
  }
}