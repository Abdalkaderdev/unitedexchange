/**
 * Email Service
 * Handles email sending functionality using nodemailer
 */
const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

// SMTP configuration from environment variables
const smtpConfig = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
};

// Default sender address
const defaultFrom = process.env.SMTP_FROM || 'noreply@unitedexchange.com';

// Create transporter instance
let transporter = null;

/**
 * Initialize the email transporter
 */
const initTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport(smtpConfig);
  }
  return transporter;
};

/**
 * Verify SMTP connection
 * @returns {Promise<boolean>} Connection status
 */
const verifyConnection = async () => {
  try {
    const transport = initTransporter();
    await transport.verify();
    logger.info('SMTP connection verified successfully');
    return true;
  } catch (error) {
    logger.error('SMTP connection verification failed:', { error: error.message });
    return false;
  }
};

/**
 * Send an email
 * @param {string|string[]} to - Recipient email address(es)
 * @param {string} subject - Email subject
 * @param {string} html - HTML content of the email
 * @param {Array} attachments - Optional attachments array
 * @returns {Promise<object>} Send result
 */
const sendEmail = async (to, subject, html, attachments = []) => {
  try {
    const transport = initTransporter();

    const mailOptions = {
      from: defaultFrom,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject,
      html,
      attachments
    };

    const result = await transport.sendMail(mailOptions);

    logger.info('Email sent successfully', {
      to: mailOptions.to,
      subject,
      messageId: result.messageId
    });

    return {
      success: true,
      messageId: result.messageId,
      accepted: result.accepted,
      rejected: result.rejected
    };
  } catch (error) {
    logger.error('Failed to send email', {
      to,
      subject,
      error: error.message
    });

    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Send a report email with attachment
 * @param {string|string[]} to - Recipient email address(es)
 * @param {string} reportType - Type of report (daily, monthly, profit_loss, transactions)
 * @param {object} data - Report data for email body
 * @param {string} format - Export format (xlsx, csv, pdf)
 * @param {Buffer} fileBuffer - The exported file buffer
 * @returns {Promise<object>} Send result
 */
const sendReportEmail = async (to, reportType, data, format, fileBuffer) => {
  const reportTypeNames = {
    daily: 'Daily Report',
    monthly: 'Monthly Report',
    profit_loss: 'Profit & Loss Report',
    transactions: 'Transactions Report'
  };

  const reportName = reportTypeNames[reportType] || 'Report';
  const timestamp = new Date().toISOString().split('T')[0];
  const fileName = `${reportType}-report-${timestamp}.${format}`;

  const mimeTypes = {
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    csv: 'text/csv',
    pdf: 'application/pdf'
  };

  const subject = `United Exchange - ${reportName} - ${timestamp}`;
  const html = generateReportEmailTemplate(reportName, data, timestamp);

  const attachments = [
    {
      filename: fileName,
      content: fileBuffer,
      contentType: mimeTypes[format] || 'application/octet-stream'
    }
  ];

  return sendEmail(to, subject, html, attachments);
};

/**
 * Generate HTML email template for reports
 * @param {string} reportName - Name of the report
 * @param {object} data - Report summary data
 * @param {string} date - Report date
 * @returns {string} HTML email content
 */
const generateReportEmailTemplate = (reportName, data, date) => {
  const summaryRows = data.summary
    ? Object.entries(data.summary)
      .map(([key, value]) => {
        const formattedKey = key
          .replace(/([A-Z])/g, ' $1')
          .replace(/^./, str => str.toUpperCase());
        return `
            <tr>
              <td style="padding: 8px 16px; border-bottom: 1px solid #e0e0e0; font-weight: 500;">${formattedKey}</td>
              <td style="padding: 8px 16px; border-bottom: 1px solid #e0e0e0; text-align: right;">${value}</td>
            </tr>
          `;
      })
      .join('')
    : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${reportName}</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <!-- Header -->
              <tr>
                <td style="background-color: #1976d2; padding: 24px; border-radius: 8px 8px 0 0;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 24px;">United Exchange</h1>
                  <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">Automated Report System</p>
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="padding: 32px;">
                  <h2 style="color: #333333; margin: 0 0 8px 0; font-size: 20px;">${reportName}</h2>
                  <p style="color: #666666; margin: 0 0 24px 0; font-size: 14px;">Generated on ${new Date().toLocaleString()}</p>

                  ${summaryRows ? `
                  <div style="margin-bottom: 24px;">
                    <h3 style="color: #333333; margin: 0 0 16px 0; font-size: 16px;">Report Summary</h3>
                    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fafafa; border-radius: 4px;">
                      ${summaryRows}
                    </table>
                  </div>
                  ` : ''}

                  <div style="background-color: #e3f2fd; padding: 16px; border-radius: 4px; margin-bottom: 24px;">
                    <p style="color: #1565c0; margin: 0; font-size: 14px;">
                      <strong>Note:</strong> The full report is attached to this email. Please review the attachment for detailed information.
                    </p>
                  </div>

                  <p style="color: #666666; font-size: 14px; line-height: 1.6;">
                    This is an automated report generated by the United Exchange system.
                    If you have any questions or need assistance, please contact your system administrator.
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #f5f5f5; padding: 24px; border-radius: 0 0 8px 8px; text-align: center;">
                  <p style="color: #999999; margin: 0; font-size: 12px;">
                    This email was sent automatically by the United Exchange reporting system.<br>
                    Please do not reply to this email.
                  </p>
                  <p style="color: #999999; margin: 16px 0 0 0; font-size: 12px;">
                    &copy; ${new Date().getFullYear()} United Exchange. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
};

/**
 * Send a notification email for schedule status changes
 * @param {string|string[]} to - Recipient email address(es)
 * @param {string} scheduleName - Name of the schedule
 * @param {string} status - Status of the schedule run
 * @param {object} details - Additional details
 * @returns {Promise<object>} Send result
 */
const sendScheduleNotification = async (to, scheduleName, status, details = {}) => {
  const statusColors = {
    success: '#4caf50',
    failed: '#f44336',
    warning: '#ff9800'
  };

  const subject = `United Exchange - Schedule "${scheduleName}" - ${status.toUpperCase()}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Schedule Notification</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px;">
              <tr>
                <td style="background-color: ${statusColors[status] || '#1976d2'}; padding: 24px; border-radius: 8px 8px 0 0;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 20px;">Schedule Notification</h1>
                </td>
              </tr>
              <tr>
                <td style="padding: 32px;">
                  <h2 style="color: #333333; margin: 0 0 16px 0;">${scheduleName}</h2>
                  <p style="color: #666666; margin: 0 0 16px 0;">
                    Status: <strong style="color: ${statusColors[status] || '#333333'};">${status.toUpperCase()}</strong>
                  </p>
                  ${details.message ? `<p style="color: #666666; margin: 0 0 16px 0;">${details.message}</p>` : ''}
                  ${details.error ? `<p style="color: #f44336; margin: 0;">Error: ${details.error}</p>` : ''}
                  <p style="color: #999999; margin: 16px 0 0 0; font-size: 12px;">
                    Executed at: ${new Date().toLocaleString()}
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return sendEmail(to, subject, html);
};

/**
 * Send rate alert email
 */
const sendRateAlertEmail = async (to, userName, alertData) => {
  const { fromCurrency, toCurrency, rate, targetRate, condition } = alertData;
  const subject = `Rate Alert: ${fromCurrency}/${toCurrency} is ${condition} ${targetRate}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; padding: 20px;">
      <h2>Rate Alert Triggered</h2>
      <p>Hello ${userName},</p>
      <p>Your rate alert for <strong>${fromCurrency}/${toCurrency}</strong> has been triggered.</p>
      
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p style="margin: 5px 0;"><strong>Current Rate:</strong> ${rate}</p>
        <p style="margin: 5px 0;"><strong>Target:</strong> ${condition} ${targetRate}</p>
      </div>

      <p>Login to your dashboard to manage your alerts.</p>
    </body>
    </html>
  `;

  return sendEmail(to, subject, html);
};

/**
 * Send transaction receipt email
 */
const sendReceiptEmail = async (to, transactionData) => {
  const {
    transactionNumber,
    customerName,
    amountIn,
    currencyIn,
    amountOut,
    currencyOut,
    exchangeRate,
    date,
    employeeName,
    status
  } = transactionData;

  const subject = `Receipt for Transaction ${transactionNumber}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
        .header { text-align: center; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 20px; }
        .header h1 { color: #2563eb; margin: 0; }
        .details { margin-bottom: 20px; }
        .details table { width: 100%; border-collapse: collapse; }
        .details td { padding: 8px 0; border-bottom: 1px solid #f5f5f5; }
        .details td:first-child { font-weight: bold; color: #666; width: 40%; }
        .details td:last-child { text-align: right; }
        .amount-box { background-color: #f8fafc; padding: 15px; border-radius: 5px; text-align: center; margin-bottom: 20px; }
        .amount-box h2 { margin: 0; color: #1e293b; }
        .amount-box p { margin: 5px 0 0; color: #64748b; }
        .footer { text-align: center; font-size: 12px; color: #999; margin-top: 30px; border-top: 1px solid #eee; padding-top: 10px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>United Exchange</h1>
          <p>Transaction Receipt</p>
        </div>

        <div class="amount-box">
          <h2>${amountIn} ${currencyIn}</h2>
          <p>Exchanged to ${amountOut} ${currencyOut}</p>
        </div>

        <div class="details">
          <table>
            <tr>
              <td>Transaction No.</td>
              <td>${transactionNumber}</td>
            </tr>
            <tr>
              <td>Date</td>
              <td>${new Date(date).toLocaleString()}</td>
            </tr>
            <tr>
              <td>Customer</td>
              <td>${customerName}</td>
            </tr>
            <tr>
              <td>Exchange Rate</td>
              <td>${exchangeRate}</td>
            </tr>
            <tr>
              <td>Served By</td>
              <td>${employeeName}</td>
            </tr>
            <tr>
              <td>Status</td>
              <td>${status.toUpperCase()}</td>
            </tr>
          </table>
        </div>

        <div class="footer">
          <p>Thank you for choosing United Exchange.</p>
          <p>For any inquiries, please contact support.</p>
          <p>&copy; ${new Date().getFullYear()} United Exchange. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(to, subject, html);
};

module.exports = {
  initTransporter,
  verifyConnection,
  sendEmail,
  sendReportEmail,
  sendScheduleNotification,
  sendRateAlertEmail,
  sendReceiptEmail, // Export new function
  generateReportEmailTemplate
};
