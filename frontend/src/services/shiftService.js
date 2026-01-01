import api from './api';

const shiftService = {
  getShifts: async (params = {}) => {
    const response = await api.get('/shifts', { params });
    return response.data;
  },

  getShift: async (uuid) => {
    const response = await api.get(`/shifts/${uuid}`);
    return response.data;
  },

  getActiveShift: async () => {
    const response = await api.get('/shifts/active');
    return response.data;
  },

  startShift: async (data = {}) => {
    const response = await api.post('/shifts/start', data);
    return response.data;
  },

  endShift: async (uuid, data = {}) => {
    const response = await api.post(`/shifts/${uuid}/end`, data);
    return response.data;
  },

  handoverShift: async (uuid, toEmployeeUuid, notes = '') => {
    const response = await api.post(`/shifts/${uuid}/handover`, {
      toEmployeeUuid,
      notes
    });
    return response.data;
  },

  abandonShift: async (uuid, reason = '') => {
    const response = await api.post(`/shifts/${uuid}/abandon`, { reason });
    return response.data;
  },

  getExpectedBalances: async (uuid) => {
    const response = await api.get(`/shifts/${uuid}/expected-balances`);
    return response.data;
  }
};

export default shiftService;
