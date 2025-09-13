const cron = require('node-cron');
const monthlyReportService = require('../services/monthlyReportService');

// Schedule to run on 1st day of every month at 9:00 AM
const scheduleMonthlyReports = () => {
  cron.schedule('0 9 1 * *', async () => {
    console.log('🗓️ Running monthly report generation...');
    try {
      await monthlyReportService.generateMonthlyReports();
      console.log('✅ Monthly reports generated successfully');
    } catch (error) {
      console.error('❌ Error generating monthly reports:', error);
    }
  });

  console.log('📅 Monthly report scheduler initialized - runs 1st of every month at 9:00 AM');
};

// Manual trigger for testing
const triggerMonthlyReports = async () => {
  console.log('🔧 Manually triggering monthly reports...');
  try {
    await monthlyReportService.generateMonthlyReports();
    console.log('✅ Manual monthly reports completed');
  } catch (error) {
    console.error('❌ Error in manual monthly reports:', error);
  }
};

module.exports = { scheduleMonthlyReports, triggerMonthlyReports };