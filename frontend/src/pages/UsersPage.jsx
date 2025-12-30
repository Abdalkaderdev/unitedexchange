import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { Button, Input, Select, Modal, Card, Loading } from '../components/common';
import userService from '../services/userService';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  PencilIcon,
  KeyIcon
} from '@heroicons/react/24/outline';

const UsersPage = () => {
  const { t } = useTranslation();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm();
  const { register: registerPassword, handleSubmit: handlePasswordSubmit, reset: resetPassword } = useForm();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await userService.getUsers();
      if (response.success) {
        setUsers(response.data);
      }
    } catch (error) {
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingUser(null);
    reset({});
    setShowModal(true);
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    reset({
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive
    });
    setShowModal(true);
  };

  const openPasswordModal = (user) => {
    setSelectedUser(user);
    resetPassword({});
    setShowPasswordModal(true);
  };

  const onSubmit = async (data) => {
    try {
      if (editingUser) {
        await userService.updateUser(editingUser.uuid, data);
        toast.success(t('users.userUpdated'));
      } else {
        await userService.createUser(data);
        toast.success(t('users.userCreated'));
      }
      setShowModal(false);
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.message || t('common.error'));
    }
  };

  const onPasswordSubmit = async (data) => {
    try {
      await userService.resetPassword(selectedUser.uuid, data.newPassword);
      toast.success(t('users.passwordReset'));
      setShowPasswordModal(false);
    } catch (error) {
      toast.error(error.response?.data?.message || t('common.error'));
    }
  };

  const toggleUserStatus = async (user) => {
    try {
      await userService.updateUser(user.uuid, { isActive: !user.isActive });
      toast.success(t('users.userUpdated'));
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.message || t('common.error'));
    }
  };

  const roleOptions = [
    { value: 'admin', label: t('users.admin') },
    { value: 'employee', label: t('users.employee') }
  ];

  if (loading) {
    return <div className="flex justify-center py-12"><Loading size="lg" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('users.title')}</h1>
        <Button onClick={openCreateModal}>
          <PlusIcon className="h-5 w-5 mr-2 rtl:mr-0 rtl:ml-2" />
          {t('users.newUser')}
        </Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-header">{t('auth.username')}</th>
                <th className="table-header">{t('users.fullName')}</th>
                <th className="table-header">{t('auth.email')}</th>
                <th className="table-header">{t('users.role')}</th>
                <th className="table-header">{t('common.status')}</th>
                <th className="table-header">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.uuid} className="hover:bg-gray-50">
                  <td className="table-cell font-medium">{user.username}</td>
                  <td className="table-cell">{user.fullName}</td>
                  <td className="table-cell text-gray-500">{user.email}</td>
                  <td className="table-cell">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      user.role === 'admin'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {user.role === 'admin' ? t('users.admin') : t('users.employee')}
                    </span>
                  </td>
                  <td className="table-cell">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      user.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {user.isActive ? t('common.active') : t('common.inactive')}
                    </span>
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center space-x-2 rtl:space-x-reverse">
                      <button
                        onClick={() => openEditModal(user)}
                        className="p-1 text-gray-500 hover:text-primary-600"
                        title={t('common.edit')}
                      >
                        <PencilIcon className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => openPasswordModal(user)}
                        className="p-1 text-gray-500 hover:text-primary-600"
                        title={t('users.resetPassword')}
                      >
                        <KeyIcon className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => toggleUserStatus(user)}
                        className={`px-2 py-1 text-xs rounded ${
                          user.isActive
                            ? 'bg-red-100 text-red-600 hover:bg-red-200'
                            : 'bg-green-100 text-green-600 hover:bg-green-200'
                        }`}
                      >
                        {user.isActive ? t('users.deactivate') : t('users.activate')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create/Edit User Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingUser ? t('common.edit') + ' ' + t('users.title') : t('users.newUser')}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {!editingUser && (
            <Input
              label={t('auth.username')}
              {...register('username', { required: t('validation.required') })}
              error={errors.username?.message}
            />
          )}
          <Input
            label={t('auth.email')}
            type="email"
            {...register('email', { required: t('validation.required') })}
            error={errors.email?.message}
          />
          {!editingUser && (
            <Input
              label={t('auth.password')}
              type="password"
              {...register('password', {
                required: t('validation.required'),
                minLength: { value: 6, message: t('validation.minLength', { min: 6 }) }
              })}
              error={errors.password?.message}
            />
          )}
          <Input
            label={t('users.fullName')}
            {...register('fullName', { required: t('validation.required') })}
            error={errors.fullName?.message}
          />
          <Select
            label={t('users.role')}
            options={roleOptions}
            {...register('role', { required: t('validation.required') })}
            error={errors.role?.message}
          />
          <div className="flex justify-end space-x-3 rtl:space-x-reverse pt-4">
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit">
              {t('common.save')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        title={t('users.resetPassword')}
        size="sm"
      >
        <form onSubmit={handlePasswordSubmit(onPasswordSubmit)} className="space-y-4">
          <p className="text-sm text-gray-500">
            {t('users.resetPassword')} for: <strong>{selectedUser?.fullName}</strong>
          </p>
          <Input
            label={t('auth.newPassword')}
            type="password"
            {...registerPassword('newPassword', {
              required: t('validation.required'),
              minLength: { value: 6, message: t('validation.minLength', { min: 6 }) }
            })}
          />
          <div className="flex justify-end space-x-3 rtl:space-x-reverse pt-4">
            <Button variant="secondary" onClick={() => setShowPasswordModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit">
              {t('users.resetPassword')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default UsersPage;
