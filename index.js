const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const testRoutes = require('./routes/test');
const cardsRoutes = require('./routes/cards');
const decksRoutes = require('./routes/decks');

const app = express();
const PORT = 3001;
const JWT_SECRET = 'garymtg-dev-secret'; // ponytail: solo para local; mover a env en prod
const DB_PATH = path.join(__dirname, 'users.json');

app.use(cors());
app.use(express.json());
app.use('/api/test', testRoutes);
app.use('/api/cards', cardsRoutes);

function loadUsers() {
  if (!fs.existsSync(DB_PATH)) return [];
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function saveUsers(users) {
  fs.writeFileSync(DB_PATH, JSON.stringify(users, null, 2));
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

function publicUser(u) {
  return { id: u.id, username: u.username, email: u.email, avatar: u.avatar };
}

app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Faltan campos' });
  }

  const users = loadUsers();
  if (users.some((u) => u.email === email || u.username === username)) {
    return res.status(409).json({ error: 'Usuario o email ya existe' });
  }

  const user = {
    id: Date.now().toString(),
    username,
    email,
    password: await bcrypt.hash(password, 10),
    avatar: `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(username)}`,
  };
  users.push(user);
  saveUsers(users);

  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
  res.status(201).json({ token, user: publicUser(user) });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Faltan campos' });
  }

  const user = loadUsers().find((u) => u.email === email);
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: publicUser(user) });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = loadUsers().find((u) => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json({ user: publicUser(user) });
});

app.use('/api/decks', authMiddleware, decksRoutes);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`GaryMTG API en http://localhost:${PORT}`);
});
