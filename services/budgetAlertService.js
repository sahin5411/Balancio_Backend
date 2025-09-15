const budgetTrackingService = require('./budgetTrackingService');
const emailService = require('./emailService');
const User = require('../models/User');
const Notification = require('../models/Notification');

class BudgetAlertService {
  /**
   * Check budget for a specific user and send alerts if needed
   * @param {string} userId - User ID
   * @returns {Object} Alert status and result
   */
  async checkAndSendBudgetAlert(userId) {
    try {
      console.log(`🔍 Checking budget alerts for user: ${userId}`);
      
      // Get user details
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }
      
      // Check if user wants budget alerts
      if (!user.settings.budgetAlerts) {
        console.log('📵 Budget alerts disabled for user');
        return {
          success: true,
          alertSent: false,
          reason: 'Budget alerts disabled'
        };
      }
      
      // Check budget status
      const budgetStatus = await budgetTrackingService.checkBudgetStatus(userId);
      
      if (!budgetStatus.budgetSet) {
        console.log('💰 No budget set for user');
        return {
          success: true,
          alertSent: false,
          reason: 'No budget set'
        };
      }
      
      if (!budgetStatus.shouldSendAlert) {
        console.log(`✅ No alert needed. Status: ${budgetStatus.alertLevel}`);
        return {
          success: true,
          alertSent: false,
          reason: `Budget status: ${budgetStatus.alertLevel}, no alert threshold reached or alert already sent today`
        };
      }
      
      // Prepare alert data
      const alertData = {
        alertType: budgetStatus.alertType,
        budget: budgetStatus.budget,
        spent: budgetStatus.spent,
        remaining: budgetStatus.remaining,
        percentageUsed: budgetStatus.percentageUsed,
        monthlyData: budgetStatus.monthlyData
      };
      
      console.log(`🚨 Sending ${budgetStatus.alertType} budget alert to ${user.email}`);
      
      // Send alert email
      const emailResult = await emailService.sendBudgetAlert(
        user.email, 
        user.name, 
        alertData
      );
      
      if (emailResult.success) {
        // Update last alert sent timestamp
        await budgetTrackingService.updateLastAlertSent(userId, budgetStatus.alertType);

        // Create notification for budget alert
        const notification = new Notification({
          userId: user._id,
          title: budgetStatus.alertType === 'critical' ? 'Critical Budget Alert' : 'Budget Warning',
          message: budgetStatus.alertType === 'critical' 
            ? 'You have reached the critical spending threshold for this month.' 
            : 'You are approaching your monthly budget limit.',
          type: budgetStatus.alertType === 'critical' ? 'error' : 'warning',
          read: false
        });
        await notification.save();
        
        console.log(`✅ Budget alert sent successfully and notification created`);
        return {
          success: true,
          alertSent: true,
          alertType: budgetStatus.alertType,
          emailResult,
          budgetStatus
        };
      } else {
        console.error('❌ Failed to send budget alert email');
        return {
          success: false,
          alertSent: false,
          error: 'Failed to send email',
          emailError: emailResult.error
        };
      }
    } catch (error) {
      console.error('❌ Error in budget alert check:', error);
      return {
        success: false,
        alertSent: false,
        error: error.message
      };
    }
  }
  
  /**
   * Check budgets for all users (for scheduled tasks)
   * @returns {Object} Summary of alert checks
   */
  async checkAllUserBudgets() {
    try {
      console.log('🔄 Starting budget alert check for all users');
      
      const users = await User.find({
        'monthlyBudget.amount': { $gt: 0 },
        'settings.budgetAlerts': true
      }).select('_id name email');
      
      console.log(`👥 Found ${users.length} users with budget alerts enabled`);
      
      const results = {
        totalUsers: users.length,
        alertsSent: 0,
        warnings: 0,
        critical: 0,
        errors: 0,
        details: []
      };
      
      for (const user of users) {
        try {
          const result = await this.checkAndSendBudgetAlert(user._id);
          
          results.details.push({
            userId: user._id,
            userName: user.name,
            email: user.email,
            ...result
          });
          
          if (result.alertSent) {
            results.alertsSent++;
            if (result.alertType === 'warning') {
              results.warnings++;
            } else if (result.alertType === 'critical') {
              results.critical++;
            }
          }
          
          if (!result.success) {
            results.errors++;
          }
          
          // Add small delay between users to avoid overwhelming email service
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(`❌ Error checking budget for user ${user._id}:`, error);
          results.errors++;
          results.details.push({
            userId: user._id,
            userName: user.name,
            email: user.email,
            success: false,
            error: error.message
          });
        }
      }
      
      console.log(`📊 Budget alert check complete:`); 
      console.log(`   📤 Alerts sent: ${results.alertsSent}`);
      console.log(`   ⚠️  Warnings: ${results.warnings}`);
      console.log(`   🚨 Critical: ${results.critical}`);
      console.log(`   ❌ Errors: ${results.errors}`);
      
      return results;
    } catch (error) {
      console.error('❌ Error in bulk budget alert check:', error);
      throw error;
    }
  }
  
  /**
   * Get budget alert summary for a user (for API endpoints)
   * @param {string} userId - User ID
   * @returns {Object} Budget alert summary
   */
  async getBudgetAlertSummary(userId) {
    try {
      const budgetStatus = await budgetTrackingService.checkBudgetStatus(userId);
      
      if (!budgetStatus.budgetSet) {
        return {
          budgetSet: false,
          alertsEnabled: false,
          currentStatus: 'no_budget'
        };
      }
      
      const user = await User.findById(userId).select('settings.budgetAlerts monthlyBudget.lastAlertSent');
      
      return {
        budgetSet: true,
        alertsEnabled: user.settings.budgetAlerts,
        currentStatus: budgetStatus.alertLevel,
        percentageUsed: budgetStatus.percentageUsed,
        shouldSendAlert: budgetStatus.shouldSendAlert,
        lastAlerts: {
          warning: user.monthlyBudget.lastAlertSent?.warning,
          critical: user.monthlyBudget.lastAlertSent?.critical
        },
        thresholds: budgetStatus.thresholds
      };
    } catch (error) {
      console.error('Error getting budget alert summary:', error);
      throw error;
    }
  }
}

module.exports = new BudgetAlertService();
