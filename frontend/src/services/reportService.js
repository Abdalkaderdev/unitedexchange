import api from './api';

export const reportService = {
  getDashboardStats: async () => {
    const response = await api.get('/reports/dashboard');
    return response.data;
  },

  getDashboardCharts: async () => {
    const response = await api.get('/reports/dashboard/charts');
    return response.data;
  },

  getLeaderboard: (period = 'month') => api.get(`/reports/leaderboard?period=${period}`),

  getDailyReport: async (date, employeeId) => {
    const params = {};
    if (date) params.date = date;
    if (employeeId) params.employeeId = employeeId;
    const response = await api.get('/reports/daily', { params });
    return response.data;
  },

  getMonthlyReport: async (year, month, employeeId) => {
    const params = {};
    if (year) params.year = year;
    if (month) params.month = month;
    if (employeeId) params.employeeId = employeeId;
    const response = await api.get('/reports/monthly', { params });
    return response.data;
  },

  // Daily Closing Report methods
  generateClosingReport: async (date) => {
    const response = await api.post('/reports/closing', { date });
    return response.data;
  },

  getClosingReports: async () => {
    const response = await api.get('/reports/closings');
    return response.data;
  },

  getClosingReport: async (uuid) => {
    const response = await api.get('/reports/closing', { params: { uuid } });
    return response.data;
  },

  // Profit & Loss Report
  getProfitLossReport: async (startDate, endDate, filters = {}) => {
    const params = { ...filters };
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    const response = await api.get('/reports/profit-loss', { params });
    return response.data;
  },

  // Custom Report
  generateCustomReport: async (config) => {
    const response = await api.post('/reports/custom', config);
    return response.data;
  },

  exportCustomReport: async (config, format = 'xlsx') => {
    const response = await api.post('/reports/custom/export', { ...config, format }, {
      responseType: 'blob'
    });
    return response;
  },

  // Export functions
  exportDailyReport: async (date, format = 'xlsx') => {
    const response = await api.get('/reports/daily/export', {
      params: { date, format },
      responseType: 'blob'
    });
    return response;
  },

  exportMonthlyReport: async (year, month, format = 'xlsx') => {
    const response = await api.get('/reports/monthly/export', {
      params: { year, month, format },
      responseType: 'blob'
    });
    return response;
  },

  exportProfitLossReport: async (startDate, endDate, format = 'xlsx') => {
    const response = await api.get('/reports/profit-loss/export', {
      params: { startDate, endDate, format },
      responseType: 'blob'
    });
    return response;
  },

  exportTransactionsReport: async (startDate, endDate, format = 'xlsx') => {
    const response = await api.get('/reports/transactions/export', {
      params: { startDate, endDate, format },
      responseType: 'blob'
    });
    return response;
  },

  exportTransactions: async (filters = {}, format = 'csv') => {
    const params = { ...filters, format };
    const response = await api.get('/reports/transactions/export', {
      params,
      responseType: 'blob'
    });
    return response;
  }
};

export default reportService;
