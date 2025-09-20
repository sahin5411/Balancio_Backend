const express = require('express');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const User = require('../models/User');
const Notification = require('../models/Notification');
const emailService = require('../services/emailService');
const crypto = require('crypto');
const { connectToDatabase } = require('../utils/db');
const router = express.Router();

// Add CORS headers middleware for auth routes
router.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  
  next();
});

// Passport configuration
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: '/api/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
  try {
    // Ensure database connection
    await connectToDatabase();
    
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
    // Ensure database connection
    await connectToDatabase();
    
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
    // Ensure database connection
    await connectToDatabase();
    
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
    // Ensure database connection
    await connectToDatabase();
    
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
    // Ensure database connection
    await connectToDatabase();
    
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
 * /api/auth/forgot-password:
 *   post:
 *     summary: Request password reset
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Password reset email sent
 *       400:
 *         description: Bad request
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.post('/forgot-password', async (req, res) => {
  try {
    // Ensure database connection
    await connectToDatabase();
    
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }
    
    const user = await User.findOne({ email });
    
    if (!user) {
      // For security reasons, we don't reveal if the email exists
      return res.status(200).json({ message: 'If an account with that email exists, a password reset link has been sent.' });
    }
    
    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = Date.now() + 3600000; // 1 hour from now
    
    // Save token and expiry to user
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetTokenExpiry;
    await user.save();
    
    // Create reset URL
    const resetUrl = `${process.env.APP_URL || 'http://localhost:4200'}/reset-password?token=${resetToken}`;
    
    // Send email
    const mailOptions = {
      from: process.env.FROM_EMAIL || 'noreply@balancio.com',
      to: user.email,
      subject: 'Password Reset Request - Balancio',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset - Balancio</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            
            <!-- Header -->
            <div style="background-color: #2563eb; padding: 40px 30px; text-align: center;">
              <h1 style="color: white; font-size: 36px; font-weight: 700; margin: 0; letter-spacing: -1px;">Balancio</h1>
              <p style="color: rgba(255, 255, 255, 0.9); font-size: 16px; margin: 8px 0 0 0;">Personal Finance Manager</p>
            </div>
            
            <!-- Content -->
            <div style="padding: 40px 30px;">
              <h2 style="color: #1f2937; font-size: 24px; font-weight: 600; margin: 0 0 16px 0; text-align: center;">Password Reset Request</h2>
              
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 32px 0; text-align: center;">Hi ${user.name},</p>
              
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 32px 0; text-align: center;">You have requested to reset your password. Click the button below to create a new password.</p>
              
              <div style="text-align: center; margin: 32px 0;">
                <a href="${resetUrl}" style="display: inline-block; background-color: #2563eb; color: white; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: 500; font-size: 16px;">Reset Password</a>
              </div>
              
              <p style="color: #6b7280; font-size: 14px; line-height: 1.5; margin: 32px 0 0 0; text-align: center;">This link will expire in 1 hour. If you didn't request this, please ignore this email.</p>
              
              <p style="color: #6b7280; font-size: 12px; line-height: 1.5; margin: 16px 0 0 0; text-align: center;">If the button above doesn't work, copy and paste this link into your browser:<br>${resetUrl}</p>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #f8fafc; padding: 24px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
              <div style="margin-bottom: 16px;">
                <div style="color: #2563eb; font-size: 18px; font-weight: 700;">B</div>
              </div>
              <p style="color: #6b7280; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} Balancio. All rights reserved.</p>
              <p style="color: #9ca3af; font-size: 11px; margin: 4px 0 0 0;">This email was sent to ${user.email}</p>
            </div>
          </div>
        </body>
        </html>
      `
    };
    
    try {
      await emailService.transporter.sendMail(mailOptions);
      console.log('Password reset email sent to:', user.email);
      res.status(200).json({ message: 'If an account with that email exists, a password reset link has been sent.' });
    } catch (emailError) {
      console.error('Error sending password reset email:', emailError);
      res.status(200).json({ message: 'If an account with that email exists, a password reset link has been sent.' });
    }
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Internal server error during password reset request' });
  }
});

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Reset password with token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - password
 *             properties:
 *               token:
 *                 type: string
 *               password:
 *                 type: string
 *                 minLength: 6
 *     responses:
 *       200:
 *         description: Password reset successful
 *       400:
 *         description: Bad request
 *       401:
 *         description: Invalid or expired token
 *       500:
 *         description: Internal server error
 */
router.post('/reset-password', async (req, res) => {
  try {
    // Ensure database connection
    await connectToDatabase();
    
    const { token, password } = req.body;
    
    if (!token || !password) {
      return res.status(400).json({ message: 'Token and password are required' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }
    
    // Find user with this token and check if it's not expired
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.status(401).json({ message: 'Password reset token is invalid or has expired' });
    }
    
    // Set new password
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    
    // Send confirmation email
    const mailOptions = {
      from: process.env.FROM_EMAIL || 'noreply@balancio.com',
      to: user.email,
      subject: 'Password Changed Successfully - Balancio',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Changed - Balancio</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            
            <!-- Header -->
            <div style="background-color: #10b981; padding: 40px 30px; text-align: center;">
              <h1 style="color: white; font-size: 36px; font-weight: 700; margin: 0; letter-spacing: -1px;">Balancio</h1>
              <p style="color: rgba(255, 255, 255, 0.9); font-size: 16px; margin: 8px 0 0 0;">Personal Finance Manager</p>
            </div>
            
            <!-- Content -->
            <div style="padding: 40px 30px;">
              <h2 style="color: #1f2937; font-size: 24px; font-weight: 600; margin: 0 0 16px 0; text-align: center;">Password Changed Successfully</h2>
              
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 32px 0; text-align: center;">Hi ${user.name},</p>
              
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 32px 0; text-align: center;">Your password has been successfully changed. You can now log in with your new password.</p>
              
              <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 24px; margin: 32px 0;">
                <h3 style="color: #15803d; font-size: 18px; font-weight: 600; margin: 0 0 16px 0;">Security Tips:</h3>
                <ul style="color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0; padding-left: 20px;">
                  <li style="margin-bottom: 8px;">Use a strong, unique password for each account</li>
                  <li style="margin-bottom: 8px;">Enable two-factor authentication when available</li>
                  <li style="margin-bottom: 8px;">Never share your password with anyone</li>
                  <li style="margin-bottom: 0;">Change your passwords regularly</li>
                </ul>
              </div>
              
              <div style="text-align: center; margin: 32px 0;">
                <a href="${process.env.APP_URL || 'http://localhost:4200'}/login" style="display: inline-block; background-color: #2563eb; color: white; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: 500; font-size: 16px;">Log In Now</a>
              </div>
              
              <p style="color: #6b7280; font-size: 14px; line-height: 1.5; margin: 32px 0 0 0; text-align: center;">If you didn't make this change, please contact support immediately.</p>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #f8fafc; padding: 24px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
              <div style="margin-bottom: 16px;">
                <div style="color: #2563eb; font-size: 18px; font-weight: 700;">B</div>
              </div>
              <p style="color: #6b7280; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} Balancio. All rights reserved.</p>
              <p style="color: #9ca3af; font-size: 11px; margin: 4px 0 0 0;">This email was sent to ${user.email}</p>
            </div>
          </div>
        </body>
        </html>
      `
    };
    
    try {
      await emailService.transporter.sendMail(mailOptions);
      console.log('Password change confirmation email sent to:', user.email);
    } catch (emailError) {
      console.error('Error sending password change confirmation email:', emailError);
    }
    
    res.status(200).json({ message: 'Password has been reset successfully. You can now log in with your new password.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Internal server error during password reset' });
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