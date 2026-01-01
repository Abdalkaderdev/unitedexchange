import api from './api';

export const transactionService = {
  getTransactions: async (params = {}) => {
    const response = await api.get('/transactions', { params });
    return response.data;
  },

  getTransaction: async (uuid) => {
    const response = await api.get(`/transactions/${uuid}`);
    return response.data;
  },

  createTransaction: async (data) => {
    const response = await api.post('/transactions', data);
    return response.data;
  },

  cancelTransaction: async (uuid, reason) => {
    const response = await api.post(`/transactions/${uuid}/cancel`, { reason });
    return response.data;
  },

  deleteTransaction: async (uuid) => {
    const response = await api.delete(`/transactions/${uuid}`);
    return response.data;
  },

  updateTransaction: async (uuid, data) => {
    const response = await api.put(`/transactions/${uuid}`, data);
    return response.data;
  },

  // Receipt methods
  getReceipt: async (uuid, options = {}) => {
    const { type = 'customer', download = false, lang = 'en' } = options;
    const response = await api.get(`/transactions/${uuid}/receipt`, {
      params: { type, download: download ? 'true' : 'false', lang },
      responseType: 'blob'
    });
    return response.data;
  },

  emailReceipt: async (uuid, email, options = {}) => {
    const { type = 'customer', lang = 'en' } = options;
    const response = await api.post(`/transactions/${uuid}/receipt/email`, {
      email,
      type,
      lang
    });
    return response.data;
  },

  getReceiptHistory: async (uuid) => {
    const response = await api.get(`/transactions/${uuid}/receipt/history`);
    return response.data;
  },

  logReceiptAction: async (uuid, action, options = {}) => {
    const { type = 'customer', lang = 'en' } = options;
    const response = await api.post(`/transactions/${uuid}/receipt/log`, {
      action,
      type,
      lang
    });
    return response.data;
  }
};

export default transactionService;
