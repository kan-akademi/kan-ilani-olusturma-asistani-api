import { Server } from './core/Server';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Logger } from './core/Logger';
import { Request } from './types';

const app = new Server();
const router = app.getRouter();

const rateLimitMap = new Map<string, { count: number; timestamp: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 dakika
const RATE_LIMIT_MAX = 10; // 1 dakika içinde maksimum 10 istek

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, './data');
const COUNTER_FILE = path.join(DATA_DIR, 'counter.txt');

// Başlangıçta data dizinini oluştur
async function initializeDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    Logger.info('Data directory initialized', { path: DATA_DIR });
  } catch (error) {
    Logger.error('Failed to create data directory', error as Error);
  }
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now - entry.timestamp > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(ip, { count: 1, timestamp: now });
    Logger.info('Rate limit entry created', { ip, count: 1 });
    return false;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    Logger.info('Rate limit exceeded', { ip, count: entry.count });
    return true;
  }

  entry.count++;
  Logger.info('Rate limit entry updated', { ip, count: entry.count });
  return false;
}

async function readCounter(): Promise<{ counter: number; lastHash: string }> {
  try {
    const fileExists = await fs.access(COUNTER_FILE).then(() => true).catch(() => false);

    if (!fileExists) {
      const initialData = { counter: 0, lastHash: '' };
      await fs.writeFile(COUNTER_FILE, JSON.stringify(initialData, null, 2));
      Logger.info('Counter file created with initial data');
      return initialData;
    }

    const data = await fs.readFile(COUNTER_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    Logger.info('Counter data read successfully', { counter: parsed.counter });
    return parsed;
  } catch (error) {
    Logger.error('Failed to read counter', error as Error);
    return { counter: 0, lastHash: '' };
  }
}

async function writeCounter(counter: number, lastHash: string): Promise<void> {
  try {
    const data = { counter, lastHash };
    await fs.writeFile(COUNTER_FILE, JSON.stringify(data, null, 2));
    Logger.info('Counter data written successfully', { counter, lastHash: lastHash.substring(0, 8) + '...' });
  } catch (error) {
    Logger.error('Failed to write counter', error as Error);
    throw error;
  }
}

function getClientIp(req: Request): string {
  const forwardedFor = req.headers['x-forwarded-for'] as string;
  const cloudflareIp = req.headers['cf-connecting-ip'] as string;

  // Cloudflare kullanıyorsanız
  if (cloudflareIp) {
    Logger.info('Client IP detected from Cloudflare', { ip: cloudflareIp });
    return cloudflareIp;
  }

  // Proxy ardından
  if (forwardedFor) {
    const ip = forwardedFor.split(',')[0]?.trim();
    Logger.info('Client IP detected from X-Forwarded-For', { ip });
    return ip;
  }

  const ip = req.socket.remoteAddress || 'unknown';
  Logger.info('Client IP detected from socket', { ip });
  return ip;
}

router.get('/', (req, res) => {
  Logger.info('Root endpoint accessed');
  res.json({ message: 'Native TypeScript Backend API', version: '1.0.0' });
});

router.get('/counter', async (req, res) => {
  try {
    Logger.info('GET /counter endpoint accessed');
    const data = await readCounter();

    res.json({
      counter: data.counter,
      lastHash: data.lastHash
    });
  } catch (error) {
    Logger.error('Error in GET /counter', error as Error);
    res.json({ error: 'Failed to read counter' }, 500);
  }
});

router.post('/counter', async (req, res) => {
  try {
    const { hash } = req.body;
    const ip = getClientIp(req);

    Logger.info('POST /counter endpoint accessed', { ip, hasHash: !!hash });

    if (!hash) {
      Logger.info('Missing hash in request body', { ip });
      res.json({ error: 'Hash value is required' }, 400);
      return;
    }

    if (isRateLimited(ip)) {
      Logger.info('Rate limit triggered', { ip });
      res.json({ error: 'Too many requests. Please try again later.' }, 429);
      return;
    }

    const data = await readCounter();

    if (data.lastHash !== hash) {
      data.counter++;
      data.lastHash = hash;

      await writeCounter(data.counter, data.lastHash);

      Logger.info('Counter incremented', {
        ip,
        newCounter: data.counter,
        hashPrefix: hash.substring(0, 8) + '...'
      });

      res.json({
        message: 'Counter incremented',
        counter: data.counter,
        lastHash: data.lastHash,
        wasIncremented: true
      });
    } else {
      Logger.info('Duplicate hash detected, counter not changed', {
        ip,
        counter: data.counter,
        hashPrefix: hash.substring(0, 8) + '...'
      });

      res.json({
        message: 'Hash already exists, counter not changed',
        counter: data.counter,
        lastHash: data.lastHash,
        wasIncremented: false
      });
    }
  } catch (error) {
    Logger.error('Error in POST /counter', error as Error);
    res.json({ error: 'Failed to update counter' }, 500);
  }
});

// Health check endpoint
router.get('/health', (req, res) => {
  Logger.info('Health check endpoint accessed');
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Automatic cleanup for expired rate limit entries
setInterval(() => {
  const now = Date.now();
  let cleanedCount = 0;

  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now - entry.timestamp > RATE_LIMIT_WINDOW) {
      rateLimitMap.delete(ip);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    Logger.info('Rate limit cleanup completed', { cleanedEntries: cleanedCount });
  }
}, RATE_LIMIT_WINDOW);

// Graceful shutdown
process.on('SIGTERM', () => {
  Logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  Logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Başlangıç
const PORT = parseInt(process.env.PORT || '3000');

async function startServer() {
  try {
    await initializeDataDir();

    app.listen(PORT, () => {
      Logger.info('Server started successfully', {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        dataDir: DATA_DIR
      });
    });
  } catch (error) {
    Logger.error('Failed to start server', error as Error);
    process.exit(1);
  }
}

startServer();