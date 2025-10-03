import { IncomingMessage, ServerResponse } from 'http';

export type AsyncHandler = (req: Request, res: Response) => Promise<void>;
export type SyncHandler = (req: Request, res: Response) => void;
export type RouteHandler = AsyncHandler | SyncHandler;

export interface Route {
  method: string;
  path: string;
  handler: RouteHandler;
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