const express = require('express');
const router = express.Router();

// Simple test route to verify CORS is working
router.get('/cors-test', (req, res) => {
  res.json({ message: 'CORS is working correctly!' });
});

router.post('/cors-test', (req, res) => {
  res.json({ message: 'CORS POST request is working correctly!', received: req.body });
});

// Test login endpoint
router.post('/login-test', (req, res) => {
  res.json({ 
    message: 'Login test endpoint working', 
    token: 'test-token',
    user: {
      id: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User'
    }
  });
});

module.exports = router;