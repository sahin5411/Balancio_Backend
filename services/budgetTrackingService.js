const Transaction = require('../models/Transaction');
const User = require('../models/User');

class BudgetTrackingService {
  /**
   * Calculate monthly expenses for a user
   * @param {string} userId - User ID
   * @param {number} month - Month (1-12)
   * @param {number} year - Year
   * @returns {Object} Monthly expense data
   */
  async getMonthlyExpenses(userId, month = null, year = null) {
    try {
      const now = new Date();
      const targetMonth = month || (now.getMonth() + 1);
      const targetYear = year || now.getFullYear();
      
      // Calculate start and end dates for the month
      const startDate = new Date(targetYear, targetMonth - 1, 1);
      const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);
      
      console.log(`📊 Calculating expenses for ${targetMonth}/${targetYear} (${startDate.toDateString()} - ${endDate.toDateString()})`);
      
      const expenses = await Transaction.aggregate([
        {
          $match: {
            userId: userId,
            type: 'expense',
            date: {
              $gte: startDate,
              $lte: endDate
            }
          }
        },
        {
          $group: {
            _id: null,
            totalExpenses: { $sum: '$amount' },
            transactionCount: { $sum: 1 },
            transactions: { $push: '$$ROOT' }
          }
        }
      ]);
      
      const result = {
        month: targetMonth,
        year: targetYear,
        totalExpenses: expenses.length > 0 ? expenses[0].totalExpenses : 0,
        transactionCount: expenses.length > 0 ? expenses[0].transactionCount : 0,
        transactions: expenses.length > 0 ? expenses[0].transactions : [],
        period: {
          startDate,
          endDate
        }
      };
      
      console.log(`💰 Monthly expenses: $${result.totalExpenses} (${result.transactionCount} transactions)`);
      return result;
    } catch (error) {
      console.error('Error calculating monthly expenses:', error);
      throw error;
    }
  }
  
  /**
   * Check if user has exceeded budget thresholds
   * @param {string} userId - User ID
   * @returns {Object} Budget status and alert info
   */
  async checkBudgetStatus(userId) {
    try {
      console.log(`🔍 Checking budget status for user: ${userId}`);
      
      const user = await User.findById(userId);
      if (!user || !user.monthlyBudget || user.monthlyBudget.amount === 0) {
        console.log('❌ No budget set for user');
        return {
          budgetSet: false,
          message: 'No monthly budget set'
        };
      }
      
      const monthlyData = await this.getMonthlyExpenses(userId);
      const budget = user.monthlyBudget.amount;
      const spent = monthlyData.totalExpenses;
      const percentageUsed = (spent / budget) * 100;
      
      const warningThreshold = user.monthlyBudget.alertThresholds.warning;
      const criticalThreshold = user.monthlyBudget.alertThresholds.critical;
      
      let alertLevel = 'safe';
      let shouldSendAlert = false;
      let alertType = null;
      
      const now = new Date();
      const lastWarningAlert = user.monthlyBudget.lastAlertSent?.warning;
      const lastCriticalAlert = user.monthlyBudget.lastAlertSent?.critical;
      
      // Check if we need to send alerts (only once per day for each threshold)
      const isNewDay = (lastAlert) => {
        if (!lastAlert) return true;
        const lastAlertDate = new Date(lastAlert);
        return now.toDateString() !== lastAlertDate.toDateString();
      };
      
      if (percentageUsed >= criticalThreshold) {
        alertLevel = 'critical';
        if (isNewDay(lastCriticalAlert)) {
          shouldSendAlert = true;
          alertType = 'critical';
        }
      } else if (percentageUsed >= warningThreshold) {
        alertLevel = 'warning';
        if (isNewDay(lastWarningAlert)) {
          shouldSendAlert = true;
          alertType = 'warning';
        }
      }
      
      const result = {
        budgetSet: true,
        budget,
        spent,
        remaining: Math.max(0, budget - spent),
        percentageUsed: Math.round(percentageUsed * 100) / 100,
        alertLevel,
        shouldSendAlert,
        alertType,
        thresholds: {
          warning: warningThreshold,
          critical: criticalThreshold
        },
        monthlyData
      };
      
      console.log(`📈 Budget Status: ${percentageUsed.toFixed(1)}% used (${alertLevel})`);
      console.log(`💸 Spent: $${spent} / Budget: $${budget}`);
      
      return result;
    } catch (error) {
      console.error('Error checking budget status:', error);
      throw error;
    }
  }
  
  /**
   * Get budget overview with category breakdown
   * @param {string} userId - User ID
   * @returns {Object} Detailed budget overview
   */
  async getBudgetOverview(userId) {
    try {
      const budgetStatus = await this.checkBudgetStatus(userId);
      
      if (!budgetStatus.budgetSet) {
        return budgetStatus;
      }
      
      // Get category breakdown
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      
      const categoryBreakdown = await Transaction.aggregate([
        {
          $match: {
            userId: userId,
            type: 'expense',
            date: {
              $gte: startDate,
              $lte: endDate
            }
          }
        },
        {
          $lookup: {
            from: 'categories',
            localField: 'categoryId',
            foreignField: '_id',
            as: 'category'
          }
        },
        {
          $group: {
            _id: '$categoryId',
            categoryName: { $first: { $arrayElemAt: ['$category.name', 0] } },
            totalAmount: { $sum: '$amount' },
            transactionCount: { $sum: 1 }
          }
        },
        {
          $sort: { totalAmount: -1 }
        }
      ]);
      
      return {
        ...budgetStatus,
        categoryBreakdown: categoryBreakdown.map(cat => ({
          categoryId: cat._id,
          categoryName: cat.categoryName || 'Uncategorized',
          amount: cat.totalAmount,
          percentage: Math.round((cat.totalAmount / budgetStatus.spent) * 100 * 100) / 100,
          transactionCount: cat.transactionCount
        }))
      };
    } catch (error) {
      console.error('Error getting budget overview:', error);
      throw error;
    }
  }
  
  /**
   * Update last alert sent timestamp
   * @param {string} userId - User ID
   * @param {string} alertType - 'warning' or 'critical'
   */
  async updateLastAlertSent(userId, alertType) {
    try {
      const updateField = `monthlyBudget.lastAlertSent.${alertType}`;
      await User.findByIdAndUpdate(userId, {
        [updateField]: new Date()
      });
      console.log(`✅ Updated last ${alertType} alert timestamp for user ${userId}`);
    } catch (error) {
      console.error('Error updating last alert sent:', error);
      throw error;
    }
  }
}

module.exports = new BudgetTrackingService();