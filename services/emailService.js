const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    console.log('🔧 SMTP Configuration:');
    console.log('📧 SMTP_USER:', process.env.SMTP_USER ? '✅ Set' : '❌ Missing');
    console.log('🔑 SMTP_PASS:', process.env.SMTP_PASS ? '✅ Set' : '❌ Missing');
    console.log('🏠 SMTP_HOST:', process.env.SMTP_HOST || 'Using default');
    console.log('🚪 SMTP_PORT:', process.env.SMTP_PORT || 'Using default');
    
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
    
    // Test connection
    this.transporter.verify((error, success) => {
      if (error) {
        console.log('❌ SMTP Connection Error:', error.message);
      } else {
        console.log('✅ SMTP Server is ready to take our messages');
      }
    });
  }

  async sendWelcomeEmail(email, name) {
    const mailOptions = {
      from: process.env.FROM_EMAIL || 'noreply@balancio.com',
      to: email,
      subject: 'Welcome to Balancio!',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to Balancio</title>
          <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            
            <!-- Header -->
            <div style="background-color: #2563eb; padding: 40px 30px; text-align: center;">
              <h1 style="color: white; font-size: 36px; font-weight: 700; margin: 0; letter-spacing: -1px;">Balancio</h1>
              <p style="color: rgba(255, 255, 255, 0.9); font-size: 16px; margin: 8px 0 0 0;">Personal Finance Manager</p>
            </div>
            
            <!-- Content -->
            <div style="padding: 40px 30px;">
              <h2 style="color: #1f2937; font-size: 24px; font-weight: 600; margin: 0 0 16px 0; text-align: center;">Welcome to Balancio, ${name}!</h2>
              
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 32px 0; text-align: center;">Thank you for joining our platform. We're here to help you take control of your finances and achieve your financial goals.</p>
              
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; margin: 32px 0;">
                <h3 style="color: #1f2937; font-size: 18px; font-weight: 600; margin: 0 0 16px 0;">Get Started:</h3>
                <ul style="color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0; padding-left: 20px;">
                  <li style="margin-bottom: 8px;">Track your expenses and income</li>
                  <li style="margin-bottom: 8px;">Create custom categories</li>
                  <li style="margin-bottom: 8px;">Set budget goals</li>
                  <li style="margin-bottom: 0;">View detailed reports</li>
                </ul>
              </div>
              
              <div style="text-align: center; margin: 32px 0;">
                <a href="${process.env.APP_URL || 'http://localhost:4200'}/dashboard" style="display: inline-block; background-color: #2563eb; color: white; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: 500; font-size: 16px;">Get Started</a>
              </div>
              
              <p style="color: #6b7280; font-size: 14px; line-height: 1.5; margin: 32px 0 0 0; text-align: center;">Need help? Contact us at support@balancio.com</p>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #f8fafc; padding: 24px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
              <div style="margin-bottom: 16px;">
                <div style="color: #2563eb; font-size: 18px; font-weight: 700;">B</div>
              </div>
              <p style="color: #6b7280; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} Balancio. All rights reserved.</p>
              <p style="color: #9ca3af; font-size: 11px; margin: 4px 0 0 0;">This email was sent to ${email}</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Welcome email sent successfully to:', email);
      console.log('📧 Message ID:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Failed to send welcome email to:', email);
      console.error('📋 Error details:', error.message);
      console.error('🔧 Check SMTP configuration in .env file');
      return { success: false, error: error.message };
    }
  }

  async sendPasswordChangeEmail(email, name) {
    const mailOptions = {
      from: process.env.FROM_EMAIL || 'noreply@balancio.com',
      to: email,
      subject: 'Password Changed Successfully',
      html: `
        <h2>Password Changed</h2>
        <p>Hi ${name},</p>
        <p>Your password has been successfully changed.</p>
        <p>If you didn't make this change, please contact support immediately.</p>
        <p>Best regards,<br>The Balancio Team</p>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log('Password change email sent to:', email);
    } catch (error) {
      console.error('Error sending password change email:', error);
    }
  }

  async sendTransactionAlert(email, name, transaction) {
    const mailOptions = {
      from: process.env.FROM_EMAIL || 'noreply@balancio.com',
      to: email,
      subject: 'New Transaction Alert',
      html: `
        <h2>Transaction Alert</h2>
        <p>Hi ${name},</p>
        <p>A new ${transaction.type} of $${transaction.amount} has been recorded.</p>
        <p>Description: ${transaction.description}</p>
        <p>Best regards,<br>The Balancio Team</p>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log('Transaction alert sent to:', email);
    } catch (error) {
      console.error('Error sending transaction alert:', error);
    }
  }

  async sendBudgetAlert(email, name, budgetData) {
    const {
      alertType,
      budget,
      spent,
      remaining,
      percentageUsed,
      monthlyData
    } = budgetData;
    
    const isWarning = alertType === 'warning';
    const isCritical = alertType === 'critical';
    
    const alertColor = isCritical ? '#dc2626' : '#f59e0b';
    const alertIcon = isCritical ? '🚨' : '⚠️';
    const alertTitle = isCritical ? 'Critical Budget Alert' : 'Budget Warning';
    const alertMessage = isCritical 
      ? 'You have reached the critical spending threshold for this month'
      : 'You are approaching your monthly budget limit';
    
    const progressBarWidth = Math.min(percentageUsed, 100);
    const progressBarColor = isCritical ? '#dc2626' : isWarning ? '#f59e0b' : '#10b981';
    
    const mailOptions = {
      from: process.env.FROM_EMAIL || 'noreply@balancio.com',
      to: email,
      subject: `${alertIcon} ${alertTitle} - Balancio Budget Alert`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${alertTitle} - Balancio</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            
            <!-- Header -->
            <div style="background-color: ${alertColor}; padding: 30px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 16px;">${alertIcon}</div>
              <h1 style="color: white; font-size: 28px; font-weight: 600; margin: 0;">${alertTitle}</h1>
              <p style="color: rgba(255, 255, 255, 0.9); font-size: 16px; margin: 8px 0 0 0;">Balancio Budget Alert</p>
            </div>
            
            <!-- Content -->
            <div style="padding: 40px 30px;">
              <h2 style="color: #1f2937; font-size: 24px; font-weight: 600; margin: 0 0 20px 0;">Hi ${name},</h2>
              
              <p style="color: #4b5563; font-size: 16px; margin: 0 0 30px 0; line-height: 1.6;">${alertMessage}. Here's your current spending summary:</p>
              
              <!-- Budget Progress -->
              <div style="background-color: #f8fafc; border: 2px solid ${alertColor}; border-radius: 12px; padding: 24px; margin: 30px 0;">
                <div style="text-align: center; margin-bottom: 20px;">
                  <h3 style="color: #1f2937; font-size: 18px; font-weight: 600; margin: 0 0 8px 0;">Monthly Budget Progress</h3>
                  <p style="color: #6b7280; font-size: 14px; margin: 0;">${monthlyData.month}/${monthlyData.year}</p>
                </div>
                
                <!-- Progress Bar -->
                <div style="background-color: #e5e7eb; border-radius: 8px; height: 12px; margin: 20px 0; overflow: hidden;">
                  <div style="background-color: ${progressBarColor}; height: 100%; width: ${progressBarWidth}%; transition: width 0.3s ease;"></div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px;">
                  <div style="text-align: center;">
                    <p style="color: #6b7280; font-size: 12px; font-weight: 600; margin: 0 0 4px 0; text-transform: uppercase;">Budget</p>
                    <p style="color: #1f2937; font-size: 20px; font-weight: 700; margin: 0;">$${budget.toFixed(2)}</p>
                  </div>
                  <div style="text-align: center;">
                    <p style="color: #6b7280; font-size: 12px; font-weight: 600; margin: 0 0 4px 0; text-transform: uppercase;">Spent</p>
                    <p style="color: ${alertColor}; font-size: 20px; font-weight: 700; margin: 0;">$${spent.toFixed(2)}</p>
                  </div>
                </div>
                
                <div style="text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                  <p style="color: #6b7280; font-size: 12px; font-weight: 600; margin: 0 0 4px 0; text-transform: uppercase;">Remaining</p>
                  <p style="color: ${remaining > 0 ? '#10b981' : '#dc2626'}; font-size: 24px; font-weight: 700; margin: 0;">$${remaining.toFixed(2)}</p>
                  <p style="color: #6b7280; font-size: 14px; margin: 8px 0 0 0;">${percentageUsed.toFixed(1)}% of budget used</p>
                </div>
              </div>
              
              <!-- Action Items -->
              <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 20px; margin: 30px 0;">
                <h3 style="color: #1d4ed8; font-size: 16px; font-weight: 600; margin: 0 0 12px 0;">💡 Recommended Actions:</h3>
                <ul style="color: #4b5563; font-size: 14px; line-height: 1.6; margin: 0; padding-left: 20px;">
                  ${isCritical 
                    ? '<li>Review and reduce non-essential expenses immediately</li><li>Consider adjusting your budget for next month</li><li>Look for opportunities to increase income</li>' 
                    : '<li>Review your recent expenses and identify areas to cut back</li><li>Consider postponing non-essential purchases</li><li>Track daily spending more closely</li>'
                  }
                </ul>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.APP_URL || 'http://localhost:4200'}/dashboard" style="display: inline-block; background-color: #2563eb; color: white; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: 500; font-size: 16px;">View Dashboard</a>
              </div>
              
              <p style="color: #6b7280; font-size: 13px; line-height: 1.5; margin: 20px 0 0 0; text-align: center;">You're receiving this alert because you have budget notifications enabled. You can manage your notification preferences in your account settings.</p>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #f8fafc; padding: 20px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="color: #6b7280; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} Balancio. All rights reserved.</p>
              <p style="color: #9ca3af; font-size: 11px; margin: 4px 0 0 0;">This alert was sent to ${email}</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Budget ${alertType} alert sent successfully to:`, email);
      console.log('📧 Message ID:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error(`❌ Failed to send budget ${alertType} alert to:`, email);
      console.error('📋 Error details:', error.message);
      return { success: false, error: error.message };
    }
  }

  async sendMonthlyReport(email, name, reportData, attachmentPath) {
    console.log(`📧 Preparing email for ${email}`);
    console.log(`📄 Attachment path: ${attachmentPath || 'No attachment'}`);
    
    const mailOptions = {
      from: process.env.FROM_EMAIL || 'noreply@balancio.com',
      to: email,
      subject: `Your ${reportData.month} Financial Report - Balancio`,
      attachments: attachmentPath ? [{
        filename: `Monthly-Report-${reportData.month.replace(' ', '-')}.${attachmentPath.includes('.pdf') ? 'pdf' : 'xlsx'}`,
        path: attachmentPath
      }] : [],
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Monthly Report - Balancio</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            
            <!-- Header -->
            <div style="background-color: #2563eb; padding: 30px; text-align: center;">
              <h1 style="color: white; font-size: 28px; font-weight: 600; margin: 0;">Balancio</h1>
              <p style="color: rgba(255, 255, 255, 0.9); font-size: 16px; margin: 8px 0 0 0;">Monthly Financial Report</p>
            </div>
            
            <!-- Content -->
            <div style="padding: 30px;">
              <h2 style="color: #1f2937; font-size: 24px; font-weight: 600; margin: 0 0 20px 0;">Hi ${name},</h2>
              
              <p style="color: #4b5563; font-size: 16px; margin: 0 0 30px 0;">Here's your financial summary for ${reportData.month}. Please find the detailed Excel report attached.</p>
              
              <!-- Stats Grid -->
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 30px 0;">
                <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; text-align: center;">
                  <h3 style="color: #15803d; font-size: 14px; font-weight: 600; margin: 0 0 8px 0; text-transform: uppercase;">Total Income</h3>
                  <p style="color: #166534; font-size: 24px; font-weight: 700; margin: 0;">$${reportData.totalIncome.toFixed(2)}</p>
                </div>
                
                <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; text-align: center;">
                  <h3 style="color: #dc2626; font-size: 14px; font-weight: 600; margin: 0 0 8px 0; text-transform: uppercase;">Total Expenses</h3>
                  <p style="color: #991b1b; font-size: 24px; font-weight: 700; margin: 0;">$${reportData.totalExpenses.toFixed(2)}</p>
                </div>
              </div>
              
              <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
                <h3 style="color: #1d4ed8; font-size: 14px; font-weight: 600; margin: 0 0 8px 0; text-transform: uppercase;">Net Savings</h3>
                <p style="color: #1e40af; font-size: 28px; font-weight: 700; margin: 0;">$${reportData.netSavings.toFixed(2)}</p>
              </div>
              
              <!-- Top Categories -->
              <div style="margin: 30px 0;">
                <h3 style="color: #1f2937; font-size: 18px; font-weight: 600; margin: 0 0 16px 0;">Top Spending Categories:</h3>
                ${reportData.topCategories.map(([category, amount]) => `
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                    <span style="color: #4b5563; font-size: 15px;">${category}</span>
                    <span style="color: #1f2937; font-weight: 600;">$${amount.toFixed(2)}</span>
                  </div>
                `).join('')}
              </div>
              
              <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 30px 0; text-align: center;">
                <p style="color: #4b5563; font-size: 14px; margin: 0 0 16px 0;">You made ${reportData.transactionCount} transactions this month</p>
                <a href="${process.env.APP_URL || 'http://localhost:4200'}/dashboard" style="display: inline-block; background-color: #2563eb; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500;">View Dashboard</a>
              </div>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="color: #6b7280; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} Balancio. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    console.log(`📤 Sending email to ${email} with ${mailOptions.attachments.length} attachment(s)`);
    
    try {
      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Monthly report sent successfully to: ${email}`);
      console.log(`📬 Message ID: ${result.messageId}`);
    } catch (error) {
      console.error(`❌ Error sending monthly report to ${email}:`, error.message);
      throw error;
    }
  }
}

module.exports = new EmailService();