const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const auth = require('../middleware/auth');
const budgetTrackingService = require('../services/budgetTrackingService');
const budgetAlertService = require('../services/budgetAlertService');
const router = express.Router();

/**
 * @swagger
 * /api/users/profile:
 *   get:
 *     summary: Get current user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ message: 'Failed to fetch user profile' });
  }
});

/**
 * @swagger
 * /api/users/profile:
 *   put:
 *     summary: Update user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               settings:
 *                 type: object
 *     responses:
 *       200:
 *         description: Updated user profile
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Bad request
 *       404:
 *         description: User not found
 *       409:
 *         description: Email already exists
 *       500:
 *         description: Internal server error
 */
router.put('/profile', auth, async (req, res) => {
  try {
    const { name, email, settings } = req.body;
    
    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (settings) updateData.settings = { ...settings };
    
    const user = await User.findByIdAndUpdate(
      req.userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('Error updating user profile:', error);
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Email already exists' });
    }
    res.status(500).json({ message: 'Failed to update user profile' });
  }
});

/**
 * @swagger
 * /api/users/change-password:
 *   put:
 *     summary: Change user password
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Bad request
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.put('/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }
    
    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters long' });
    }
    
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }
    
    // Hash new password
    const saltRounds = 10;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);
    
    // Update password
    await User.findByIdAndUpdate(req.userId, { password: hashedNewPassword });
    
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ message: 'Failed to change password' });
  }
});

/**
 * @swagger
 * /api/users/budget:
 *   get:
 *     summary: Get user's monthly budget
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User's monthly budget
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 monthlyBudget:
 *                   type: object
 *                   properties:
 *                     amount:
 *                       type: number
 *                     currency:
 *                       type: string
 *                     alertThresholds:
 *                       type: object
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.get('/budget', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('monthlyBudget');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ monthlyBudget: user.monthlyBudget });
  } catch (error) {
    console.error('Error fetching user budget:', error);
    res.status(500).json({ message: 'Failed to fetch budget' });
  }
});

/**
 * @swagger
 * /api/users/budget:
 *   put:
 *     summary: Update user's monthly budget
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *                 minimum: 0
 *               currency:
 *                 type: string
 *               alertThresholds:
 *                 type: object
 *                 properties:
 *                   warning:
 *                     type: number
 *                     minimum: 0
 *                     maximum: 100
 *                   critical:
 *                     type: number
 *                     minimum: 0
 *                     maximum: 100
 *     responses:
 *       200:
 *         description: Updated budget
 *       400:
 *         description: Bad request
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.put('/budget', auth, async (req, res) => {
  try {
    const { amount, currency, alertThresholds } = req.body;
    
    if (amount !== undefined && amount < 0) {
      return res.status(400).json({ message: 'Budget amount cannot be negative' });
    }
    
    if (alertThresholds) {
      const { warning, critical } = alertThresholds;
      if (warning && (warning < 0 || warning > 100)) {
        return res.status(400).json({ message: 'Warning threshold must be between 0 and 100' });
      }
      if (critical && (critical < 0 || critical > 100)) {
        return res.status(400).json({ message: 'Critical threshold must be between 0 and 100' });
      }
      if (warning && critical && warning >= critical) {
        return res.status(400).json({ message: 'Warning threshold must be less than critical threshold' });
      }
    }
    
    const updateData = {};
    if (amount !== undefined) updateData['monthlyBudget.amount'] = amount;
    if (currency) updateData['monthlyBudget.currency'] = currency;
    if (alertThresholds) {
      if (alertThresholds.warning !== undefined) updateData['monthlyBudget.alertThresholds.warning'] = alertThresholds.warning;
      if (alertThresholds.critical !== undefined) updateData['monthlyBudget.alertThresholds.critical'] = alertThresholds.critical;
    }
    
    const user = await User.findByIdAndUpdate(
      req.userId,
      updateData,
      { new: true, runValidators: true }
    ).select('monthlyBudget');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({ 
      message: 'Budget updated successfully', 
      monthlyBudget: user.monthlyBudget 
    });
  } catch (error) {
    console.error('Error updating budget:', error);
    res.status(500).json({ message: 'Failed to update budget' });
  }
});

/**
 * @swagger
 * /api/users/budget/overview:
 *   get:
 *     summary: Get comprehensive budget overview
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Detailed budget overview with spending breakdown
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.get('/budget/overview', auth, async (req, res) => {
  try {
    const overview = await budgetTrackingService.getBudgetOverview(req.userId);
    res.json(overview);
  } catch (error) {
    console.error('Error fetching budget overview:', error);
    res.status(500).json({ message: 'Failed to fetch budget overview' });
  }
});

/**
 * @swagger
 * /api/users/budget/alerts:
 *   get:
 *     summary: Get budget alert summary
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Budget alert summary
 *       500:
 *         description: Internal server error
 */
router.get('/budget/alerts', auth, async (req, res) => {
  try {
    const alertSummary = await budgetAlertService.getBudgetAlertSummary(req.userId);
    res.json(alertSummary);
  } catch (error) {
    console.error('Error fetching budget alert summary:', error);
    res.status(500).json({ message: 'Failed to fetch budget alert summary' });
  }
});

/**
 * @swagger
 * /api/users/budget/check-alerts:
 *   post:
 *     summary: Check and send budget alerts for current user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Budget alert check completed
 *       500:
 *         description: Internal server error
 */
router.post('/budget/check-alerts', auth, async (req, res) => {
  try {
    const result = await budgetAlertService.checkAndSendBudgetAlert(req.userId);
    res.json({
      message: 'Budget alert check completed',
      result
    });
  } catch (error) {
    console.error('Error checking budget alerts:', error);
    res.status(500).json({ message: 'Failed to check budget alerts' });
  }
});

/**
 * @swagger
 * /api/users/budget/check-all-alerts:
 *   post:
 *     summary: Check and send budget alerts for all users (admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Bulk budget alert check completed
 *       403:
 *         description: Admin access required
 *       500:
 *         description: Internal server error
 */
router.post('/budget/check-all-alerts', auth, async (req, res) => {
  try {
    // Check if user is admin (you may need to implement admin middleware)
    const user = await User.findById(req.userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const results = await budgetAlertService.checkAllUserBudgets();
    res.json({
      message: 'Bulk budget alert check completed',
      results
    });
  } catch (error) {
    console.error('Error checking all budget alerts:', error);
    res.status(500).json({ message: 'Failed to check all budget alerts' });
  }
});

module.exports = router;