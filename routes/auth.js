const express = require('express');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const User = require('../models/User');
const Notification = require('../models/Notification');
const emailService = require('../services/emailService');
const router = express.Router();

// Passport configuration
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: '/api/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await User.findOne({ googleId: profile.id });
    
    if (!user) {
      user = await User.findOne({ email: profile.emails[0].value });
      if (user) {
        user.googleId = profile.id;
        await user.save();
      } else {
        user = new User({
          googleId: profile.id,
          email: profile.emails[0].value,
          name: profile.displayName,
          firstName: profile.name.givenName,
          lastName: profile.name.familyName
        });
        await user.save();
        
        // Create welcome notification
        const notification = new Notification({
          userId: user._id,
          title: 'Welcome to Balancio!',
          message: `Hi ${user.name}! Welcome to Balancio. Start tracking your expenses and managing your budget today.`,
          type: 'info',
          read: false
        });
        await notification.save();
      }
    }
    
    return done(null, user);
  } catch (error) {
    return done(error, null);
  }
}));

passport.use(new GitHubStrategy({
  clientID: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  callbackURL: '/api/auth/github/callback'
}, async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await User.findOne({ githubId: profile.id });
    
    if (!user) {
      const email = profile.emails && profile.emails[0] ? profile.emails[0].value : `${profile.username}@github.local`;
      user = await User.findOne({ email });
      if (user) {
        user.githubId = profile.id;
        await user.save();
      } else {
        user = new User({
          githubId: profile.id,
          email,
          name: profile.displayName || profile.username,
          firstName: profile.displayName ? profile.displayName.split(' ')[0] : profile.username,
          lastName: profile.displayName ? profile.displayName.split(' ').slice(1).join(' ') : ''
        });
        await user.save();
        
        // Create welcome notification
        const notification = new Notification({
          userId: user._id,
          title: 'Welcome to Balancio!',
          message: `Hi ${user.name}! Welcome to Balancio. Start tracking your expenses and managing your budget today.`,
          type: 'info',
          read: false
        });
        await notification.save();
      }
    }
    
    return done(null, user);
  } catch (error) {
    return done(error, null);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Register
/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - name
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 6
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 user:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     id:
 *                       type: string
 *                     email:
 *                       type: string
 *                     name:
 *                       type: string
 *                     firstName:
 *                       type: string
 *                     lastName:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Bad request
 *       409:
 *         description: User already exists
 *       500:
 *         description: Internal server error
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    if (!email || !password || !name) {
      return res.status(400).json({ message: 'Email, password, and name are required' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: 'User with this email already exists' });
    }
    
    const user = new User({ email, password, name });
    await user.save();
    
    // Create welcome notification
    const notification = new Notification({
      userId: user._id,
      title: 'Welcome to Balancio!',
      message: `Hi ${name}! Welcome to Balancio. Start tracking your expenses and managing your budget today.`,
      type: 'info',
      read: false
    });
    await notification.save();
    
    // Send welcome email
    const emailResult = await emailService.sendWelcomeEmail(email, name);
    if (!emailResult.success) {
      console.log('⚠️  User registered but welcome email failed to send');
    }
    
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);
    res.status(201).json({ 
      token, 
      user: { 
        _id: user._id,
        id: user._id, 
        email, 
        name,
        firstName: user.firstName || (name ? name.split(' ')[0] : ''),
        lastName: user.lastName || (name ? name.split(' ').slice(1).join(' ') : ''),
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      } 
    });
  } catch (error) {
    console.error('Registration error:', error);
    if (error.code === 11000) {
      return res.status(409).json({ message: 'User with this email already exists' });
    }
    res.status(500).json({ message: 'Internal server error during registration' });
  }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login a user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: User logged in successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 user:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     id:
 *                       type: string
 *                     email:
 *                       type: string
 *                     name:
 *                       type: string
 *                     firstName:
 *                       type: string
 *                     lastName:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(401).json({ message: 'No account found with this email address' });
    }
    
    if (!(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Incorrect password' });
    }
    
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);
    res.json({ 
      token, 
      user: { 
        _id: user._id,
        id: user._id, 
        email: user.email, 
        name: user.name,
        firstName: user.firstName || (user.name ? user.name.split(' ')[0] : ''),
        lastName: user.lastName || (user.name ? user.name.split(' ').slice(1).join(' ') : ''),
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      } 
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error during login' });
  }
});

/**
 * @swagger
 * /api/auth/google:
 *   get:
 *     summary: Initiate Google OAuth login
 *     tags: [Auth]
 *     responses:
 *       302:
 *         description: Redirect to Google OAuth
 */
router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email']
}));

router.get('/google/callback', 
  passport.authenticate('google', { failureRedirect: 'http://localhost:4200/login' }),
  async (req, res) => {
    try {
      const token = jwt.sign({ userId: req.user._id }, process.env.JWT_SECRET);
      res.redirect(`http://localhost:4200/auth/callback?token=${token}&user=${encodeURIComponent(JSON.stringify({
        _id: req.user._id,
        id: req.user._id,
        email: req.user.email,
        name: req.user.name,
        firstName: req.user.firstName,
        lastName: req.user.lastName
      }))}`);
    } catch (error) {
      res.redirect('http://localhost:4200/login?error=auth_failed');
    }
  }
);

/**
 * @swagger
 * /api/auth/github:
 *   get:
 *     summary: Initiate GitHub OAuth login
 *     tags: [Auth]
 *     responses:
 *       302:
 *         description: Redirect to GitHub OAuth
 */
router.get('/github', passport.authenticate('github', {
  scope: ['user:email']
}));

router.get('/github/callback',
  passport.authenticate('github', { failureRedirect: 'http://localhost:4200/login' }),
  async (req, res) => {
    try {
      const token = jwt.sign({ userId: req.user._id }, process.env.JWT_SECRET);
      res.redirect(`http://localhost:4200/auth/callback?token=${token}&user=${encodeURIComponent(JSON.stringify({
        _id: req.user._id,
        id: req.user._id,
        email: req.user.email,
        name: req.user.name,
        firstName: req.user.firstName,
        lastName: req.user.lastName
      }))}`);
    } catch (error) {
      res.redirect('http://localhost:4200/login?error=auth_failed');
    }
  }
);

module.exports = router;