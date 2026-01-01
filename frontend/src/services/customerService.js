import api from './api';

const customerService = {
  getCustomers: async (params = {}) => {
    const response = await api.get('/customers', { params });
    return response.data;
  },

  getCustomer: async (uuid) => {
    const response = await api.get(`/customers/${uuid}`);
    return response.data;
  },

  createCustomer: async (data) => {
    const response = await api.post('/customers', data);
    return response.data;
  },

  updateCustomer: async (uuid, data) => {
    const response = await api.put(`/customers/${uuid}`, data);
    return response.data;
  },

  deleteCustomer: async (uuid) => {
    const response = await api.delete(`/customers/${uuid}`);
    return response.data;
  },

  blockCustomer: async (uuid, reason) => {
    const response = await api.post(`/customers/${uuid}/block`, { reason });
    return response.data;
  },

  unblockCustomer: async (uuid) => {
    const response = await api.post(`/customers/${uuid}/unblock`);
    return response.data;
  },

  getCustomerTransactions: async (uuid, params = {}) => {
    const response = await api.get(`/customers/${uuid}/transactions`, { params });
    return response.data;
  },

  getCustomerStats: async (uuid) => {
    const response = await api.get(`/customers/${uuid}/stats`);
    return response.data;
  },

  searchCustomers: async (search) => {
    const response = await api.get('/customers', { params: { search, limit: 10 } });
    return response.data;
  },

  // Bulk update customers (block/unblock/VIP)
  bulkUpdate: async (uuids, action, reason = null) => {
    const data = { uuids, action };
    if (reason) data.reason = reason;
    const response = await api.put('/customers/bulk/update', data);
    return response.data;
  }
};

export default customerService;
