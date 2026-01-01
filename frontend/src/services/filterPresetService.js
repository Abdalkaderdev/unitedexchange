import api from './api';

const filterPresetService = {
  getPresets: async (resourceType) => {
    const response = await api.get('/filter-presets', { params: { resourceType } });
    return response.data;
  },

  createPreset: async (data) => {
    const response = await api.post('/filter-presets', data);
    return response.data;
  },

  updatePreset: async (uuid, data) => {
    const response = await api.put(`/filter-presets/${uuid}`, data);
    return response.data;
  },

  deletePreset: async (uuid) => {
    const response = await api.delete(`/filter-presets/${uuid}`);
    return response.data;
  }
};

export default filterPresetService;
