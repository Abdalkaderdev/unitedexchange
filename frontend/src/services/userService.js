import api from './api';

export const userService = {
  getUsers: async (params = {}) => {
    const response = await api.get('/users', { params });
    return response.data;
  },

  // Get employee list for filters (accessible by all authenticated users)
  getEmployees: async () => {
    const response = await api.get('/users/employees');
    return response.data;
  },

  createUser: async (data) => {
    const response = await api.post('/users', data);
    return response.data;
  },

  updateUser: async (uuid, data) => {
    const response = await api.put(`/users/${uuid}`, data);
    return response.data;
  },

  resetPassword: async (uuid, newPassword) => {
    const response = await api.put(`/users/${uuid}/reset-password`, { newPassword });
    return response.data;
  }
};

export default userService;
