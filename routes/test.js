const express = require('express');
const { triggerMonthlyReports } = require('../scheduler/monthlyReportScheduler');
const router = express.Router();

// Test route to manually trigger monthly reports
router.post('/monthly-reports', async (req, res) => {
  try {
    await triggerMonthlyReports();
    res.json({ success: true, message: 'Monthly reports triggered successfully' });
  } catch (error) {
    console.error('Error triggering monthly reports:', error);
    res.status(500).json({ success: false, message: 'Failed to trigger monthly reports' });
  }
});

module.exports = router;