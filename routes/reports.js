const express = require('express');
const auth = require('../middleware/auth');
const monthlyReportService = require('../services/monthlyReportService');
const reportGeneratorService = require('../services/reportGeneratorService');
const User = require('../models/User');
const fs = require('fs');
const router = express.Router();

// Get monthly reports list
router.get('/monthly', auth, async (req, res) => {
  try {
    const reports = [];
    const currentDate = new Date();
    
    // Generate last 12 months
    for (let i = 0; i < 12; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const reportData = await monthlyReportService.getUserReportData(req.userId, date);
      
      if (reportData.hasData) {
        reports.push({
          month: date.toLocaleString('default', { month: 'long', year: 'numeric' }),
          year: date.getFullYear(),
          monthNumber: date.getMonth() + 1,
          ...reportData
        });
      }
    }
    
    res.json(reports);
  } catch (error) {
    console.error('Error fetching monthly reports:', error);
    res.status(500).json({ message: 'Failed to fetch reports' });
  }
});

// Download monthly report
router.get('/monthly/:year/:month/download', auth, async (req, res) => {
  try {
    const { year, month } = req.params;
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    const reportData = await monthlyReportService.getUserReportData(req.userId, date);
    
    if (!reportData.hasData) {
      return res.status(404).json({ message: 'No data available for this month' });
    }
    
    const user = await User.findById(req.userId);
    const format = user.settings?.reportFormat || 'excel';
    
    let filePath, fileName;
    
    if (format === 'pdf') {
      const result = await reportGeneratorService.generatePDFReport(reportData, user.email);
      filePath = result.filePath;
      fileName = result.fileName;
    } else {
      const result = await reportGeneratorService.generateExcelReport(reportData, user.email);
      filePath = result.filePath;
      fileName = result.fileName;
    }
    
    const contentType = format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    res.setHeader('Content-Type', contentType);
    res.download(filePath, fileName, (err) => {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });
    
  } catch (error) {
    console.error('Error downloading report:', error);
    res.status(500).json({ message: 'Failed to generate report' });
  }
});

module.exports = router;