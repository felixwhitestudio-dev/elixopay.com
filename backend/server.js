const cors = require('cors');
const pool = require('./db');
const bcrypt = require('bcrypt');

const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: [
    'https://elixopay.com',
    'https://elixopay-production-de65.up.railway.app',
    'https://45.76.161.48',
    'https://elixopaycom.vercel.app',
    'https://elixopaycom-phi.vercel.app',
    'https://elixopay.netlify.app'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.options('*', cors()); // Enable preflight for all routes
app.use(express.json());

// Login API
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password required' });
  }
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    // สามารถเพิ่ม JWT หรือ session ได้ที่นี่
    res.json({ success: true, message: 'Login successful', user: { id: user.id, email: user.email, username: user.username } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});
    
    // รองรับ frontend ที่เรียก /api/v1/auth/login
    app.post('/api/v1/auth/login', async (req, res) => {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password required' });
      }
      try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
          return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        const user = result.rows[0];
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
          return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        // สามารถเพิ่ม JWT หรือ session ได้ที่นี่
        res.json({ success: true, message: 'Login successful', user: { id: user.id, email: user.email, username: user.username } });
      } catch (err) {
        res.status(500).json({ success: false, message: 'Server error', error: err.message });
      }
    });

app.get('/', (req, res) => {
  res.send('Elixopay Backend API is running!');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
