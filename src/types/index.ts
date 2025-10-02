import { IncomingMessage, ServerResponse } from 'http';

export interface Route {
  method: string;
  path: string;
  handler: (req: Request, res: Response) => void | Promise<void>;
}

export interface Request extends IncomingMessage {
  params?: Record<string, string>;
  query?: Record<string, string>;
  body?: any;
}

export interface Response extends ServerResponse {
  json: (data: any, statusCode?: number) => void;
  send: (data: string, statusCode?: number) => void;
}