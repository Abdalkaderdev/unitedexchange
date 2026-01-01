import api from './api';

export const currencyService = {
  getCurrencies: async (active) => {
    const params = active !== undefined ? { active } : {};
    const response = await api.get('/currencies', { params });
    return response.data.data || [];
  },

  createCurrency: async (data) => {
    const response = await api.post('/currencies', data);
    return response.data;
  },

  updateCurrency: async (id, data) => {
    const response = await api.put(`/currencies/${id}`, data);
    return response.data;
  },

  getExchangeRates: async () => {
    const response = await api.get('/currencies/rates');
    return response.data.data || [];
  },

  setExchangeRate: async (data) => {
    const response = await api.post('/currencies/rates', data);
    return response.data;
  },

  // Get rate history for a specific currency pair
  getRateHistory: async (fromCurrencyId, toCurrencyId, page = 1, limit = 10) => {
    const response = await api.get('/currencies/rates/history', {
      params: {
        fromCurrencyId,
        toCurrencyId,
        page,
        limit
      }
    });
    return response.data;
  },

  // Get all rate history with optional filters
  getAllRateHistory: async ({ fromCurrencyId, toCurrencyId, startDate, endDate, page = 1, limit = 20 } = {}) => {
    const params = { page, limit };
    if (fromCurrencyId) params.fromCurrencyId = fromCurrencyId;
    if (toCurrencyId) params.toCurrencyId = toCurrencyId;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;

    const response = await api.get('/currencies/rates/history', { params });
    return response.data;
  }
};

export default currencyService;
