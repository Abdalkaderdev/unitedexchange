/**
 * Receipt Service
 * Generates professional PDF receipts/invoices for currency exchange transactions
 * Supports RTL languages (Arabic/Kurdish)
 */
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const companyConfig = require('../config/company');
const { formatDisplayDate, parseDecimal } = require('../utils/helpers');

/**
 * Generate a QR code as a data URL
 * @param {string} data - Data to encode in QR code
 * @returns {Promise<Buffer>} QR code image buffer
 */
const generateQRCode = async (data) => {
  try {
    const qrBuffer = await QRCode.toBuffer(data, {
      type: 'png',
      width: 100,
      margin: 1,
      errorCorrectionLevel: 'M'
    });
    return qrBuffer;
  } catch (error) {
    console.error('QR Code generation error:', error);
    return null;
  }
};

/**
 * Format amount with currency symbol
 * @param {number} amount - Amount to format
 * @param {string} symbol - Currency symbol
 * @param {string} code - Currency code
 * @returns {string} Formatted amount string
 */
const formatAmount = (amount, symbol, code) => {
  const formattedNumber = parseDecimal(amount, 2).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return `${symbol} ${formattedNumber} ${code}`;
};

/**
 * Draw a horizontal line
 * @param {PDFDocument} doc - PDF document
 * @param {number} y - Y position
 * @param {number} leftMargin - Left margin
 * @param {number} rightMargin - Right margin
 */
const drawLine = (doc, y, leftMargin = 50, rightMargin = 50) => {
  doc
    .strokeColor('#cccccc')
    .lineWidth(0.5)
    .moveTo(leftMargin, y)
    .lineTo(doc.page.width - rightMargin, y)
    .stroke();
};

/**
 * Draw dashed line
 * @param {PDFDocument} doc - PDF document
 * @param {number} y - Y position
 * @param {number} leftMargin - Left margin
 * @param {number} rightMargin - Right margin
 */
const drawDashedLine = (doc, y, leftMargin = 50, rightMargin = 50) => {
  doc
    .strokeColor('#999999')
    .lineWidth(0.5)
    .dash(5, { space: 3 })
    .moveTo(leftMargin, y)
    .lineTo(doc.page.width - rightMargin, y)
    .stroke()
    .undash();
};

/**
 * Generate receipt PDF for a transaction
 * @param {object} transaction - Transaction data with currency details
 * @param {object} options - Generation options
 * @param {boolean} options.includeProfit - Whether to include profit/commission (internal receipts)
 * @param {string} options.language - Language for the receipt ('en', 'ar', 'ku')
 * @returns {Promise<Buffer>} PDF buffer
 */
const generateReceipt = async (transaction, options = {}) => {
  const { includeProfit = false, language = 'en' } = options;

  return new Promise(async (resolve, reject) => {
    try {
      // Create PDF document
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: `Receipt - ${transaction.transactionNumber}`,
          Author: companyConfig.name,
          Subject: 'Currency Exchange Receipt',
          Creator: 'United Exchange System'
        }
      });

      // Collect chunks
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth = doc.page.width;
      const leftMargin = 50;
      const rightMargin = pageWidth - 50;
      const contentWidth = rightMargin - leftMargin;

      // Determine RTL mode
      const isRTL = ['ar', 'ku'].includes(language);

      // Get company name based on language
      const getCompanyName = () => {
        switch (language) {
          case 'ar': return companyConfig.nameArabic;
          case 'ku': return companyConfig.nameKurdish;
          default: return companyConfig.name;
        }
      };

      // Get terms based on language
      const getTerms = () => {
        switch (language) {
          case 'ar': return companyConfig.receipt.termsAndConditionsArabic;
          case 'ku': return companyConfig.receipt.termsAndConditionsKurdish;
          default: return companyConfig.receipt.termsAndConditions;
        }
      };

      // Labels based on language
      const labels = {
        en: {
          receipt: 'RECEIPT',
          transactionNo: 'Transaction No',
          date: 'Date & Time',
          customerDetails: 'CUSTOMER DETAILS',
          customerName: 'Name',
          phone: 'Phone',
          idType: 'ID Type',
          idNumber: 'ID Number',
          transactionDetails: 'TRANSACTION DETAILS',
          currencyIn: 'Currency Received',
          currencyOut: 'Currency Paid',
          exchangeRate: 'Exchange Rate',
          internalInfo: 'INTERNAL INFORMATION',
          marketRate: 'Market Rate',
          profit: 'Profit',
          commission: 'Commission',
          processedBy: 'Processed By',
          termsTitle: 'Terms & Conditions',
          verifyText: 'Scan QR code to verify',
          thankYou: 'Thank you for your business!'
        },
        ar: {
          receipt: 'إيصال',
          transactionNo: 'رقم المعاملة',
          date: 'التاريخ والوقت',
          customerDetails: 'تفاصيل العميل',
          customerName: 'الاسم',
          phone: 'الهاتف',
          idType: 'نوع الهوية',
          idNumber: 'رقم الهوية',
          transactionDetails: 'تفاصيل المعاملة',
          currencyIn: 'العملة المستلمة',
          currencyOut: 'العملة المدفوعة',
          exchangeRate: 'سعر الصرف',
          internalInfo: 'معلومات داخلية',
          marketRate: 'سعر السوق',
          profit: 'الربح',
          commission: 'العمولة',
          processedBy: 'تمت المعالجة بواسطة',
          termsTitle: 'الشروط والأحكام',
          verifyText: 'امسح رمز QR للتحقق',
          thankYou: 'شكراً لتعاملكم معنا!'
        },
        ku: {
          receipt: 'پسوولە',
          transactionNo: 'ژمارەی مامەڵە',
          date: 'بەروار و کات',
          customerDetails: 'زانیاری کڕیار',
          customerName: 'ناو',
          phone: 'ژمارەی مۆبایل',
          idType: 'جۆری ناسنامە',
          idNumber: 'ژمارەی ناسنامە',
          transactionDetails: 'زانیاری مامەڵە',
          currencyIn: 'دراوی وەرگیراو',
          currencyOut: 'دراوی دراو',
          exchangeRate: 'نرخی ئاڵوگۆڕ',
          internalInfo: 'زانیاری ناوخۆیی',
          marketRate: 'نرخی بازاڕ',
          profit: 'قازانج',
          commission: 'کۆمیسیۆن',
          processedBy: 'ئەنجامدراوە لەلایەن',
          termsTitle: 'مەرج و ڕێسا',
          verifyText: 'QR بخوێنەوە بۆ پشتڕاستکردنەوە',
          thankYou: 'سوپاس بۆ هاوکاریتان!'
        }
      };

      const l = labels[language] || labels.en;

      let y = 50;

      // ============================================
      // HEADER SECTION
      // ============================================

      // Company logo placeholder (draw a rectangle if no logo)
      if (companyConfig.receipt.logoPath) {
        try {
          doc.image(companyConfig.receipt.logoPath, leftMargin, y, { width: 80 });
        } catch (e) {
          // Logo not found, draw placeholder
          doc.rect(leftMargin, y, 80, 40).stroke();
          doc.fontSize(8).fillColor('#999999').text('LOGO', leftMargin + 25, y + 15);
        }
      } else {
        // Draw placeholder box for logo
        doc.rect(leftMargin, y, 80, 40).stroke();
        doc.fontSize(8).fillColor('#999999').text('LOGO', leftMargin + 25, y + 15);
      }

      // Company name and details (right aligned)
      doc.fillColor('#1a365d')
        .fontSize(18)
        .font('Helvetica-Bold')
        .text(getCompanyName(), leftMargin + 100, y, {
          width: contentWidth - 100,
          align: isRTL ? 'right' : 'left'
        });

      y += 25;

      doc.fillColor('#4a5568')
        .fontSize(9)
        .font('Helvetica')
        .text(`${companyConfig.address}`, leftMargin + 100, y, {
          width: contentWidth - 100,
          align: isRTL ? 'right' : 'left'
        });

      y += 12;

      doc.text(`${companyConfig.city}, ${companyConfig.country}`, leftMargin + 100, y, {
        width: contentWidth - 100,
        align: isRTL ? 'right' : 'left'
      });

      y += 12;

      doc.text(`Tel: ${companyConfig.phone}`, leftMargin + 100, y, {
        width: contentWidth - 100,
        align: isRTL ? 'right' : 'left'
      });

      y += 12;

      doc.text(`${companyConfig.email} | ${companyConfig.website}`, leftMargin + 100, y, {
        width: contentWidth - 100,
        align: isRTL ? 'right' : 'left'
      });

      y += 30;

      // Horizontal line under header
      drawLine(doc, y);

      y += 20;

      // ============================================
      // RECEIPT TITLE AND TRANSACTION INFO
      // ============================================

      // Receipt title
      doc.fillColor('#1a365d')
        .fontSize(20)
        .font('Helvetica-Bold')
        .text(l.receipt, leftMargin, y, {
          width: contentWidth,
          align: 'center'
        });

      y += 35;

      // Transaction number and date box
      doc.roundedRect(leftMargin, y, contentWidth, 50, 5)
        .fillColor('#f7fafc')
        .fill();

      doc.fillColor('#2d3748')
        .fontSize(10)
        .font('Helvetica-Bold')
        .text(`${l.transactionNo}:`, leftMargin + 15, y + 10)
        .font('Helvetica')
        .text(transaction.transactionNumber, leftMargin + 15, y + 25);

      doc.font('Helvetica-Bold')
        .text(`${l.date}:`, rightMargin - 160, y + 10)
        .font('Helvetica')
        .text(formatDisplayDate(transaction.transactionDate), rightMargin - 160, y + 25);

      y += 70;

      // ============================================
      // CUSTOMER DETAILS SECTION
      // ============================================

      doc.fillColor('#1a365d')
        .fontSize(12)
        .font('Helvetica-Bold')
        .text(l.customerDetails, leftMargin, y);

      y += 20;

      drawLine(doc, y);
      y += 15;

      // Customer info table
      const customerInfoX = leftMargin;
      const customerValueX = leftMargin + 120;

      doc.fillColor('#4a5568').fontSize(10).font('Helvetica');

      // Customer Name
      doc.text(`${l.customerName}:`, customerInfoX, y);
      doc.font('Helvetica-Bold').fillColor('#2d3748')
        .text(transaction.customerName, customerValueX, y);

      y += 18;

      // Phone
      if (transaction.customerPhone) {
        doc.font('Helvetica').fillColor('#4a5568')
          .text(`${l.phone}:`, customerInfoX, y);
        doc.fillColor('#2d3748')
          .text(transaction.customerPhone, customerValueX, y);
        y += 18;
      }

      // ID Type and Number
      if (transaction.customerIdType) {
        doc.font('Helvetica').fillColor('#4a5568')
          .text(`${l.idType}:`, customerInfoX, y);
        doc.fillColor('#2d3748')
          .text(transaction.customerIdType.replace('_', ' ').toUpperCase(), customerValueX, y);
        y += 18;
      }

      if (transaction.customerIdNumber) {
        doc.font('Helvetica').fillColor('#4a5568')
          .text(`${l.idNumber}:`, customerInfoX, y);
        doc.fillColor('#2d3748')
          .text(transaction.customerIdNumber, customerValueX, y);
        y += 18;
      }

      y += 15;

      // ============================================
      // TRANSACTION DETAILS SECTION
      // ============================================

      doc.fillColor('#1a365d')
        .fontSize(12)
        .font('Helvetica-Bold')
        .text(l.transactionDetails, leftMargin, y);

      y += 20;

      drawLine(doc, y);
      y += 15;

      // Transaction amounts - larger box
      doc.roundedRect(leftMargin, y, contentWidth, 100, 5)
        .fillColor('#edf2f7')
        .fill();

      const boxPadding = 15;

      // Currency In (Received from customer)
      doc.fillColor('#4a5568')
        .fontSize(10)
        .font('Helvetica')
        .text(`${l.currencyIn}:`, leftMargin + boxPadding, y + boxPadding);

      doc.fillColor('#2b6cb0')
        .fontSize(16)
        .font('Helvetica-Bold')
        .text(
          formatAmount(
            transaction.amountIn,
            transaction.currencyIn.symbol,
            transaction.currencyIn.code
          ),
          leftMargin + boxPadding,
          y + boxPadding + 15
        );

      // Arrow or separator
      doc.fillColor('#718096')
        .fontSize(24)
        .text(' → ', leftMargin + contentWidth / 2 - 20, y + boxPadding + 25);

      // Currency Out (Paid to customer)
      doc.fillColor('#4a5568')
        .fontSize(10)
        .font('Helvetica')
        .text(`${l.currencyOut}:`, rightMargin - 200, y + boxPadding);

      doc.fillColor('#38a169')
        .fontSize(16)
        .font('Helvetica-Bold')
        .text(
          formatAmount(
            transaction.amountOut,
            transaction.currencyOut.symbol,
            transaction.currencyOut.code
          ),
          rightMargin - 200,
          y + boxPadding + 15
        );

      // Exchange Rate
      doc.fillColor('#4a5568')
        .fontSize(10)
        .font('Helvetica')
        .text(`${l.exchangeRate}:`, leftMargin + boxPadding, y + 70);

      doc.fillColor('#2d3748')
        .fontSize(12)
        .font('Helvetica-Bold')
        .text(
          `1 ${transaction.currencyIn.code} = ${parseDecimal(transaction.exchangeRate, 6)} ${transaction.currencyOut.code}`,
          leftMargin + boxPadding + 100,
          y + 68
        );

      y += 120;

      // ============================================
      // INTERNAL INFORMATION (if includeProfit)
      // ============================================

      if (includeProfit) {
        doc.fillColor('#c53030')
          .fontSize(12)
          .font('Helvetica-Bold')
          .text(l.internalInfo, leftMargin, y);

        y += 20;

        doc.roundedRect(leftMargin, y, contentWidth, 80, 5)
          .fillColor('#fed7d7')
          .fill();

        // Market Rate
        doc.fillColor('#742a2a')
          .fontSize(10)
          .font('Helvetica')
          .text(`${l.marketRate}:`, leftMargin + boxPadding, y + boxPadding);

        doc.font('Helvetica-Bold')
          .text(
            `1 ${transaction.currencyIn.code} = ${parseDecimal(transaction.marketRate, 6)} ${transaction.currencyOut.code}`,
            leftMargin + boxPadding + 100,
            y + boxPadding
          );

        // Profit
        doc.font('Helvetica')
          .text(`${l.profit}:`, leftMargin + boxPadding, y + boxPadding + 20);

        doc.font('Helvetica-Bold')
          .text(
            `${parseDecimal(transaction.profit, 2)} ${companyConfig.currency.defaultProfitCurrency}`,
            leftMargin + boxPadding + 100,
            y + boxPadding + 20
          );

        // Commission
        if (transaction.commission) {
          doc.font('Helvetica')
            .text(`${l.commission}:`, leftMargin + boxPadding, y + boxPadding + 40);

          doc.font('Helvetica-Bold')
            .text(
              `${parseDecimal(transaction.commission, 2)} ${companyConfig.currency.defaultProfitCurrency}`,
              leftMargin + boxPadding + 100,
              y + boxPadding + 40
            );
        }

        y += 100;
      }

      // ============================================
      // PROCESSED BY
      // ============================================

      y += 10;

      doc.fillColor('#4a5568')
        .fontSize(9)
        .font('Helvetica')
        .text(`${l.processedBy}: ${transaction.employee?.fullName || 'N/A'}`, leftMargin, y);

      y += 30;

      // ============================================
      // QR CODE AND VERIFICATION
      // ============================================

      drawDashedLine(doc, y);
      y += 20;

      // Generate QR code with verification URL
      const verificationUrl = `${companyConfig.receipt.verificationBaseUrl}/${transaction.uuid}`;
      const qrCodeBuffer = await generateQRCode(verificationUrl);

      if (qrCodeBuffer) {
        // Center the QR code
        const qrX = (pageWidth - 100) / 2;
        doc.image(qrCodeBuffer, qrX, y, { width: 100, height: 100 });

        y += 105;

        doc.fillColor('#718096')
          .fontSize(8)
          .text(l.verifyText, leftMargin, y, {
            width: contentWidth,
            align: 'center'
          });

        y += 12;

        doc.fillColor('#a0aec0')
          .fontSize(7)
          .text(transaction.uuid, leftMargin, y, {
            width: contentWidth,
            align: 'center'
          });
      }

      y += 30;

      // ============================================
      // TERMS AND CONDITIONS
      // ============================================

      drawLine(doc, y);
      y += 15;

      doc.fillColor('#4a5568')
        .fontSize(9)
        .font('Helvetica-Bold')
        .text(l.termsTitle, leftMargin, y);

      y += 15;

      doc.font('Helvetica')
        .fontSize(7)
        .fillColor('#718096')
        .text(getTerms(), leftMargin, y, {
          width: contentWidth,
          align: isRTL ? 'right' : 'justify',
          lineGap: 2
        });

      y += 50;

      // ============================================
      // FOOTER
      // ============================================

      // Thank you message
      doc.fillColor('#2b6cb0')
        .fontSize(11)
        .font('Helvetica-Bold')
        .text(l.thankYou, leftMargin, y, {
          width: contentWidth,
          align: 'center'
        });

      y += 25;

      // License number
      doc.fillColor('#a0aec0')
        .fontSize(8)
        .font('Helvetica')
        .text(companyConfig.licenseNumber, leftMargin, y, {
          width: contentWidth,
          align: 'center'
        });

      // Finalize PDF
      doc.end();

    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Generate receipt filename
 * @param {object} transaction - Transaction data
 * @param {string} type - Receipt type ('customer' or 'internal')
 * @returns {string} Filename
 */
const generateReceiptFilename = (transaction, type = 'customer') => {
  const dateStr = new Date(transaction.transactionDate)
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, '');
  const suffix = type === 'internal' ? '_internal' : '';
  return `receipt_${transaction.transactionNumber}_${dateStr}${suffix}.pdf`;
};

module.exports = {
  generateReceipt,
  generateReceiptFilename,
  generateQRCode
};
