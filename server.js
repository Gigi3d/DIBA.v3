const express = require('express');
const path = require('path');
const trackApi = require('./api/track.js');
const sessionsApi = require('./api/sessions.js');

const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// Serve static files (HTML, CSS, JS, images) from the current folder
app.use(express.static(path.join(__dirname)));

// Route specifically for the Vercel serverless function at /api/track
app.post('/api/track', async (req, res) => {
  try {
    await trackApi(req, res);
  } catch (error) {
    console.error('Error handling /api/track:', error);
    res.status(500).json({ error: error.message });
  }
});

// Route specifically for the Vercel serverless function at /api/sessions
app.get('/api/sessions', async (req, res) => {
  try {
    await sessionsApi(req, res);
  } catch (error) {
    console.error('Error handling /api/sessions:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
  console.log('\n====================================');
  console.log('🚀 Local Environment Ready!');
  console.log('====================================');
  console.log(`🔹 Main Deck: http://localhost:${PORT}`);
  console.log(`🔹 Admin Dashboard: http://localhost:${PORT}/admin.html`);
  console.log('====================================\n');
});
