import { Server } from './core/Server';
import * as fs from 'fs';
import * as path from 'path';

const app = new Server();
const router = app.getRouter();

const rateLimitMap = new Map<string, { count: number; timestamp: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 dakika
const RATE_LIMIT_MAX = 10; // 1 dakika içinde maksimum 10 istek

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, './data');
const COUNTER_FILE = path.join(DATA_DIR, 'counter.txt');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now - entry.timestamp > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(ip, { count: 1, timestamp: now });
    return false;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return true;
  }

  entry.count++;
  rateLimitMap.set(ip, entry);
  return false;
}

function readCounter(): { counter: number; lastHash: string } {
  try {
    if (!fs.existsSync(COUNTER_FILE)) {
      const initialData = { counter: 0, lastHash: '' };
      fs.writeFileSync(COUNTER_FILE, JSON.stringify(initialData, null, 2));
      return initialData;
    }

    const data = fs.readFileSync(COUNTER_FILE, 'utf-8');

    return JSON.parse(data);
  } catch (error) {
    return { counter: 0, lastHash: '' };
  }
}

function writeCounter(counter: number, lastHash: string): void {
  const data = { counter, lastHash };

  fs.writeFileSync(COUNTER_FILE, JSON.stringify(data, null, 2));
}

router.get('/', (req, res) => {
  res.json({ message: 'Native TypeScript Backend API', version: '1.0.0' });
});

router.get('/counter', (req, res) => {
  const data = readCounter();

  res.json({
    counter: data.counter,
    lastHash: data.lastHash
  });
});

router.post('/counter', (req, res) => {
  const { hash } = req.body;

  if (!hash) {
    //res.json({ error: 'Hash value is required' }, 400);
    return;
  }

  // Extract only the first IP from x-forwarded-for header
  const forwardedFor = req.headers['x-forwarded-for'] as string;
  const ip = forwardedFor?.split(',')[0]?.trim() || req.socket.remoteAddress || '';

  if (isRateLimited(ip)) {
    res.json({ error: 'Too many requests. Please try again later.' }, 429);
    return;
  }

  const data = readCounter();

  if (data.lastHash !== hash) {
    data.counter++;
    data.lastHash = hash;

    writeCounter(data.counter, data.lastHash);

    res.json({
      message: 'Counter incremented',
      counter: data.counter,
      lastHash: data.lastHash
    });
  } else {
    res.json({
      message: 'Hash already exists, counter not changed',
      counter: data.counter,
      lastHash: data.lastHash
    });
  }
});

// Automatic cleanup for expired rate limit entries
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now - entry.timestamp > RATE_LIMIT_WINDOW) {
      rateLimitMap.delete(ip);
    }
  }
}, RATE_LIMIT_WINDOW);

const PORT = parseInt(process.env.PORT || '3000');
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});