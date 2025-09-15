const express = require('express');
const { triggerMonthlyReports } = require('../scheduler/monthlyReportScheduler');
const budgetAlertService = require('../services/budgetAlertService');
const auth = require('../middleware/auth');
const router = express.Router();

/**
 * @swagger
 * /api/test/monthly-reports:
 *   post:
 *     summary: Manually trigger monthly reports
 *     tags: [Test]
 *     responses:
 *       200:
 *         description: Monthly reports triggered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       500:
 *         description: Failed to trigger monthly reports
 */
router.post('/monthly-reports', async (req, res) => {
  try {
    await triggerMonthlyReports();
    res.json({ success: true, message: 'Monthly reports triggered successfully' });
  } catch (error) {
    console.error('Error triggering monthly reports:', error);
    res.status(500).json({ success: false, message: 'Failed to trigger monthly reports' });
  }
});

/**
 * @swagger
 * /api/test/budget-alerts:
 *   post:
 *     summary: Manually trigger budget alert check for current user
 *     tags: [Test]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Budget alert check completed
 *       500:
 *         description: Failed to check budget alerts
 */
router.post('/budget-alerts', auth, async (req, res) => {
  try {
    const result = await budgetAlertService.checkAndSendBudgetAlert(req.userId);
    res.json({ 
      success: true, 
      message: 'Budget alert check completed',
      result 
    });
  } catch (error) {
    console.error('Error checking budget alerts:', error);
    res.status(500).json({ success: false, message: 'Failed to check budget alerts' });
  }
});

/**
 * @swagger
 * /api/test/budget-alerts-all:
 *   post:
 *     summary: Manually trigger budget alert check for all users
 *     tags: [Test]
 *     responses:
 *       200:
 *         description: Bulk budget alert check completed
 *       500:
 *         description: Failed to check budget alerts
 */
router.post('/budget-alerts-all', async (req, res) => {
  try {
    const results = await budgetAlertService.checkAllUserBudgets();
    res.json({ 
      success: true, 
      message: 'Bulk budget alert check completed',
      results 
    });
  } catch (error) {
    console.error('Error checking all budget alerts:', error);
    res.status(500).json({ success: false, message: 'Failed to check all budget alerts' });
  }
});

/**
 * @swagger
 * /api/test/email-service:
 *   get:
 *     summary: Test email service configuration
 *     tags: [Test]
 *     responses:
 *       200:
 *         description: Email service status
 *       500:
 *         description: Email service error
 */
router.get('/email-service', async (req, res) => {
  try {
    const emailService = require('../services/emailService');
    
    // Check if SMTP configuration exists
    const smtpConfig = {
      host: process.env.SMTP_HOST || 'Not configured',
      port: process.env.SMTP_PORT || 'Not configured',
      user: process.env.SMTP_USER ? 'Configured' : 'Not configured',
      pass: process.env.SMTP_PASS ? 'Configured' : 'Not configured'
    };
    
    res.json({
      success: true,
      message: 'Email service configuration check',
      config: smtpConfig,
      transporterReady: emailService.transporter ? 'Available' : 'Not available'
    });
  } catch (error) {
    console.error('Error checking email service:', error);
    res.status(500).json({ success: false, message: 'Email service error', error: error.message });
  }
});

/**
 * @swagger
 * /api/test/budget-status:
 *   get:
 *     summary: Get detailed budget status for debugging
 *     tags: [Test]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Detailed budget status
 *       500:
 *         description: Failed to get budget status
 */
router.get('/budget-status', auth, async (req, res) => {
  try {
    const budgetTrackingService = require('../services/budgetTrackingService');
    const User = require('../models/User');
    
    const user = await User.findById(req.userId).select('monthlyBudget settings email name');
    const budgetStatus = await budgetTrackingService.checkBudgetStatus(req.userId);
    
    const debugInfo = {
      userId: req.userId,
      userEmail: user?.email,
      userName: user?.name,
      budgetAlertsSetting: user?.settings?.budgetAlerts,
      budgetStatus,
      currentDate: new Date().toISOString(),
      recommendations: []
    };
    
    // Add recommendations based on status
    if (!budgetStatus.budgetSet) {
      debugInfo.recommendations.push('Set a monthly budget to enable alerts');
    }
    
    if (!user?.settings?.budgetAlerts) {
      debugInfo.recommendations.push('Enable budget alerts in profile settings');
    }
    
    if (budgetStatus.budgetSet && budgetStatus.percentageUsed < budgetStatus.thresholds.warning) {
      debugInfo.recommendations.push('Spend more to reach the warning threshold for testing');
    }
    
    if (budgetStatus.shouldSendAlert) {
      debugInfo.recommendations.push('Alert should be sent - check email service configuration');
    }
    
    res.json(debugInfo);
  } catch (error) {
    console.error('Error getting budget status:', error);
    res.status(500).json({ success: false, message: 'Failed to get budget status', error: error.message });
  }
});

module.exports = router;