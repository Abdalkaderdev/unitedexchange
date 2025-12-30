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
  }
};

export default transactionService;
