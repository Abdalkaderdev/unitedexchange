import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Button, Loading } from '../components/common';
import permissionService from '../services/permissionService';
import toast from 'react-hot-toast';
import {
  ShieldCheckIcon,
  UserGroupIcon,
  CheckIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

const PermissionsPage = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [permissions, setPermissions] = useState([]);
  const [roles, setRoles] = useState([]);
  const [matrix, setMatrix] = useState({});
  const [selectedRole, setSelectedRole] = useState('manager');
  const [editMode, setEditMode] = useState(false);
  const [editedPermissions, setEditedPermissions] = useState([]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [rolesRes, matrixRes] = await Promise.all([
        permissionService.getRoles(),
        permissionService.getPermissionMatrix()
      ]);

      if (rolesRes.success) {
        setRoles(rolesRes.data);
      }

      if (matrixRes.success) {
        setPermissions(matrixRes.data.permissions);
        setMatrix(matrixRes.data.matrix);
      }
    } catch (error) {
      toast.error(t('common.error'));
      console.error('Error fetching permissions:', error);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (matrix[selectedRole]) {
      setEditedPermissions([...matrix[selectedRole]]);
    }
  }, [selectedRole, matrix]);

  const handleTogglePermission = (permissionId) => {
    if (!editMode) return;

    setEditedPermissions(prev => {
      if (prev.includes(permissionId)) {
        return prev.filter(id => id !== permissionId);
      } else {
        return [...prev, permissionId];
      }
    });
  };

  const handleSave = async () => {
    if (selectedRole === 'admin') {
      toast.error(t('permissions.cannotEditAdmin'));
      return;
    }

    try {
      setSaving(true);
      const response = await permissionService.updateRolePermissions(
        selectedRole,
        editedPermissions
      );

      if (response.success) {
        toast.success(t('permissions.saved'));
        setMatrix(prev => ({
          ...prev,
          [selectedRole]: editedPermissions
        }));
        setEditMode(false);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedPermissions([...matrix[selectedRole]]);
    setEditMode(false);
  };

  const groupedPermissions = permissions.reduce((acc, perm) => {
    if (!acc[perm.category]) {
      acc[perm.category] = [];
    }
    acc[perm.category].push(perm);
    return acc;
  }, {});

  const categoryLabels = {
    transactions: t('nav.transactions'),
    customers: t('nav.customers'),
    currencies: t('nav.currencies'),
    reports: t('nav.reports'),
    audit: t('nav.auditLogs'),
    cash_drawer: t('nav.cashDrawers'),
    shifts: t('nav.shifts'),
    users: t('nav.users'),
    settings: t('nav.settings')
  };

  const roleLabels = {
    admin: t('users.admin'),
    manager: t('permissions.manager') || 'Manager',
    teller: t('permissions.teller') || 'Teller',
    viewer: t('permissions.viewer') || 'Viewer'
  };

  const hasPermission = (permId) => {
    if (editMode) {
      return editedPermissions.includes(permId);
    }
    return matrix[selectedRole]?.includes(permId);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loading size="lg" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('permissions.title') || 'Role Permissions'}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {t('permissions.subtitle') || 'Manage what each role can access and do'}
          </p>
        </div>
      </div>

      {/* Role Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {roles.map(role => (
          <Card
            key={role.id}
            className={`cursor-pointer transition-all ${
              selectedRole === role.id
                ? 'ring-2 ring-primary-500 bg-primary-50'
                : 'hover:bg-gray-50'
            }`}
            onClick={() => {
              if (!editMode) {
                setSelectedRole(role.id);
              }
            }}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${
                selectedRole === role.id ? 'bg-primary-100' : 'bg-gray-100'
              }`}>
                {role.id === 'admin' ? (
                  <ShieldCheckIcon className="h-6 w-6 text-primary-600" />
                ) : (
                  <UserGroupIcon className="h-6 w-6 text-gray-600" />
                )}
              </div>
              <div>
                <h3 className="font-medium text-gray-900">{roleLabels[role.id]}</h3>
                <p className="text-sm text-gray-500">
                  {role.userCount} {t('permissions.users') || 'users'}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Permission Matrix */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {roleLabels[selectedRole]} {t('permissions.permissions') || 'Permissions'}
          </h2>
          {selectedRole !== 'admin' && (
            <div className="flex gap-2">
              {editMode ? (
                <>
                  <Button variant="secondary" onClick={handleCancel} disabled={saving}>
                    {t('common.cancel')}
                  </Button>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? t('common.loading') : t('common.save')}
                  </Button>
                </>
              ) : (
                <Button onClick={() => setEditMode(true)}>
                  {t('common.edit')}
                </Button>
              )}
            </div>
          )}
        </div>

        {selectedRole === 'admin' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4 text-sm text-yellow-800">
            {t('permissions.adminNote') || 'Administrators have full access to all features. Their permissions cannot be modified.'}
          </div>
        )}

        <div className="space-y-6">
          {Object.entries(groupedPermissions).map(([category, perms]) => (
            <div key={category}>
              <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wider mb-3">
                {categoryLabels[category] || category}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {perms.map(perm => {
                  const isChecked = hasPermission(perm.id);
                  const isDisabled = !editMode || selectedRole === 'admin';

                  return (
                    <div
                      key={perm.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border ${
                        isChecked
                          ? 'bg-green-50 border-green-200'
                          : 'bg-gray-50 border-gray-200'
                      } ${!isDisabled ? 'cursor-pointer hover:bg-opacity-80' : ''}`}
                      onClick={() => handleTogglePermission(perm.id)}
                    >
                      <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                        isChecked ? 'bg-green-500' : 'bg-gray-300'
                      }`}>
                        {isChecked ? (
                          <CheckIcon className="h-4 w-4 text-white" />
                        ) : (
                          <XMarkIcon className="h-4 w-4 text-white" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {perm.name}
                        </p>
                        {perm.description && (
                          <p className="text-xs text-gray-500 truncate">
                            {perm.description}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default PermissionsPage;
