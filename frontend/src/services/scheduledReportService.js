import api from './api';

const scheduledReportService = {
    /**
     * Get all scheduled reports
     * @param {Object} params - Query parameters (page, limit, isActive)
     */
    getSchedules: async (params = {}) => {
        try {
            const response = await api.get('/scheduled-reports', { params });
            return response.data;
        } catch (error) {
            throw error;
        }
    },

    /**
     * Get a single scheduled report
     * @param {string} uuid
     */
    getSchedule: async (uuid) => {
        try {
            const response = await api.get(`/scheduled-reports/${uuid}`);
            return response.data;
        } catch (error) {
            throw error;
        }
    },

    /**
     * Create a new scheduled report
     * @param {Object} data
     */
    createSchedule: async (data) => {
        try {
            const response = await api.post('/scheduled-reports', data);
            return response.data;
        } catch (error) {
            throw error;
        }
    },

    /**
     * Update a scheduled report
     * @param {string} uuid
     * @param {Object} data
     */
    updateSchedule: async (uuid, data) => {
        try {
            const response = await api.put(`/scheduled-reports/${uuid}`, data);
            return response.data;
        } catch (error) {
            throw error;
        }
    },

    /**
     * Delete a scheduled report
     * @param {string} uuid
     */
    deleteSchedule: async (uuid) => {
        try {
            const response = await api.delete(`/scheduled-reports/${uuid}`);
            return response.data;
        } catch (error) {
            throw error;
        }
    },

    /**
     * Manually trigger a scheduled report
     * @param {string} uuid
     */
    runScheduleNow: async (uuid) => {
        try {
            const response = await api.post(`/scheduled-reports/${uuid}/run`);
            return response.data;
        } catch (error) {
            throw error;
        }
    },

    /**
     * Get execution history
     * @param {string} uuid
     * @param {Object} params
     */
    getScheduleHistory: async (uuid, params = {}) => {
        try {
            const response = await api.get(`/scheduled-reports/${uuid}/history`, { params });
            return response.data;
        } catch (error) {
            throw error;
        }
    }
};

export default scheduledReportService;
