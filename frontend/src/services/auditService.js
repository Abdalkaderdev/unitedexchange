import api from './api';

const auditService = {
  getLogs: async (params = {}) => {
    const response = await api.get('/audit-logs', { params });
    return response.data;
  },

  getLog: async (id) => {
    const response = await api.get(`/audit-logs/${id}`);
    return response.data;
  },

  getResourceHistory: async (type, id, params = {}) => {
    const response = await api.get(`/audit-logs/resource/${type}/${id}`, { params });
    return response.data;
  },

  getStats: async (days = 7) => {
    const response = await api.get('/audit-logs/stats', { params: { days } });
    return response.data;
  }
};

export default auditService;
