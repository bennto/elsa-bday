const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure data and uploads directories exist
const DATA_FILE = path.join(__dirname, 'data', 'messages.json');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');

if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify([]));
}

// Multer config for image uploads
const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e6);
    cb(null, unique + path.extname(file.originalname));
  },
});
const ALLOWED_TYPES = /jpeg|jpg|png|gif|webp/;
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(1);
    if (ALLOWED_TYPES.test(ext) && ALLOWED_TYPES.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// Helpers
function readMessages() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}
function writeMessages(messages) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(messages, null, 2));
}

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.get('/api/messages', (req, res) => {
  const messages = readMessages();
  // Newest first
  res.json(messages.slice().reverse());
});

app.post('/api/messages', upload.single('image'), (req, res) => {
  const { name, text } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Message text is required' });
  }

  const message = {
    id: Date.now().toString(),
    name: name.trim().slice(0, 60),
    text: text.trim().slice(0, 1000),
    image: req.file ? `/uploads/${req.file.filename}` : null,
    createdAt: new Date().toISOString(),
  };

  const messages = readMessages();
  messages.push(message);
  writeMessages(messages);

  res.status(201).json(message);
});

app.delete('/api/messages', (req, res) => {
  const id = req.query.id;
  if (!id) return res.status(400).json({ error: 'id required' });
  const messages = readMessages();
  const idx = messages.findIndex((m) => m.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });

  const [removed] = messages.splice(idx, 1);
  writeMessages(messages);

  // Clean up uploaded image
  if (removed.image) {
    const filePath = path.join(__dirname, 'public', removed.image);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  res.json({ ok: true });
});

// Multer error handler
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'Image must be under 10 MB' });
  }
  res.status(400).json({ error: err.message });
});

app.listen(PORT, () => {
  console.log(`Birthday card running at http://localhost:${PORT}`);
});
