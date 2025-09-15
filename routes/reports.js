const express = require('express');
const auth = require('../middleware/auth');
const monthlyReportService = require('../services/monthlyReportService');
const reportGeneratorService = require('../services/reportGeneratorService');
const User = require('../models/User');
const fs = require('fs');
const router = express.Router();

/**
 * @swagger
 * /api/reports/monthly:
 *   get:
 *     summary: Get list of monthly reports for the authenticated user
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of monthly reports
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   month:
 *                     type: string
 *                   year:
 *                     type: number
 *                   monthNumber:
 *                     type: number
 *                   hasData:
 *                     type: boolean
 *                   totalIncome:
 *                     type: number
 *                   totalExpenses:
 *                     type: number
 *                   netSavings:
 *                     type: number
 *       500:
 *         description: Internal server error
 */
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

/**
 * @swagger
 * /api/reports/monthly/{year}/{month}/download:
 *   get:
 *     summary: Download monthly report for a specific year and month
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: year
 *         required: true
 *         schema:
 *           type: integer
 *         description: Year of the report
 *       - in: path
 *         name: month
 *         required: true
 *         schema:
 *           type: integer
 *         description: Month of the report (1-12)
 *     responses:
 *       200:
 *         description: Report file download
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: No data available for this month
 *       500:
 *         description: Internal server error
 */
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