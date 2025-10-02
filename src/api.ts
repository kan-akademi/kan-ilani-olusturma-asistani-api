import { Server } from './core/Server';
import * as fs from 'fs';
import * as path from 'path';

const app = new Server();
const router = app.getRouter();

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, './data');
const COUNTER_FILE = path.join(DATA_DIR, 'counter.txt');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
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

  const data = readCounter();

  // Hash değeri farklı ise counter artır
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

const PORT = parseInt(process.env.PORT || '3000');
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});