const ExcelJS = require('exceljs');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

class ReportGeneratorService {
  async generateExcelReport(reportData, userEmail) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Financial Report');

    // Header with styling
    worksheet.mergeCells('A1:F1');
    worksheet.getCell('A1').value = `Monthly Financial Report - ${reportData.month}`;
    worksheet.getCell('A1').font = { size: 18, bold: true, color: { argb: 'FFFFFF' } };
    worksheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '4472C4' } };
    worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 35;

    // Summary Section with professional styling
    worksheet.addRow([]);
    worksheet.mergeCells('A3:F3');
    worksheet.getCell('A3').value = 'FINANCIAL SUMMARY';
    worksheet.getCell('A3').font = { size: 14, bold: true, color: { argb: '2F5597' } };
    worksheet.getCell('A3').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E7F3FF' } };
    worksheet.getCell('A3').alignment = { horizontal: 'center' };
    
    worksheet.addRow([]);
    worksheet.addRow(['Metric', 'Amount', 'Percentage', 'Status', '', 'Insights']);
    worksheet.getRow(5).font = { bold: true, color: { argb: 'FFFFFF' } };
    worksheet.getRow(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '70AD47' } };
    
    const savingsRate = ((reportData.netSavings / (reportData.totalIncome || 1)) * 100).toFixed(1);
    worksheet.addRow(['Total Income', reportData.totalIncome, '100%', '✓', '', 'Primary income source']);
    worksheet.addRow(['Total Expenses', reportData.totalExpenses, `${((reportData.totalExpenses / (reportData.totalIncome || 1)) * 100).toFixed(1)}%`, reportData.totalExpenses < reportData.totalIncome ? '✓' : '⚠', '', 'Monitor spending']);
    worksheet.addRow(['Net Savings', Math.abs(reportData.netSavings), `${savingsRate}%`, reportData.netSavings >= 0 ? '✓' : '❌', '', reportData.netSavings >= 0 ? 'Great savings!' : 'Reduce expenses']);
    worksheet.addRow(['Transactions', reportData.transactionCount, '', '📊', '', `Avg: $${(reportData.totalExpenses / reportData.transactionCount || 0).toFixed(2)}`]);

    // Category Breakdown Section
    worksheet.addRow([]);
    worksheet.mergeCells('A10:F10');
    worksheet.getCell('A10').value = 'CATEGORY BREAKDOWN';
    worksheet.getCell('A10').font = { size: 14, bold: true, color: { argb: '2F5597' } };
    worksheet.getCell('A10').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E7F3FF' } };
    worksheet.getCell('A10').alignment = { horizontal: 'center' };
    
    worksheet.addRow([]);
    worksheet.addRow(['Category', 'Amount', 'Percentage', 'Rank', 'Budget Impact', 'Recommendation']);
    worksheet.getRow(12).font = { bold: true, color: { argb: 'FFFFFF' } };
    worksheet.getRow(12).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'C5504B' } };
    
    reportData.topCategories.forEach(([category, amount], index) => {
      const percentage = ((amount / reportData.totalExpenses) * 100).toFixed(1);
      const rank = index + 1;
      const impact = percentage > 30 ? 'High' : percentage > 15 ? 'Medium' : 'Low';
      const recommendation = percentage > 30 ? 'Review & optimize' : percentage > 15 ? 'Monitor closely' : 'Well controlled';
      
      worksheet.addRow([category, amount, `${percentage}%`, `#${rank}`, impact, recommendation]);
    });

    // Financial Insights Section
    const insightsStartRow = worksheet.rowCount + 2;
    worksheet.mergeCells(`A${insightsStartRow}:F${insightsStartRow}`);
    worksheet.getCell(`A${insightsStartRow}`).value = 'FINANCIAL INSIGHTS & RECOMMENDATIONS';
    worksheet.getCell(`A${insightsStartRow}`).font = { size: 14, bold: true, color: { argb: '2F5597' } };
    worksheet.getCell(`A${insightsStartRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E7F3FF' } };
    worksheet.getCell(`A${insightsStartRow}`).alignment = { horizontal: 'center' };
    
    worksheet.addRow([]);
    worksheet.addRow(['Insight', 'Value', 'Analysis', '', '', 'Action Item']);
    worksheet.getRow(worksheet.rowCount).font = { bold: true, color: { argb: 'FFFFFF' } };
    worksheet.getRow(worksheet.rowCount).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '7030A0' } };
    
    worksheet.addRow(['Top Expense Category', reportData.topCategories[0] ? reportData.topCategories[0][0] : 'N/A', 'Highest spending area', '', '', 'Review for optimization']);
    worksheet.addRow(['Savings Rate', `${savingsRate}%`, savingsRate > 20 ? 'Excellent' : savingsRate > 10 ? 'Good' : 'Needs improvement', '', '', savingsRate < 10 ? 'Increase savings goal' : 'Maintain current rate']);
    worksheet.addRow(['Expense Ratio', `${((reportData.totalExpenses / (reportData.totalIncome || 1)) * 100).toFixed(1)}%`, 'Expense to income ratio', '', '', 'Target: Keep below 80%']);
    worksheet.addRow(['Transaction Frequency', reportData.transactionCount, 'Monthly activity level', '', '', 'Track spending patterns']);

    // Professional styling and formatting
    worksheet.columns = [
      { width: 25 },
      { width: 15 },
      { width: 15 },
      { width: 12 },
      { width: 15 },
      { width: 25 }
    ];

    // Add borders and formatting to all data cells
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
          if (typeof cell.value === 'number' && cell.value > 1) {
            cell.numFmt = '$#,##0.00';
          }
        });
      }
    });

    // Save file
    const fileName = `monthly-report-${reportData.month.replace(' ', '-')}-${Date.now()}.xlsx`;
    const filePath = path.join(__dirname, '../temp', fileName);
    
    // Ensure temp directory exists
    const tempDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    await workbook.xlsx.writeFile(filePath);
    return { filePath, fileName };
  }

  async generatePDFReport(reportData, userEmail) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; line-height: 1.6; }
          .container { max-width: 800px; margin: 0 auto; padding: 20px; }
          
          .header { text-align: center; margin-bottom: 40px; padding: 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 10px; }
          .header h1 { font-size: 32px; font-weight: 300; margin-bottom: 10px; }
          .header h2 { font-size: 24px; font-weight: 400; opacity: 0.9; }
          .header .period { font-size: 16px; opacity: 0.8; margin-top: 10px; }
          
          .summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 40px; }
          .summary-card { background: #f8f9fa; padding: 25px; border-radius: 10px; text-align: center; border-left: 5px solid; }
          .summary-card.income { border-left-color: #28a745; }
          .summary-card.expense { border-left-color: #dc3545; }
          .summary-card.savings { border-left-color: #007bff; grid-column: span 2; }
          .summary-card h3 { font-size: 14px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; color: #666; }
          .summary-card .amount { font-size: 28px; font-weight: bold; margin-bottom: 5px; }
          .summary-card.income .amount { color: #28a745; }
          .summary-card.expense .amount { color: #dc3545; }
          .summary-card.savings .amount { color: #007bff; }
          
          .section { margin-bottom: 40px; }
          .section-title { font-size: 20px; font-weight: 600; margin-bottom: 20px; color: #2c3e50; border-bottom: 2px solid #e9ecef; padding-bottom: 10px; }
          
          .category-table { width: 100%; border-collapse: collapse; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .category-table th { background: #495057; color: white; padding: 15px; text-align: left; font-weight: 600; }
          .category-table td { padding: 12px 15px; border-bottom: 1px solid #e9ecef; }
          .category-table .amount { text-align: right; font-weight: 600; }
          .category-table .percentage { text-align: center; color: #6c757d; font-size: 14px; }
          
          .progress-bar { width: 100%; height: 8px; background: #e9ecef; border-radius: 4px; overflow: hidden; margin-top: 5px; }
          .progress-fill { height: 100%; background: linear-gradient(90deg, #667eea, #764ba2); border-radius: 4px; }
          
          .insights { background: #e8f4f8; padding: 25px; border-radius: 10px; border-left: 5px solid #17a2b8; }
          .insights h3 { color: #17a2b8; margin-bottom: 15px; }
          .insights ul { list-style: none; }
          .insights li { margin-bottom: 8px; padding-left: 20px; position: relative; }
          .insights li:before { content: '•'; color: #17a2b8; font-weight: bold; position: absolute; left: 0; }
          
          .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e9ecef; color: #6c757d; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Financial Report</h1>
            <h2>${reportData.month}</h2>
            <div class="period">Generated on ${new Date().toLocaleDateString()}</div>
          </div>
          
          <div class="summary-grid">
            <div class="summary-card income">
              <h3>Total Income</h3>
              <div class="amount">$${reportData.totalIncome.toFixed(2)}</div>
              <div>${reportData.transactionCount} transactions</div>
            </div>
            
            <div class="summary-card expense">
              <h3>Total Expenses</h3>
              <div class="amount">$${reportData.totalExpenses.toFixed(2)}</div>
              <div>${((reportData.totalExpenses / (reportData.totalIncome || 1)) * 100).toFixed(1)}% of income</div>
            </div>
            
            <div class="summary-card savings">
              <h3>Net ${reportData.netSavings >= 0 ? 'Savings' : 'Deficit'}</h3>
              <div class="amount">$${Math.abs(reportData.netSavings).toFixed(2)}</div>
              <div>${reportData.netSavings >= 0 ? 'Great job saving money!' : 'Consider reducing expenses'}</div>
            </div>
          </div>
          
          <div class="section">
            <h3 class="section-title">Category Breakdown</h3>
            <table class="category-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Amount</th>
                  <th>% of Total</th>
                  <th>Spending Pattern</th>
                </tr>
              </thead>
              <tbody>
                ${reportData.topCategories.map(([category, amount]) => {
                  const percentage = ((amount / reportData.totalExpenses) * 100).toFixed(1);
                  return `
                    <tr>
                      <td><strong>${category}</strong></td>
                      <td class="amount">$${amount.toFixed(2)}</td>
                      <td class="percentage">${percentage}%</td>
                      <td>
                        <div class="progress-bar">
                          <div class="progress-fill" style="width: ${percentage}%"></div>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
          
          <div class="insights">
            <h3>Financial Insights</h3>
            <ul>
              <li>Your largest expense category is <strong>${reportData.topCategories[0] ? reportData.topCategories[0][0] : 'N/A'}</strong></li>
              <li>You ${reportData.netSavings >= 0 ? 'saved' : 'overspent by'} <strong>$${Math.abs(reportData.netSavings).toFixed(2)}</strong> this month</li>
              <li>Average transaction amount: <strong>$${(reportData.totalExpenses / reportData.transactionCount || 0).toFixed(2)}</strong></li>
              <li>Savings rate: <strong>${((reportData.netSavings / (reportData.totalIncome || 1)) * 100).toFixed(1)}%</strong></li>
            </ul>
          </div>
          
          <div class="footer">
            <p>Generated by Balancio Financial Management System</p>
            <p>This report is confidential and intended for personal use only.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    await page.setContent(htmlContent);
    
    const fileName = `monthly-report-${reportData.month.replace(' ', '-')}-${Date.now()}.pdf`;
    const filePath = path.join(__dirname, '../temp', fileName);
    
    await page.pdf({ path: filePath, format: 'A4', printBackground: true });
    await browser.close();
    
    return { filePath, fileName };
  }
}

module.exports = new ReportGeneratorService();