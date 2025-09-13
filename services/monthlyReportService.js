const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Category = require('../models/Category');
const emailService = require('./emailService');
const reportGeneratorService = require('./reportGeneratorService');
const fs = require('fs');

class MonthlyReportService {
  async generateMonthlyReports() {
    try {
      console.log('🔍 Looking for users with monthly reports enabled...');
      const users = await User.find({
        $or: [
          { 'settings.monthlyReports': true },
          { 'settings.monthlyReports': { $exists: false } }
        ]
      });
      console.log(`📊 Found ${users.length} users with monthly reports enabled`);
      
      for (const user of users) {
        console.log(`📧 Processing user: ${user.email}`);
        const reportData = await this.getUserReportData(user._id);
        console.log(`📈 Report data for ${user.email}:`, { hasData: reportData.hasData, transactionCount: reportData.transactionCount || 0 });
        
        if (reportData.hasData) {
          try {
            const reportFormat = user.settings?.reportFormat || 'excel';
            let filePath;
            
            if (reportFormat === 'pdf') {
              const result = await reportGeneratorService.generatePDFReport(reportData, user.email);
              filePath = result.filePath;
            } else {
              const result = await reportGeneratorService.generateExcelReport(reportData, user.email);
              filePath = result.filePath;
            }
            
            console.log(`📤 Sending ${reportFormat} report to ${user.email}`);
            await emailService.sendMonthlyReport(user.email, user.name, reportData, filePath);
            console.log(`✅ Report sent successfully to ${user.email}`);
            
            // Clean up temp file
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
          } catch (error) {
            console.error(`❌ Error generating report for ${user.email}:`, error);
            // Send email without attachment if generation fails
            try {
              await emailService.sendMonthlyReport(user.email, user.name, reportData);
              console.log(`📧 Fallback email sent to ${user.email}`);
            } catch (emailError) {
              console.error(`❌ Failed to send fallback email to ${user.email}:`, emailError);
            }
          }
        } else {
          console.log(`⏭️ No data available for ${user.email}, skipping...`);
        }
      }
    } catch (error) {
      console.error('Error generating monthly reports:', error);
    }
  }

  async getUserReportData(userId, targetDate = null) {
    const reportDate = targetDate || new Date();
    if (!targetDate) {
      reportDate.setMonth(reportDate.getMonth() - 1);
    }
    const startDate = new Date(reportDate.getFullYear(), reportDate.getMonth(), 1);
    const endDate = new Date(reportDate.getFullYear(), reportDate.getMonth() + 1, 0);

    console.log(`🔍 Searching transactions for user ${userId}`);
    console.log(`📅 Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
    
    const transactions = await Transaction.find({
      userId,
      date: { $gte: startDate, $lte: endDate }
    });
    
    console.log(`📊 Found ${transactions.length} transactions for user ${userId}`);
    
    // Also check all transactions for this user
    const allTransactions = await Transaction.find({ userId });
    console.log(`📈 Total transactions for user ${userId}: ${allTransactions.length}`);
    if (allTransactions.length > 0) {
      console.log(`📅 Transaction dates:`, allTransactions.map(t => t.date.toISOString()));
    }

    if (transactions.length === 0) {
      return { hasData: false };
    }

    const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const netSavings = totalIncome - totalExpenses;

    const categories = await Category.find({ userId });
    const categorySpending = {};
    
    transactions.filter(t => t.type === 'expense').forEach(t => {
      const category = categories.find(c => c._id.toString() === t.categoryId);
      const categoryName = category ? category.name : 'Other';
      categorySpending[categoryName] = (categorySpending[categoryName] || 0) + t.amount;
    });

    const topCategories = Object.entries(categorySpending)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3);

    return {
      hasData: true,
      month: reportDate.toLocaleString('default', { month: 'long', year: 'numeric' }),
      totalIncome,
      totalExpenses,
      netSavings,
      transactionCount: transactions.length,
      topCategories
    };
  }
}

module.exports = new MonthlyReportService();