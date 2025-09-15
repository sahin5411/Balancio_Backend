const express = require('express');
const Transaction = require('../models/Transaction');
const auth = require('../middleware/auth');
const budgetAlertService = require('../services/budgetAlertService');
const router = express.Router();

/**
 * @swagger
 * /api/transactions:
 *   get:
 *     summary: Get all transactions for the authenticated user
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of transactions
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Transaction'
 *       500:
 *         description: Internal server error
 */
router.get('/', auth, async (req, res) => {
  try {
    const transactions = await Transaction.find({ userId: req.userId }).sort({ date: -1 });
    res.json(transactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ message: 'Failed to fetch transactions' });
  }
});

/**
 * @swagger
 * /api/transactions:
 *   post:
 *     summary: Create a new transaction
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - amount
 *               - type
 *             properties:
 *               title:
 *                 type: string
 *               amount:
 *                 type: number
 *                 minimum: 0.01
 *               type:
 *                 type: string
 *                 enum: [income, expense]
 *               categoryId:
 *                 type: string
 *               date:
 *                 type: string
 *                 format: date
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Transaction created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Transaction'
 *       400:
 *         description: Bad request
 *       500:
 *         description: Internal server error
 */
router.post('/', auth, async (req, res) => {
  try {
    const { title, amount, type, categoryId } = req.body;
    
    if (!title || !amount || !type) {
      return res.status(400).json({ message: 'Title, amount, and type are required' });
    }
    
    if (amount <= 0) {
      return res.status(400).json({ message: 'Amount must be greater than 0' });
    }
    
    if (!['income', 'expense'].includes(type)) {
      return res.status(400).json({ message: 'Type must be either income or expense' });
    }
    
    const transaction = new Transaction({ ...req.body, userId: req.userId });
    await transaction.save();
    
    // Check budget after creating expense transaction
    if (type === 'expense') {
      try {
        console.log('🔍 Checking budget after expense transaction');
        await budgetAlertService.checkAndSendBudgetAlert(req.userId);
      } catch (budgetError) {
        console.error('❌ Error checking budget after transaction:', budgetError);
        // Don't fail the transaction creation if budget check fails
      }
    }
    
    res.status(201).json(transaction);
  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(500).json({ message: 'Failed to create transaction' });
  }
});

/**
 * @swagger
 * /api/transactions/{id}:
 *   put:
 *     summary: Update a transaction
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Transaction ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               amount:
 *                 type: number
 *               type:
 *                 type: string
 *                 enum: [income, expense]
 *               categoryId:
 *                 type: string
 *               date:
 *                 type: string
 *                 format: date
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Transaction updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Transaction'
 *       400:
 *         description: Bad request
 *       404:
 *         description: Transaction not found
 *       500:
 *         description: Internal server error
 */
router.put('/:id', auth, async (req, res) => {
  try {
    const transaction = await Transaction.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      req.body,
      { new: true }
    );
    
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }
    
    // Check budget after updating expense transaction
    if (transaction.type === 'expense') {
      try {
        console.log('🔍 Checking budget after expense transaction update');
        await budgetAlertService.checkAndSendBudgetAlert(req.userId);
      } catch (budgetError) {
        console.error('❌ Error checking budget after transaction update:', budgetError);
        // Don't fail the transaction update if budget check fails
      }
    }
    
    res.json(transaction);
  } catch (error) {
    console.error('Error updating transaction:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid transaction ID' });
    }
    res.status(500).json({ message: 'Failed to update transaction' });
  }
});

/**
 * @swagger
 * /api/transactions/{id}:
 *   delete:
 *     summary: Delete a transaction
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Transaction ID
 *     responses:
 *       200:
 *         description: Transaction deleted successfully
 *       404:
 *         description: Transaction not found
 *       500:
 *         description: Internal server error
 */
router.delete('/:id', auth, async (req, res) => {
  try {
    const transaction = await Transaction.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }
    
    res.json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid transaction ID' });
    }
    res.status(500).json({ message: 'Failed to delete transaction' });
  }
});

/**
 * @swagger
 * /api/transactions/export:
 *   get:
 *     summary: Export all transactions for the authenticated user in Excel or PDF format, grouped by year and month
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: fileType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [excel, pdf]
 *         description: Export file type
 *     responses:
 *       200:
 *         description: File exported successfully
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Invalid file type
 *       500:
 *         description: Internal server error
 */
router.get('/export', auth, async (req, res) => {
  try {
    const { fileType } = req.query;

    if (!['excel', 'pdf'].includes(fileType)) {
      return res.status(400).json({ message: 'Invalid file type. Must be excel or pdf' });
    }

    // Get all transactions for the user
    const transactions = await Transaction.find({ userId: req.userId }).populate('categoryId', 'name').sort({ date: -1 });

    if (fileType === 'excel') {
      const ExcelJS = require('exceljs');
      const workbook = new ExcelJS.Workbook();

      // Group transactions by year and month
      const grouped = transactions.reduce((acc, transaction) => {
        const date = new Date(transaction.date);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const key = `${year}-${month.toString().padStart(2, '0')}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(transaction);
        return acc;
      }, {});

      if (Object.keys(grouped).length === 0) {
        // No transactions, add a default sheet
        const worksheet = workbook.addWorksheet('No Transactions');
        worksheet.addRow(['No transactions found']);
      } else {
        // Create sheets for each month/year
        Object.keys(grouped).sort().reverse().forEach(key => {
          const [year, month] = key.split('-');
          const worksheet = workbook.addWorksheet(`${year}-${month}`);

          // Add headers
          worksheet.columns = [
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Title', key: 'title', width: 30 },
            { header: 'Amount', key: 'amount', width: 15 },
            { header: 'Type', key: 'type', width: 10 },
            { header: 'Category', key: 'category', width: 20 },
            { header: 'Description', key: 'description', width: 30 }
          ];

          // Style headers
          worksheet.getRow(1).font = { bold: true };
          worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE6E6FA' }
          };

          // Add data
          grouped[key].forEach(transaction => {
            worksheet.addRow({
              date: new Date(transaction.date).toLocaleDateString(),
              title: transaction.title,
              amount: transaction.amount,
              type: transaction.type,
              category: transaction.categoryId ? transaction.categoryId.name : 'No Category',
              description: transaction.description || ''
            });
          });
        });
      }

      // Set response headers
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=transactions_export.xlsx');

      // Write to response
      await workbook.xlsx.write(res);
      res.end();

    } else if (fileType === 'pdf') {
      const puppeteer = require('puppeteer');

      // Group transactions by year and month
      const grouped = transactions.reduce((acc, transaction) => {
        const date = new Date(transaction.date);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const key = `${year}-${month.toString().padStart(2, '0')}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(transaction);
        return acc;
      }, {});

      // Generate HTML content
      let htmlContent = `
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #333; text-align: center; }
            h2 { color: #666; border-bottom: 2px solid #ccc; padding-bottom: 5px; margin-top: 30px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            .income { color: green; }
            .expense { color: red; }
          </style>
        </head>
        <body>
          <h1>Transaction Export</h1>
      `;

      Object.keys(grouped).sort().reverse().forEach(key => {
        const [year, month] = key.split('-');
        const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });
        htmlContent += `<h2>${monthName} ${year}</h2>`;
        htmlContent += `
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Title</th>
                <th>Amount</th>
                <th>Type</th>
                <th>Category</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
        `;

        grouped[key].forEach(transaction => {
          htmlContent += `
            <tr>
              <td>${new Date(transaction.date).toLocaleDateString()}</td>
              <td>${transaction.title}</td>
              <td class="${transaction.type}">${transaction.amount}</td>
              <td>${transaction.type}</td>
              <td>${transaction.categoryId ? 'Category ID: ' + transaction.categoryId : 'No Category'}</td>
              <td>${transaction.description || ''}</td>
            </tr>
          `;
        });

        htmlContent += `
            </tbody>
          </table>
        `;
      });

      htmlContent += `
        </body>
        </html>
      `;

      // Generate PDF
      const browser = await puppeteer.launch();
      const page = await browser.newPage();
      await page.setContent(htmlContent);
      const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
      await browser.close();

      // Set response headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=transactions_export.pdf');
      res.send(pdfBuffer);
    }

  } catch (error) {
    console.error('Error exporting transactions:', error);
    res.status(500).json({ message: 'Failed to export transactions' });
  }
});

module.exports = router;
