/**
 * Excel Export Utility
 *
 * Provides client-side Excel export functionality for reports.
 * Uses the xlsx library to generate Excel files.
 *
 * NOTE: Requires xlsx package to be installed:
 *   npm install xlsx
 */

import * as XLSX from 'xlsx';

/**
 * Format a date for display in Excel
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date string
 */
const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
};

/**
 * Format a time for display in Excel
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted time string
 */
const formatTime = (date) => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

/**
 * Format a datetime for display in Excel
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted datetime string
 */
const formatDateTime = (date) => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return `${formatDate(date)} ${formatTime(date)}`;
};

/**
 * Format a number as currency
 * @param {number} value - Number to format
 * @param {string} currency - Currency code (optional)
 * @returns {string} Formatted currency string
 */
const formatCurrency = (value, currency = '') => {
  if (value === null || value === undefined) return '';
  const formatted = Number(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return currency ? `${formatted} ${currency}` : formatted;
};

/**
 * Format a number with locale formatting
 * @param {number} value - Number to format
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted number string
 */
const formatNumber = (value, decimals = 0) => {
  if (value === null || value === undefined) return '';
  return Number(value).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
};

/**
 * Apply column width auto-sizing to worksheet
 * @param {Object} worksheet - XLSX worksheet object
 * @param {Array} data - Array of data rows
 * @param {Array} headers - Array of header strings
 */
const autoSizeColumns = (worksheet, data, headers) => {
  const colWidths = headers.map((header, i) => {
    let maxWidth = header.length;
    data.forEach(row => {
      const cellValue = Object.values(row)[i];
      const cellLength = String(cellValue || '').length;
      if (cellLength > maxWidth) {
        maxWidth = cellLength;
      }
    });
    return { wch: Math.min(maxWidth + 2, 50) }; // Cap at 50 characters
  });
  worksheet['!cols'] = colWidths;
};

/**
 * Export Daily Report to Excel
 * @param {Object} report - Daily report data
 * @param {string} date - Report date
 * @param {Function} t - Translation function
 */
export const exportDailyReportToExcel = (report, date, t) => {
  const workbook = XLSX.utils.book_new();

  // Summary Sheet
  const summaryData = [
    [t('reports.dailyReport'), formatDate(date)],
    [],
    [t('reports.totalTransactions'), formatNumber(report.totalTransactions || 0)],
    [t('reports.totalProfit'), formatCurrency(report.totalProfit || 0, report.baseCurrency)],
    [t('reports.totalCommission'), formatCurrency(report.totalCommission || 0, report.baseCurrency)]
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, t('reports.dailyReport').substring(0, 31));

  // Transactions Sheet
  if (report.transactions && report.transactions.length > 0) {
    const transactionHeaders = [
      t('reports.transactionId'),
      t('reports.time'),
      t('reports.type'),
      t('reports.currency'),
      t('reports.amount'),
      t('reports.rate'),
      t('reports.total'),
      t('reports.profit'),
      t('reports.employee')
    ];

    const transactionData = report.transactions.map(tx => ({
      id: tx.id || '',
      time: formatTime(tx.createdAt),
      type: t(`reports.${tx.type}`) || tx.type,
      currency: tx.currencyCode || '',
      amount: formatNumber(tx.amount, 2),
      rate: formatNumber(tx.rate, 4),
      total: formatNumber(tx.total, 2),
      profit: formatNumber(tx.profit, 2),
      employee: tx.employeeName || ''
    }));

    const transactionsSheet = XLSX.utils.json_to_sheet(transactionData);
    XLSX.utils.sheet_add_aoa(transactionsSheet, [transactionHeaders], { origin: 'A1' });
    autoSizeColumns(transactionsSheet, transactionData, transactionHeaders);
    XLSX.utils.book_append_sheet(workbook, transactionsSheet, t('reports.transactions').substring(0, 31));
  }

  // Currency Breakdown Sheet
  if (report.byCurrency && report.byCurrency.length > 0) {
    const currencyHeaders = [
      t('reports.currency'),
      t('reports.buyTransactions'),
      t('reports.sellTransactions'),
      t('reports.totalVolume'),
      t('reports.profit')
    ];

    const currencyData = report.byCurrency.map(c => ({
      currency: c.currencyCode || '',
      buyCount: formatNumber(c.buyCount || 0),
      sellCount: formatNumber(c.sellCount || 0),
      volume: formatNumber(c.totalVolume, 2),
      profit: formatNumber(c.profit, 2)
    }));

    const currencySheet = XLSX.utils.json_to_sheet(currencyData);
    XLSX.utils.sheet_add_aoa(currencySheet, [currencyHeaders], { origin: 'A1' });
    autoSizeColumns(currencySheet, currencyData, currencyHeaders);
    XLSX.utils.book_append_sheet(workbook, currencySheet, t('reports.currencyBreakdown').substring(0, 31));
  }

  // Download the file
  const filename = `daily-report-${date}.xlsx`;
  XLSX.writeFile(workbook, filename);
};

/**
 * Export Monthly Report to Excel
 * @param {Object} report - Monthly report data
 * @param {number} year - Report year
 * @param {number} month - Report month (1-12)
 * @param {Function} t - Translation function
 */
export const exportMonthlyReportToExcel = (report, year, month, t) => {
  const workbook = XLSX.utils.book_new();
  const monthStr = String(month).padStart(2, '0');
  const monthName = t(`reports.months.${month}`);

  // Summary Sheet
  const summaryData = [
    [t('reports.monthlyReport'), `${monthName} ${year}`],
    [],
    [t('reports.totalTransactions'), formatNumber(report.totalTransactions || 0)],
    [t('reports.totalProfit'), formatCurrency(report.totalProfit || 0, report.baseCurrency)]
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, t('reports.monthlyReport').substring(0, 31));

  // Daily Breakdown Sheet
  if (report.dailyBreakdown && report.dailyBreakdown.length > 0) {
    const dailyHeaders = [
      t('reports.date'),
      t('reports.transactions'),
      t('reports.profit')
    ];

    const dailyData = report.dailyBreakdown.map(day => ({
      date: formatDate(day.date),
      transactions: formatNumber(day.transactionCount || 0),
      profit: formatNumber(day.profit, 2)
    }));

    const dailySheet = XLSX.utils.json_to_sheet(dailyData);
    XLSX.utils.sheet_add_aoa(dailySheet, [dailyHeaders], { origin: 'A1' });
    autoSizeColumns(dailySheet, dailyData, dailyHeaders);
    XLSX.utils.book_append_sheet(workbook, dailySheet, t('reports.dailyBreakdown').substring(0, 31));
  }

  // Currency Breakdown Sheet
  if (report.currencyBreakdown && report.currencyBreakdown.length > 0) {
    const currencyHeaders = [
      t('reports.currency'),
      t('reports.buyTransactions'),
      t('reports.sellTransactions'),
      t('reports.totalVolume'),
      t('reports.profit')
    ];

    const currencyData = report.currencyBreakdown.map(c => ({
      currency: c.currencyCode || '',
      buyCount: formatNumber(c.buyCount || 0),
      sellCount: formatNumber(c.sellCount || 0),
      volume: formatNumber(c.totalVolume, 2),
      profit: formatNumber(c.profit, 2)
    }));

    const currencySheet = XLSX.utils.json_to_sheet(currencyData);
    XLSX.utils.sheet_add_aoa(currencySheet, [currencyHeaders], { origin: 'A1' });
    autoSizeColumns(currencySheet, currencyData, currencyHeaders);
    XLSX.utils.book_append_sheet(workbook, currencySheet, t('reports.currencyBreakdown').substring(0, 31));
  }

  // Employee Performance Sheet
  if (report.employeePerformance && report.employeePerformance.length > 0) {
    const employeeHeaders = [
      t('reports.employee'),
      t('reports.transactions'),
      t('reports.totalVolume'),
      t('reports.profit')
    ];

    const employeeData = report.employeePerformance.map(emp => ({
      name: emp.name || '',
      transactions: formatNumber(emp.transactionCount || 0),
      volume: formatNumber(emp.totalVolume, 2),
      profit: formatNumber(emp.profit, 2)
    }));

    const employeeSheet = XLSX.utils.json_to_sheet(employeeData);
    XLSX.utils.sheet_add_aoa(employeeSheet, [employeeHeaders], { origin: 'A1' });
    autoSizeColumns(employeeSheet, employeeData, employeeHeaders);
    XLSX.utils.book_append_sheet(workbook, employeeSheet, t('reports.employeePerformance').substring(0, 31));
  }

  // Download the file
  const filename = `monthly-report-${year}-${monthStr}.xlsx`;
  XLSX.writeFile(workbook, filename);
};

/**
 * Export Profit/Loss Report to Excel
 * @param {Object} report - Profit/Loss report data
 * @param {string} startDate - Start date
 * @param {string} endDate - End date
 * @param {Function} t - Translation function
 */
export const exportProfitLossReportToExcel = (report, startDate, endDate, t) => {
  const workbook = XLSX.utils.book_new();

  // Summary Sheet
  const summaryData = [
    [t('reports.profitLoss'), `${formatDate(startDate)} - ${formatDate(endDate)}`],
    [],
    [t('reports.totalTransactions'), formatNumber(report.totalTransactions || 0)],
    [t('reports.totalIn'), formatCurrency(report.totalRevenue || 0, report.baseCurrency)],
    [t('reports.totalOut'), formatCurrency(report.totalExpenses || 0, report.baseCurrency)],
    [t('reports.netProfit'), formatCurrency(report.netProfit || 0, report.baseCurrency)]
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, t('reports.profitLoss').substring(0, 31));

  // Daily Profit/Loss Sheet
  if (report.dailyProfitLoss && report.dailyProfitLoss.length > 0) {
    const dailyHeaders = [
      t('reports.date'),
      t('reports.totalIn'),
      t('reports.totalOut'),
      t('reports.profit')
    ];

    const dailyData = report.dailyProfitLoss.map(day => ({
      date: formatDate(day.date),
      revenue: formatNumber(day.revenue, 2),
      expenses: formatNumber(day.expenses, 2),
      profit: formatNumber(day.profit, 2)
    }));

    const dailySheet = XLSX.utils.json_to_sheet(dailyData);
    XLSX.utils.sheet_add_aoa(dailySheet, [dailyHeaders], { origin: 'A1' });
    autoSizeColumns(dailySheet, dailyData, dailyHeaders);
    XLSX.utils.book_append_sheet(workbook, dailySheet, t('reports.profitTrend').substring(0, 31));
  }

  // Currency Breakdown Sheet
  if (report.currencyBreakdown && report.currencyBreakdown.length > 0) {
    const currencyHeaders = [
      t('reports.currency'),
      t('reports.totalIn'),
      t('reports.totalOut'),
      t('reports.profit')
    ];

    const currencyData = report.currencyBreakdown.map(c => ({
      currency: c.currencyCode || '',
      totalIn: formatNumber(c.totalIn, 2),
      totalOut: formatNumber(c.totalOut, 2),
      profit: formatNumber(c.profit, 2)
    }));

    const currencySheet = XLSX.utils.json_to_sheet(currencyData);
    XLSX.utils.sheet_add_aoa(currencySheet, [currencyHeaders], { origin: 'A1' });
    autoSizeColumns(currencySheet, currencyData, currencyHeaders);
    XLSX.utils.book_append_sheet(workbook, currencySheet, t('reports.currencyBreakdown').substring(0, 31));
  }

  // Download the file
  const filename = `profit-loss-${startDate}-to-${endDate}.xlsx`;
  XLSX.writeFile(workbook, filename);
};

/**
 * Export Daily Closing Report to Excel
 * @param {Object} report - Daily closing report data
 * @param {Function} t - Translation function
 */
export const exportDailyClosingReportToExcel = (report, t) => {
  const workbook = XLSX.utils.book_new();

  // Summary Sheet
  const summaryData = [
    [t('reports.closingReport'), formatDate(report.date)],
    [],
    [t('reports.generatedBy'), report.generatedBy?.fullName || report.generatedBy?.username || ''],
    [t('reports.generatedAt'), formatDateTime(report.createdAt)],
    [],
    [t('reports.totalTransactions'), formatNumber(report.totalTransactions || 0)],
    [t('reports.cancelledTransactions'), formatNumber(report.cancelledTransactions || 0)],
    [t('reports.totalProfit'), formatCurrency(report.totalProfit || 0, report.baseCurrency)],
    [t('reports.totalCommission'), formatCurrency(report.totalCommission || 0, report.baseCurrency)]
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, t('reports.closingReport').substring(0, 31));

  // Currency Breakdown Sheet
  if (report.currencyBreakdown && report.currencyBreakdown.length > 0) {
    const currencyHeaders = [
      t('reports.currency'),
      t('reports.buyTransactions'),
      t('reports.sellTransactions'),
      t('reports.totalVolume'),
      t('reports.profit')
    ];

    const currencyData = report.currencyBreakdown.map(c => ({
      currency: c.currencyCode || '',
      buyCount: formatNumber(c.buyCount || 0),
      sellCount: formatNumber(c.sellCount || 0),
      volume: formatNumber(c.totalVolume, 2),
      profit: formatNumber(c.profit, 2)
    }));

    const currencySheet = XLSX.utils.json_to_sheet(currencyData);
    XLSX.utils.sheet_add_aoa(currencySheet, [currencyHeaders], { origin: 'A1' });
    autoSizeColumns(currencySheet, currencyData, currencyHeaders);
    XLSX.utils.book_append_sheet(workbook, currencySheet, t('reports.currencyBreakdown').substring(0, 31));
  }

  // Employee Breakdown Sheet
  if (report.employeeBreakdown && report.employeeBreakdown.length > 0) {
    const employeeHeaders = [
      t('reports.employee'),
      t('reports.transactions'),
      t('reports.totalVolume'),
      t('reports.profit')
    ];

    const employeeData = report.employeeBreakdown.map(emp => ({
      name: emp.name || emp.fullName || emp.username || '',
      transactions: formatNumber(emp.transactionCount || 0),
      volume: formatNumber(emp.totalVolume, 2),
      profit: formatNumber(emp.profit, 2)
    }));

    const employeeSheet = XLSX.utils.json_to_sheet(employeeData);
    XLSX.utils.sheet_add_aoa(employeeSheet, [employeeHeaders], { origin: 'A1' });
    autoSizeColumns(employeeSheet, employeeData, employeeHeaders);
    XLSX.utils.book_append_sheet(workbook, employeeSheet, t('reports.employeeBreakdown').substring(0, 31));
  }

  // Transactions Sheet
  if (report.transactions && report.transactions.length > 0) {
    const transactionHeaders = [
      t('reports.transactionId'),
      t('reports.time'),
      t('reports.type'),
      t('reports.currency'),
      t('reports.amount'),
      t('reports.profit'),
      t('reports.employee')
    ];

    const transactionData = report.transactions.map(tx => ({
      id: tx.id || '',
      time: formatTime(tx.createdAt),
      type: t(`reports.${tx.type}`) || tx.type,
      currency: tx.currencyCode || '',
      amount: formatNumber(tx.amount, 2),
      profit: formatNumber(tx.profit, 2),
      employee: tx.employeeName || ''
    }));

    const transactionsSheet = XLSX.utils.json_to_sheet(transactionData);
    XLSX.utils.sheet_add_aoa(transactionsSheet, [transactionHeaders], { origin: 'A1' });
    autoSizeColumns(transactionsSheet, transactionData, transactionHeaders);
    XLSX.utils.book_append_sheet(workbook, transactionsSheet, t('reports.transactions').substring(0, 31));
  }

  // Download the file
  const filename = `closing-report-${formatDate(report.date).replace(/\//g, '-')}.xlsx`;
  XLSX.writeFile(workbook, filename);
};

/**
 * Generic export function for any data array
 * @param {Array} data - Array of objects to export
 * @param {Array} columns - Column configuration [{header: 'Header', accessor: 'key', format: 'currency|date|number'}]
 * @param {string} filename - Output filename (without extension)
 * @param {string} sheetName - Excel sheet name
 * @param {Function} t - Translation function (optional)
 */
export const exportDataToExcel = (data, columns, filename, sheetName = 'Data', t = null) => {
  const workbook = XLSX.utils.book_new();

  const headers = columns.map(col => col.header);

  const formattedData = data.map(row => {
    const formattedRow = {};
    columns.forEach((col, index) => {
      let value = row[col.accessor];

      switch (col.format) {
        case 'currency':
          value = formatCurrency(value, col.currency);
          break;
        case 'date':
          value = formatDate(value);
          break;
        case 'time':
          value = formatTime(value);
          break;
        case 'datetime':
          value = formatDateTime(value);
          break;
        case 'number':
          value = formatNumber(value, col.decimals || 0);
          break;
        default:
          value = value ?? '';
      }

      formattedRow[`col${index}`] = value;
    });
    return formattedRow;
  });

  const worksheet = XLSX.utils.json_to_sheet(formattedData);
  XLSX.utils.sheet_add_aoa(worksheet, [headers], { origin: 'A1' });
  autoSizeColumns(worksheet, formattedData, headers);

  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.substring(0, 31));

  XLSX.writeFile(workbook, `${filename}.xlsx`);
};

export default {
  exportDailyReportToExcel,
  exportMonthlyReportToExcel,
  exportProfitLossReportToExcel,
  exportDailyClosingReportToExcel,
  exportDataToExcel
};
