const express = require('express');
const router = express.Router();

// Simple test route to verify CORS is working
router.get('/cors-test', (req, res) => {
  res.json({ message: 'CORS is working correctly!' });
});

router.post('/cors-test', (req, res) => {
  res.json({ message: 'CORS POST request is working correctly!', received: req.body });
});

module.exports = router;