/**
 * Export Service
 * Handles Excel, CSV, and PDF export functionality
 */
const XLSX = require('xlsx');
const PDFDocument = require('pdfkit');

const exportService = {
  /**
   * Generate Excel workbook from data
   */
  generateExcel: (data, sheetName = 'Data') => {
    const workbook = XLSX.utils.book_new();

    if (Array.isArray(data)) {
      const worksheet = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    } else if (typeof data === 'object') {
      // Multiple sheets
      Object.keys(data).forEach(key => {
        const worksheet = XLSX.utils.json_to_sheet(data[key]);
        XLSX.utils.book_append_sheet(workbook, worksheet, key);
      });
    }

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  },

  /**
   * Generate CSV from data
   */
  generateCSV: (data) => {
    if (!Array.isArray(data) || data.length === 0) {
      return '';
    }

    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];

    data.forEach(row => {
      const values = headers.map(header => {
        const value = row[header];
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        // Escape quotes and wrap in quotes if contains comma or quote
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      });
      csvRows.push(values.join(','));
    });

    return csvRows.join('\n');
  },

  /**
   * Generate PDF report
   */
  generatePDF: (data, options = {}) => {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const chunks = [];

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Header
        doc.fontSize(20).text(options.title || 'Report', { align: 'center' });
        doc.moveDown();

        if (options.subtitle) {
          doc.fontSize(12).text(options.subtitle, { align: 'center' });
          doc.moveDown();
        }

        // Date
        doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, { align: 'right' });
        doc.moveDown(2);

        // Summary section
        if (options.summary) {
          doc.fontSize(14).text('Summary', { underline: true });
          doc.moveDown(0.5);

          Object.entries(options.summary).forEach(([key, value]) => {
            doc.fontSize(10).text(`${key}: ${value}`);
          });
          doc.moveDown();
        }

        // Table data
        if (Array.isArray(data) && data.length > 0) {
          const headers = options.columns || Object.keys(data[0]);
          const columnWidth = (doc.page.width - 100) / headers.length;

          // Table headers
          doc.fontSize(10).font('Helvetica-Bold');
          let x = 50;
          headers.forEach(header => {
            doc.text(header, x, doc.y, { width: columnWidth, align: 'left' });
            x += columnWidth;
          });
          doc.moveDown();

          // Table rows
          doc.font('Helvetica');
          data.forEach((row, index) => {
            if (doc.y > doc.page.height - 100) {
              doc.addPage();
            }

            x = 50;
            const y = doc.y;
            headers.forEach(header => {
              const value = row[header] !== null && row[header] !== undefined ? String(row[header]) : '';
              doc.text(value.substring(0, 20), x, y, { width: columnWidth, align: 'left' });
              x += columnWidth;
            });
            doc.moveDown(0.5);
          });
        }

        // Footer
        doc.fontSize(8).text('United Exchange', 50, doc.page.height - 50, { align: 'center' });

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  },

  /**
   * Format transaction data for export
   */
  formatTransactionsForExport: (transactions) => {
    return transactions.map(tx => ({
      'ID': tx.uuid || tx.id,
      'Date': tx.created_at ? new Date(tx.created_at).toLocaleString() : '',
      'Type': tx.type,
      'Customer': tx.customer_name || '',
      'From Currency': tx.currency_in_code || tx.from_currency,
      'To Currency': tx.currency_out_code || tx.to_currency,
      'Amount In': tx.amount_in,
      'Amount Out': tx.amount_out,
      'Exchange Rate': tx.exchange_rate,
      'Profit': tx.profit || 0,
      'Employee': tx.employee_name || '',
      'Status': tx.status || 'completed',
      'Notes': tx.notes || ''
    }));
  },

  /**
   * Format daily report for export
   */
  formatDailyReportForExport: (report) => {
    const summary = {
      'Date': report.date,
      'Total Transactions': report.totalTransactions,
      'Total Profit': report.totalProfit,
      'Total Volume': report.totalVolume
    };

    const transactions = exportService.formatTransactionsForExport(report.transactions || []);

    const byCurrency = (report.currencyBreakdown || []).map(c => ({
      'Currency': c.currency_code,
      'Transactions': c.transaction_count,
      'Total In': c.total_in,
      'Total Out': c.total_out,
      'Profit': c.profit
    }));

    const byEmployee = (report.employeeBreakdown || []).map(e => ({
      'Employee': e.employee_name,
      'Transactions': e.transaction_count,
      'Profit': e.profit
    }));

    return { Summary: [summary], Transactions: transactions, 'By Currency': byCurrency, 'By Employee': byEmployee };
  },

  /**
   * Format monthly report for export
   */
  formatMonthlyReportForExport: (report) => {
    const summary = {
      'Year': report.year,
      'Month': report.month,
      'Total Transactions': report.totalTransactions,
      'Total Profit': report.totalProfit,
      'Total Volume': report.totalVolume
    };

    const dailyBreakdown = (report.dailyBreakdown || []).map(d => ({
      'Date': d.date,
      'Transactions': d.transaction_count,
      'Volume': d.volume,
      'Profit': d.profit
    }));

    const byCurrency = (report.currencyBreakdown || []).map(c => ({
      'Currency': c.currency_code,
      'Transactions': c.transaction_count,
      'Total In': c.total_in,
      'Total Out': c.total_out,
      'Profit': c.profit
    }));

    const byEmployee = (report.employeeBreakdown || []).map(e => ({
      'Employee': e.employee_name,
      'Transactions': e.transaction_count,
      'Profit': e.profit
    }));

    return { Summary: [summary], 'Daily Breakdown': dailyBreakdown, 'By Currency': byCurrency, 'By Employee': byEmployee };
  },

  /**
   * Format profit/loss report for export
   */
  formatProfitLossForExport: (report) => {
    const summary = {
      'Period': `${report.startDate} to ${report.endDate}`,
      'Total Revenue': report.totalRevenue,
      'Total Expenses': report.totalExpenses,
      'Net Profit': report.netProfit,
      'Profit Margin': `${report.profitMargin}%`
    };

    const byDate = (report.dailyProfitLoss || []).map(d => ({
      'Date': d.date,
      'Revenue': d.revenue,
      'Expenses': d.expenses,
      'Profit': d.profit
    }));

    const byCurrency = (report.currencyProfitLoss || []).map(c => ({
      'Currency': c.currency_code,
      'Buy Transactions': c.buy_count,
      'Sell Transactions': c.sell_count,
      'Buy Profit': c.buy_profit,
      'Sell Profit': c.sell_profit,
      'Total Profit': c.total_profit
    }));

    return { Summary: [summary], 'By Date': byDate, 'By Currency': byCurrency };
  },

  /**
   * Format customer report for export
   */
  formatCustomersForExport: (customers) => {
    return customers.map(c => ({
      'ID': c.uuid,
      'Name': c.full_name,
      'Phone': c.phone || '',
      'Email': c.email || '',
      'ID Type': c.id_type || '',
      'ID Number': c.id_number || '',
      'VIP': c.is_vip ? 'Yes' : 'No',
      'Blocked': c.is_blocked ? 'Yes' : 'No',
      'Total Transactions': c.total_transactions || 0,
      'Total Volume': c.total_volume || 0,
      'Created': c.created_at ? new Date(c.created_at).toLocaleString() : ''
    }));
  }
};

module.exports = exportService;
