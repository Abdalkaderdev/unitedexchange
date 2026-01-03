import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { Button, Input, Select, Modal, Card, Loading } from '../components/common';
import { Pagination } from '../components/common/Table';
import { OpenShiftModal, CloseShiftModal } from '../components/shifts';
import shiftService from '../services/shiftService';
import userService from '../services/userService';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import {
  PlayIcon,
  StopIcon,
  ArrowsRightLeftIcon,
  EyeIcon,
  ClockIcon,
  UserIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline';

const ShiftsPage = () => {
  const { t } = useTranslation();
  const { user, isAdmin } = useAuth();
  const [shifts, setShifts] = useState([]);
  const [activeShift, setActiveShift] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showStartModal, setShowStartModal] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);
  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedShift, setSelectedShift] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [statusFilter, setStatusFilter] = useState('');

  const { register: registerHandover, handleSubmit: handleHandoverSubmit, reset: resetHandover } = useForm();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [shiftsRes, activeRes] = await Promise.all([
        shiftService.getShifts({
          page: pagination.page,
          limit: pagination.limit,
          status: statusFilter || undefined
        }),
        shiftService.getActiveShift()
      ]);

      if (shiftsRes.success) {
        // Normalize shift data for display
        const normalizedShifts = (shiftsRes.data || []).map(s => ({
          ...s,
          employee_name: s.employee?.fullName || s.employeeName || 'Unknown',
          start_time: s.startTime || s.start_time,
          end_time: s.endTime || s.end_time,
          transaction_count: s.summary?.totalTransactions || 0
        }));
        setShifts(normalizedShifts);
        setPagination(prev => ({ ...prev, ...shiftsRes.pagination }));
      }

      if (activeRes.success && activeRes.data) {
        // Normalize active shift data
        setActiveShift({
          ...activeRes.data,
          start_time: activeRes.data.startTime,
          transaction_count: activeRes.data.currentStats?.transactionCount || 0
        });
      }

      // Fetch users for handover (admin only)
      if (isAdmin()) {
        const usersRes = await userService.getUsers();
        if (usersRes.success) {
          setUsers(usersRes.data || []);
        }
      }
    } catch (error) {
      console.error('Failed to fetch shifts:', error);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, statusFilter, isAdmin]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleShiftStarted = () => {
    setShowStartModal(false);
    fetchData();
  };

  const handleShiftEnded = () => {
    setShowEndModal(false);
    fetchData();
  };

  const handoverShift = async (data) => {
    try {
      await shiftService.handoverShift(activeShift.uuid, data.toEmployeeUuid, data.notes);
      toast.success(t('shifts.shiftHandedOver'));
      setShowHandoverModal(false);
      resetHandover({});
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || t('common.error'));
    }
  };

  const viewShiftDetails = async (shift) => {
    try {
      const response = await shiftService.getShift(shift.uuid);
      if (response.success && response.data) {
        // Normalize shift detail data
        setSelectedShift({
          ...response.data,
          employee_name: response.data.employee?.fullName || 'Unknown',
          start_time: response.data.startTime,
          end_time: response.data.endTime,
          transaction_count: response.data.summary?.totalTransactions || 0,
          summary: response.data.summary ? {
            total_transactions: response.data.summary.totalTransactions || 0,
            total_volume: response.data.summary.totalVolumeIn || 0,
            total_profit: response.data.summary.totalProfit || 0
          } : null
        });
        setShowDetailModal(true);
      }
    } catch (error) {
      toast.error(t('common.error'));
    }
  };

  const abandonShift = async (shift) => {
    if (!window.confirm(t('shifts.confirmAbandon'))) return;
    try {
      await shiftService.abandonShift(shift.uuid, 'Abandoned by admin');
      toast.success(t('shifts.shiftAbandoned'));
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || t('common.error'));
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString();
  };

  const formatDuration = (startTime, endTime) => {
    if (!startTime) return '-';
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const diffMs = end - start;
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      active: { bg: 'bg-green-100', text: 'text-green-800', label: t('shifts.active') },
      completed: { bg: 'bg-blue-100', text: 'text-blue-800', label: t('shifts.completed') },
      handed_over: { bg: 'bg-purple-100', text: 'text-purple-800', label: t('shifts.handedOver') },
      abandoned: { bg: 'bg-red-100', text: 'text-red-800', label: t('shifts.abandoned') }
    };
    const config = statusConfig[status] || statusConfig.completed;
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loading size="lg" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('shifts.title')}</h1>
        {!activeShift ? (
          <Button onClick={() => setShowStartModal(true)}>
            <PlayIcon className="h-5 w-5 mr-2 rtl:mr-0 rtl:ml-2" />
            {t('shifts.startShift')}
          </Button>
        ) : (
          <div className="flex space-x-2 rtl:space-x-reverse">
            <Button variant="secondary" onClick={() => setShowHandoverModal(true)}>
              <ArrowsRightLeftIcon className="h-5 w-5 mr-2 rtl:mr-0 rtl:ml-2" />
              {t('shifts.handover')}
            </Button>
            <Button variant="danger" onClick={() => setShowEndModal(true)}>
              <StopIcon className="h-5 w-5 mr-2 rtl:mr-0 rtl:ml-2" />
              {t('shifts.endShift')}
            </Button>
          </div>
        )}
      </div>

      {/* Active Shift Card */}
      {activeShift && (
        <Card className="bg-green-50 border-green-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                <ClockIcon className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4 rtl:ml-0 rtl:mr-4">
                <h3 className="font-semibold text-green-800">{t('shifts.activeShift')}</h3>
                <p className="text-sm text-green-600">
                  {t('shifts.startedAt')}: {formatDateTime(activeShift.start_time)}
                </p>
                <p className="text-sm text-green-600">
                  {t('shifts.duration')}: {formatDuration(activeShift.start_time)}
                </p>
              </div>
            </div>
            <div className="text-right rtl:text-left">
              <p className="text-2xl font-bold text-green-700">
                {activeShift.transaction_count || 0}
              </p>
              <p className="text-sm text-green-600">{t('transactions.title')}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Filter */}
      <Card>
        <div className="flex items-center space-x-4 rtl:space-x-reverse">
          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPagination(prev => ({ ...prev, page: 1 }));
            }}
            options={[
              { value: '', label: t('common.allStatus') },
              { value: 'active', label: t('shifts.active') },
              { value: 'completed', label: t('shifts.completed') },
              { value: 'abandoned', label: t('shifts.abandoned') }
            ]}
          />
        </div>
      </Card>

      {/* Shifts Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-header">{t('shifts.employee')}</th>
                <th className="table-header">{t('shifts.startTime')}</th>
                <th className="table-header">{t('shifts.endTime')}</th>
                <th className="table-header">{t('shifts.duration')}</th>
                <th className="table-header">{t('transactions.title')}</th>
                <th className="table-header">{t('common.status')}</th>
                <th className="table-header">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {shifts.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                    {t('common.noData')}
                  </td>
                </tr>
              ) : (
                shifts.map((shift) => (
                  <tr key={shift.uuid} className="hover:bg-gray-50">
                    <td className="table-cell">
                      <div className="flex items-center">
                        <div className="h-8 w-8 bg-gray-100 rounded-full flex items-center justify-center">
                          <UserIcon className="h-4 w-4 text-gray-500" />
                        </div>
                        <span className="ml-2 rtl:ml-0 rtl:mr-2 font-medium">{shift.employee_name}</span>
                      </div>
                    </td>
                    <td className="table-cell">{formatDateTime(shift.start_time)}</td>
                    <td className="table-cell">{formatDateTime(shift.end_time)}</td>
                    <td className="table-cell">{formatDuration(shift.start_time, shift.end_time)}</td>
                    <td className="table-cell font-medium">{shift.transaction_count || 0}</td>
                    <td className="table-cell">{getStatusBadge(shift.status)}</td>
                    <td className="table-cell">
                      <div className="flex items-center space-x-2 rtl:space-x-reverse">
                        <button
                          onClick={() => viewShiftDetails(shift)}
                          className="p-1 text-gray-500 hover:text-primary-600"
                          title={t('common.view')}
                        >
                          <EyeIcon className="h-5 w-5" />
                        </button>
                        {isAdmin() && shift.status === 'active' && shift.user_id !== user?.id && (
                          <button
                            onClick={() => abandonShift(shift)}
                            className="p-1 text-red-500 hover:text-red-700"
                            title={t('shifts.abandon')}
                          >
                            <ExclamationCircleIcon className="h-5 w-5" />
                          </button>
                        )}
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
      </Card>

      {/* Start Shift Modal */}
      <OpenShiftModal
        isOpen={showStartModal}
        onClose={() => setShowStartModal(false)}
        onSuccess={handleShiftStarted}
      />

      {/* End Shift Modal */}
      <CloseShiftModal
        isOpen={showEndModal}
        onClose={() => setShowEndModal(false)}
        shift={activeShift}
        onSuccess={handleShiftEnded}
      />

      {/* Handover Modal */}
      <Modal
        isOpen={showHandoverModal}
        onClose={() => setShowHandoverModal(false)}
        title={t('shifts.handover')}
      >
        <form onSubmit={handleHandoverSubmit(handoverShift)} className="space-y-4">
          <p className="text-sm text-gray-500">{t('shifts.handoverConfirm')}</p>
          <Select
            label={t('shifts.handoverTo')}
            options={[
              { value: '', label: t('common.select') },
              ...users.filter(u => u.uuid !== user?.uuid && u.isActive).map(u => ({
                value: u.uuid,
                label: u.fullName
              }))
            ]}
            {...registerHandover('toEmployeeUuid', { required: t('validation.required') })}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('common.notes')}
            </label>
            <textarea
              {...registerHandover('notes')}
              rows={3}
              className="input"
            />
          </div>
          <div className="flex justify-end space-x-3 rtl:space-x-reverse pt-4">
            <Button variant="secondary" onClick={() => setShowHandoverModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit">
              <ArrowsRightLeftIcon className="h-5 w-5 mr-2" />
              {t('shifts.handover')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Shift Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title={t('shifts.shiftDetails')}
        size="lg"
      >
        {selectedShift && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-500">{t('shifts.employee')}</label>
                <p className="font-medium">{selectedShift.employee_name}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">{t('common.status')}</label>
                <p>{getStatusBadge(selectedShift.status)}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">{t('shifts.startTime')}</label>
                <p className="font-medium">{formatDateTime(selectedShift.start_time)}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">{t('shifts.endTime')}</label>
                <p className="font-medium">{formatDateTime(selectedShift.end_time)}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">{t('shifts.duration')}</label>
                <p className="font-medium">{formatDuration(selectedShift.start_time, selectedShift.end_time)}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">{t('transactions.title')}</label>
                <p className="font-medium">{selectedShift.transaction_count || 0}</p>
              </div>
            </div>

            {selectedShift.notes && (
              <div>
                <label className="text-sm text-gray-500">{t('common.notes')}</label>
                <p className="mt-1 text-gray-700 bg-gray-50 p-3 rounded">{selectedShift.notes}</p>
              </div>
            )}

            {selectedShift.summary && (
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">{t('shifts.summary')}</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg text-center">
                    <p className="text-2xl font-bold text-blue-600">{selectedShift.summary.total_transactions}</p>
                    <p className="text-sm text-gray-500">{t('transactions.title')}</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg text-center">
                    <p className="text-2xl font-bold text-green-600">${selectedShift.summary.total_volume?.toLocaleString()}</p>
                    <p className="text-sm text-gray-500">{t('reports.totalVolume')}</p>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg text-center">
                    <p className="text-2xl font-bold text-purple-600">${selectedShift.summary.total_profit?.toLocaleString()}</p>
                    <p className="text-sm text-gray-500">{t('reports.profit')}</p>
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

export default ShiftsPage;
