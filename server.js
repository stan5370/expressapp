const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.raw({ type: 'audio/wav', limit: '10mb' }));
app.use(bodyParser.text({ type: 'text/plain' }));

// Import route handlers
const coordsToNameHandler = require('./routes/coordsToName');
const descToSpeechHandler = require('./routes/descToSpeech');
const namesToDescHandler = require('./routes/namesToDesc');
const speechToTextHandler = require('./routes/speechToText');

// Routes
app.get('/api/coordsToName', coordsToNameHandler);
app.post('/api/coordsToName', coordsToNameHandler);
app.options('/api/coordsToName', coordsToNameHandler);

app.get('/api/descToSpeech', descToSpeechHandler);
app.post('/api/descToSpeech', descToSpeechHandler);

app.get('/api/namesToDesc', namesToDescHandler);
app.options('/api/namesToDesc', namesToDescHandler);

app.post('/api/speechToText', speechToTextHandler);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server Error:', error);
  res.status(500).json({ error: 'Internal Server Error' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`Express server running on port ${PORT}`);
});

module.exports = app;