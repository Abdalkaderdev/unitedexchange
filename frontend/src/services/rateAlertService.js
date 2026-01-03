import api from './api';

const rateAlertService = {
    getAlerts: async () => {
        const response = await api.get('/rate-alerts');
        return response.data.data;
    },

    createAlert: async (data) => {
        const response = await api.post('/rate-alerts', data);
        return response.data;
    },

    deleteAlert: async (uuid) => {
        const response = await api.delete(`/rate-alerts/${uuid}`);
        return response.data;
    }
};

export default rateAlertService;
