import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { Button, Input, Select, Modal, Card, Loading } from '../components/common';
import { Pagination } from '../components/common/Table';
import customerService from '../services/customerService';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  PencilIcon,
  MagnifyingGlassIcon,
  EyeIcon,
  NoSymbolIcon,
  CheckCircleIcon,
  TrashIcon,
  UserIcon,
  PhoneIcon,
  EnvelopeIcon,
  IdentificationIcon,
  StarIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';

const CustomersPage = () => {
  const { t } = useTranslation();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerStats, setCustomerStats] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [filters, setFilters] = useState({ isVip: '', isBlocked: '' });

  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        search: search || undefined,
        isVip: filters.isVip || undefined,
        isBlocked: filters.isBlocked || undefined
      };
      const response = await customerService.getCustomers(params);
      if (response.success) {
        setCustomers(response.data || []);
        setPagination(prev => ({ ...prev, ...response.pagination }));
      }
    } catch (error) {
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, search, filters, t]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const openCreateModal = () => {
    setEditingCustomer(null);
    reset({});
    setShowModal(true);
  };

  const openEditModal = (customer) => {
    setEditingCustomer(customer);
    reset({
      fullName: customer.fullName,
      phone: customer.phone,
      email: customer.email,
      idType: customer.idType,
      idNumber: customer.idNumber,
      address: customer.address,
      notes: customer.notes,
      isVip: customer.isVip
    });
    setShowModal(true);
  };

  const openDetailModal = async (customer) => {
    setSelectedCustomer(customer);
    setShowDetailModal(true);
    try {
      const response = await customerService.getCustomerStats(customer.uuid);
      if (response.success) {
        setCustomerStats(response.data?.overview || null);
      }
    } catch (error) {
      console.error('Failed to fetch customer stats:', error);
    }
  };

  const onSubmit = async (data) => {
    try {
      if (editingCustomer) {
        await customerService.updateCustomer(editingCustomer.uuid, data);
        toast.success(t('customers.customerUpdated'));
      } else {
        await customerService.createCustomer(data);
        toast.success(t('customers.customerCreated'));
      }
      setShowModal(false);
      fetchCustomers();
    } catch (error) {
      toast.error(error.response?.data?.message || t('common.error'));
    }
  };

  const toggleBlock = async (customer) => {
    try {
      if (customer.isBlocked) {
        await customerService.unblockCustomer(customer.uuid);
        toast.success(t('customers.customerUnblocked'));
      } else {
        await customerService.blockCustomer(customer.uuid, 'Blocked by admin');
        toast.success(t('customers.customerBlocked'));
      }
      fetchCustomers();
    } catch (error) {
      toast.error(error.response?.data?.message || t('common.error'));
    }
  };

  const deleteCustomer = async (customer) => {
    if (!window.confirm(t('customers.confirmDelete'))) return;
    try {
      await customerService.deleteCustomer(customer.uuid);
      toast.success(t('customers.customerDeleted'));
      fetchCustomers();
    } catch (error) {
      toast.error(error.response?.data?.message || t('common.error'));
    }
  };

  const idTypeOptions = [
    { value: '', label: t('common.select') },
    { value: 'passport', label: t('customers.passport') },
    { value: 'national_id', label: t('customers.nationalId') },
    { value: 'driver_license', label: t('customers.driverLicense') },
    { value: 'other', label: t('common.other') }
  ];

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
  };

  const formatCurrency = (amount) => {
    if (!amount) return '0';
    return new Intl.NumberFormat().format(amount);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">{t('customers.title')}</h1>
        <Button onClick={openCreateModal}>
          <PlusIcon className="h-5 w-5 mr-2 rtl:mr-0 rtl:ml-2" />
          {t('customers.newCustomer')}
        </Button>
      </div>

      {/* Search and Filters */}
      <Card>
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('customers.searchPlaceholder')}
              className="input pl-10 rtl:pl-3 rtl:pr-10"
            />
          </div>
          <Select
            value={filters.isVip}
            onChange={(e) => setFilters(prev => ({ ...prev, isVip: e.target.value }))}
            options={[
              { value: '', label: t('customers.allCustomers') },
              { value: 'true', label: t('customers.vipOnly') },
              { value: 'false', label: t('customers.regularOnly') }
            ]}
          />
          <Select
            value={filters.isBlocked}
            onChange={(e) => setFilters(prev => ({ ...prev, isBlocked: e.target.value }))}
            options={[
              { value: '', label: t('common.allStatus') },
              { value: 'false', label: t('common.active') },
              { value: 'true', label: t('customers.blocked') }
            ]}
          />
          <Button type="submit">{t('common.search')}</Button>
        </form>
      </Card>

      {/* Customers Table */}
      <Card>
        {loading ? (
          <div className="flex justify-center py-12"><Loading size="lg" /></div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="table-header">{t('customers.name')}</th>
                    <th className="table-header">{t('customers.contact')}</th>
                    <th className="table-header">{t('customers.idInfo')}</th>
                    <th className="table-header">{t('customers.transactions')}</th>
                    <th className="table-header">{t('common.status')}</th>
                    <th className="table-header">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {customers.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                        {t('common.noData')}
                      </td>
                    </tr>
                  ) : (
                    customers.map((customer) => (
                      <tr key={customer.uuid} className="hover:bg-gray-50">
                        <td className="table-cell">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 bg-gray-100 rounded-full flex items-center justify-center">
                              <UserIcon className="h-5 w-5 text-gray-500" />
                            </div>
                            <div className="ml-4 rtl:ml-0 rtl:mr-4">
                              <div className="flex items-center">
                                <span className="font-medium text-gray-900">{customer.fullName}</span>
                                {customer.isVip && (
                                  <StarSolidIcon className="h-4 w-4 ml-1 text-yellow-500" />
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="table-cell">
                          <div className="text-sm">
                            {customer.phone && (
                              <div className="flex items-center text-gray-600">
                                <PhoneIcon className="h-4 w-4 mr-1" />
                                {customer.phone}
                              </div>
                            )}
                            {customer.email && (
                              <div className="flex items-center text-gray-600">
                                <EnvelopeIcon className="h-4 w-4 mr-1" />
                                {customer.email}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="table-cell">
                          {customer.idType && (
                            <div className="flex items-center text-sm text-gray-600">
                              <IdentificationIcon className="h-4 w-4 mr-1" />
                              <span className="capitalize">{customer.idType.replace('_', ' ')}</span>
                              {customer.idNumber && (
                                <span className="ml-1">: {customer.idNumber}</span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="table-cell">
                          <div className="text-sm">
                            <div>{customer.totalTransactions || 0} {t('transactions.title')}</div>
                            <div className="text-gray-500">${formatCurrency(customer.totalVolume)}</div>
                          </div>
                        </td>
                        <td className="table-cell">
                          {customer.isBlocked ? (
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                              {t('customers.blocked')}
                            </span>
                          ) : (
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                              {t('common.active')}
                            </span>
                          )}
                        </td>
                        <td className="table-cell">
                          <div className="flex items-center space-x-2 rtl:space-x-reverse">
                            <button
                              onClick={() => openDetailModal(customer)}
                              className="p-1 text-gray-500 hover:text-primary-600"
                              title={t('common.view')}
                            >
                              <EyeIcon className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => openEditModal(customer)}
                              className="p-1 text-gray-500 hover:text-primary-600"
                              title={t('common.edit')}
                            >
                              <PencilIcon className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => toggleBlock(customer)}
                              className={`p-1 ${customer.isBlocked ? 'text-green-500 hover:text-green-700' : 'text-orange-500 hover:text-orange-700'}`}
                              title={customer.isBlocked ? t('customers.unblock') : t('customers.block')}
                            >
                              {customer.isBlocked ? <CheckCircleIcon className="h-5 w-5" /> : <NoSymbolIcon className="h-5 w-5" />}
                            </button>
                            <button
                              onClick={() => deleteCustomer(customer)}
                              className="p-1 text-red-500 hover:text-red-700"
                              title={t('common.delete')}
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {pagination.totalPages > 1 && (
              <Pagination
                page={pagination.page}
                totalPages={pagination.totalPages}
                onPageChange={(page) => setPagination(prev => ({ ...prev, page }))}
              />
            )}
          </>
        )}
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingCustomer ? t('customers.editCustomer') : t('customers.newCustomer')}
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label={t('customers.fullName')}
              {...register('fullName', { required: t('validation.required') })}
              error={errors.fullName?.message}
            />
            <Input
              label={t('customers.phone')}
              {...register('phone')}
            />
            <Input
              label={t('customers.email')}
              type="email"
              {...register('email')}
              error={errors.email?.message}
            />
            <Select
              label={t('customers.idType')}
              options={idTypeOptions}
              {...register('idType')}
            />
            <Input
              label={t('customers.idNumber')}
              {...register('idNumber')}
            />
            <div className="flex items-center pt-6">
              <input
                type="checkbox"
                id="isVip"
                {...register('isVip')}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="isVip" className="ml-2 rtl:ml-0 rtl:mr-2 flex items-center">
                <StarIcon className="h-5 w-5 text-yellow-500 mr-1" />
                {t('customers.vipCustomer')}
              </label>
            </div>
          </div>
          <Input
            label={t('customers.address')}
            {...register('address')}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('common.notes')}
            </label>
            <textarea
              {...register('notes')}
              rows={3}
              className="input"
            />
          </div>
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

      {/* Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => { setShowDetailModal(false); setCustomerStats(null); }}
        title={t('customers.customerDetails')}
        size="lg"
      >
        {selectedCustomer && (
          <div className="space-y-6">
            <div className="flex items-center">
              <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center">
                <UserIcon className="h-8 w-8 text-gray-500" />
              </div>
              <div className="ml-4 rtl:ml-0 rtl:mr-4">
                <div className="flex items-center">
                  <h3 className="text-lg font-semibold">{selectedCustomer.fullName}</h3>
                  {selectedCustomer.isVip && (
                    <StarSolidIcon className="h-5 w-5 ml-2 text-yellow-500" />
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-500">{t('customers.phone')}</label>
                <p className="font-medium">{selectedCustomer.phone || '-'}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">{t('customers.email')}</label>
                <p className="font-medium">{selectedCustomer.email || '-'}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">{t('customers.idType')}</label>
                <p className="font-medium capitalize">{selectedCustomer.idType?.replace('_', ' ') || '-'}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">{t('customers.idNumber')}</label>
                <p className="font-medium">{selectedCustomer.idNumber || '-'}</p>
              </div>
              <div className="col-span-2">
                <label className="text-sm text-gray-500">{t('customers.address')}</label>
                <p className="font-medium">{selectedCustomer.address || '-'}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">{t('customers.memberSince')}</label>
                <p className="font-medium">{formatDate(selectedCustomer.createdAt)}</p>
              </div>
            </div>

            {customerStats && (
              <div className="border-t pt-4">
                <h4 className="font-medium mb-4">{t('customers.statistics')}</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg text-center">
                    <p className="text-2xl font-bold text-primary-600">{customerStats.completedTransactions || 0}</p>
                    <p className="text-sm text-gray-500">{t('transactions.title')}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg text-center">
                    <p className="text-2xl font-bold text-green-600">${formatCurrency(customerStats.totalVolumeIn)}</p>
                    <p className="text-sm text-gray-500">{t('reports.totalVolume')}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg text-center">
                    <p className="text-2xl font-bold text-blue-600">{formatDate(customerStats.lastTransactionDate)}</p>
                    <p className="text-sm text-gray-500">{t('customers.lastTransaction')}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default CustomersPage;
