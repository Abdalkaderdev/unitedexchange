import api from './api';

const cashDrawerService = {
  getDrawers: async (params = {}) => {
    const response = await api.get('/cash-drawers', { params });
    return response.data;
  },

  getDrawer: async (uuid) => {
    const response = await api.get(`/cash-drawers/${uuid}`);
    return response.data;
  },

  createDrawer: async (data) => {
    const response = await api.post('/cash-drawers', data);
    return response.data;
  },

  updateDrawer: async (uuid, data) => {
    const response = await api.put(`/cash-drawers/${uuid}`, data);
    return response.data;
  },

  deposit: async (uuid, data) => {
    const response = await api.post(`/cash-drawers/${uuid}/deposit`, data);
    return response.data;
  },

  withdraw: async (uuid, data) => {
    const response = await api.post(`/cash-drawers/${uuid}/withdraw`, data);
    return response.data;
  },

  adjust: async (uuid, data) => {
    const response = await api.post(`/cash-drawers/${uuid}/adjust`, data);
    return response.data;
  },

  reconcile: async (uuid, data) => {
    const response = await api.post(`/cash-drawers/${uuid}/reconcile`, data);
    return response.data;
  },

  getHistory: async (uuid, params = {}) => {
    const response = await api.get(`/cash-drawers/${uuid}/history`, { params });
    return response.data;
  },

  getAlerts: async () => {
    const response = await api.get('/cash-drawers/alerts');
    return response.data;
  },

  getStatus: async (id) => {
    const response = await api.get(`/cash-drawers/${id}/status`);
    return response.data;
  },

  submitClosing: async (drawerId, data) => {
    const response = await api.post(`/cash-drawers/${drawerId}/close`, data);
    return response.data;
  }
};

export default cashDrawerService;
