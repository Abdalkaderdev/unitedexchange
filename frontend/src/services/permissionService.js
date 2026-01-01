import api from './api';

const permissionService = {
  // Get all permissions
  getAllPermissions: async () => {
    const response = await api.get('/permissions');
    return response.data;
  },

  // Get all roles with user counts
  getRoles: async () => {
    const response = await api.get('/permissions/roles');
    return response.data;
  },

  // Get permission matrix (all roles with their permissions)
  getPermissionMatrix: async () => {
    const response = await api.get('/permissions/matrix');
    return response.data;
  },

  // Get permissions for a specific role
  getRolePermissions: async (role) => {
    const response = await api.get(`/permissions/roles/${role}`);
    return response.data;
  },

  // Update permissions for a role
  updateRolePermissions: async (role, permissionIds) => {
    const response = await api.put(`/permissions/roles/${role}`, { permissionIds });
    return response.data;
  }
};

export default permissionService;
