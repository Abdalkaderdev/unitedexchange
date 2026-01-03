import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { Button, Input, Select, Modal, Card, Loading } from '../components/common';
import cashDrawerService from '../services/cashDrawerService';
import currencyService from '../services/currencyService';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  PencilIcon,
  BanknotesIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  ClipboardDocumentCheckIcon,
  ExclamationTriangleIcon,
  ClockIcon
} from '@heroicons/react/24/outline';

const CashDrawersPage = () => {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const [drawers, setDrawers] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [editingDrawer, setEditingDrawer] = useState(null);
  const [selectedDrawer, setSelectedDrawer] = useState(null);
  const [transactionType, setTransactionType] = useState('deposit');
  const [history, setHistory] = useState([]);
  const [alerts, setAlerts] = useState([]);

  const { register, handleSubmit, reset, formState: { errors } } = useForm();
  const { register: registerTx, handleSubmit: handleTxSubmit, reset: resetTx } = useForm();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [drawersRes, currenciesRes, alertsRes] = await Promise.all([
        cashDrawerService.getDrawers(),
        currencyService.getCurrencies(),
        cashDrawerService.getAlerts()
      ]);

      if (drawersRes.success) setDrawers(drawersRes.data || []);
      if (currenciesRes.success) setCurrencies(currenciesRes.data || []);
      if (alertsRes.success) setAlerts(alertsRes.data || []);
    } catch (error) {
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingDrawer(null);
    reset({});
    setShowModal(true);
  };

  const openEditModal = (drawer) => {
    setEditingDrawer(drawer);
    reset({
      name: drawer.name,
      location: drawer.location,
      lowBalanceAlert: drawer.low_balance_alert,
      isActive: drawer.is_active
    });
    setShowModal(true);
  };

  const openTransactionModal = (drawer, type) => {
    setSelectedDrawer(drawer);
    setTransactionType(type);
    resetTx({});
    setShowTransactionModal(true);
  };

  const openHistoryModal = async (drawer) => {
    setSelectedDrawer(drawer);
    setShowHistoryModal(true);
    try {
      const response = await cashDrawerService.getHistory(drawer.uuid, { limit: 50 });
      if (response.success) {
        setHistory(response.transactions || []);
      }
    } catch (error) {
      toast.error(t('common.error'));
    }
  };

  const onSubmit = async (data) => {
    try {
      if (editingDrawer) {
        await cashDrawerService.updateDrawer(editingDrawer.uuid, data);
        toast.success(t('cashDrawers.drawerUpdated'));
      } else {
        await cashDrawerService.createDrawer(data);
        toast.success(t('cashDrawers.drawerCreated'));
      }
      setShowModal(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || t('common.error'));
    }
  };

  const onTransactionSubmit = async (data) => {
    try {
      const payload = {
        currencyId: parseInt(data.currencyId),
        amount: parseFloat(data.amount),
        notes: data.notes
      };

      if (transactionType === 'deposit') {
        await cashDrawerService.deposit(selectedDrawer.uuid, payload);
        toast.success(t('cashDrawers.depositSuccess'));
      } else if (transactionType === 'withdraw') {
        await cashDrawerService.withdraw(selectedDrawer.uuid, payload);
        toast.success(t('cashDrawers.withdrawSuccess'));
      } else if (transactionType === 'adjust') {
        await cashDrawerService.adjust(selectedDrawer.uuid, {
          currencyId: parseInt(data.currencyId),
          newBalance: parseFloat(data.amount),
          reason: data.notes
        });
        toast.success(t('cashDrawers.adjustSuccess'));
      } else if (transactionType === 'reconcile') {
        await cashDrawerService.reconcile(selectedDrawer.uuid, {
          currencyId: parseInt(data.currencyId),
          actualBalance: parseFloat(data.amount),
          notes: data.notes
        });
        toast.success(t('cashDrawers.reconcileSuccess'));
      }

      setShowTransactionModal(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || t('common.error'));
    }
  };

  const formatCurrency = (amount, currencyCode) => {
    if (amount === null || amount === undefined) return '0';
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString();
  };

  const currencyOptions = currencies.map(c => ({
    value: c.id,
    label: `${c.code} - ${c.name}`
  }));

  if (loading) {
    return <div className="flex justify-center py-12"><Loading size="lg" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('cashDrawers.title')}</h1>
        {isAdmin() && (
          <Button onClick={openCreateModal}>
            <PlusIcon className="h-5 w-5 mr-2 rtl:mr-0 rtl:ml-2" />
            {t('cashDrawers.newDrawer')}
          </Button>
        )}
      </div>

      {/* Low Balance Alerts */}
      {alerts.length > 0 && (
        <Card className="bg-yellow-50 border-yellow-200">
          <div className="flex items-start">
            <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600 mr-3 rtl:mr-0 rtl:ml-3" />
            <div>
              <h3 className="font-medium text-yellow-800">{t('cashDrawers.lowBalanceAlerts')}</h3>
              <ul className="mt-2 text-sm text-yellow-700">
                {alerts.map((alert, idx) => (
                  <li key={idx}>
                    {alert.drawer_name}: {alert.currency_code} - {formatCurrency(alert.balance)} ({t('cashDrawers.threshold')}: {formatCurrency(alert.threshold)})
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      {/* Cash Drawers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {drawers.map((drawer) => (
          <Card key={drawer.uuid} className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                  drawer.is_active ? 'bg-green-100' : 'bg-gray-100'
                }`}>
                  <BanknotesIcon className={`h-5 w-5 ${drawer.is_active ? 'text-green-600' : 'text-gray-400'}`} />
                </div>
                <div className="ml-3 rtl:ml-0 rtl:mr-3">
                  <h3 className="font-medium text-gray-900">{drawer.name}</h3>
                  <p className="text-sm text-gray-500">{drawer.location || t('cashDrawers.noLocation')}</p>
                </div>
              </div>
              {isAdmin() && (
                <button
                  onClick={() => openEditModal(drawer)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <PencilIcon className="h-5 w-5" />
                </button>
              )}
            </div>

            {/* Balances */}
            <div className="space-y-2 mb-4">
              <h4 className="text-sm font-medium text-gray-500">{t('cashDrawers.balances')}</h4>
              {drawer.balances && drawer.balances.length > 0 ? (
                drawer.balances.map((balance) => (
                  <div key={balance.currency_id} className="flex justify-between items-center py-1 border-b border-gray-100">
                    <span className="text-sm font-medium">{balance.currency_code}</span>
                    <span className="text-sm">{formatCurrency(balance.balance)} {balance.symbol}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-400">{t('cashDrawers.noBalances')}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => openTransactionModal(drawer, 'deposit')}
              >
                <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
                {t('cashDrawers.deposit')}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => openTransactionModal(drawer, 'withdraw')}
              >
                <ArrowUpTrayIcon className="h-4 w-4 mr-1" />
                {t('cashDrawers.withdraw')}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => openTransactionModal(drawer, 'reconcile')}
              >
                <ClipboardDocumentCheckIcon className="h-4 w-4 mr-1" />
                {t('cashDrawers.reconcile')}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => openHistoryModal(drawer)}
              >
                <ClockIcon className="h-4 w-4 mr-1" />
                {t('cashDrawers.history')}
              </Button>
            </div>
          </Card>
        ))}

        {drawers.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500">
            {t('cashDrawers.noDrawers')}
          </div>
        )}
      </div>

      {/* Create/Edit Drawer Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingDrawer ? t('cashDrawers.editDrawer') : t('cashDrawers.newDrawer')}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label={t('cashDrawers.name')}
            {...register('name', { required: t('validation.required') })}
            error={errors.name?.message}
          />
          <Input
            label={t('cashDrawers.location')}
            {...register('location')}
          />
          <Input
            label={t('cashDrawers.lowBalanceAlert')}
            type="number"
            step="0.01"
            {...register('lowBalanceAlert')}
          />
          {editingDrawer && (
            <div className="flex items-center">
              <input
                type="checkbox"
                id="isActive"
                {...register('isActive')}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="isActive" className="ml-2 rtl:ml-0 rtl:mr-2">
                {t('common.active')}
              </label>
            </div>
          )}
          <div className="flex justify-end space-x-3 rtl:space-x-reverse pt-4">
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit">{t('common.save')}</Button>
          </div>
        </form>
      </Modal>

      {/* Transaction Modal */}
      <Modal
        isOpen={showTransactionModal}
        onClose={() => setShowTransactionModal(false)}
        title={
          transactionType === 'deposit' ? t('cashDrawers.deposit') :
          transactionType === 'withdraw' ? t('cashDrawers.withdraw') :
          transactionType === 'adjust' ? t('cashDrawers.adjust') :
          t('cashDrawers.reconcile')
        }
      >
        <form onSubmit={handleTxSubmit(onTransactionSubmit)} className="space-y-4">
          <p className="text-sm text-gray-500">
            {t('cashDrawers.drawer')}: <strong>{selectedDrawer?.name}</strong>
          </p>
          <Select
            label={t('currencies.currency')}
            options={[{ value: '', label: t('common.select') }, ...currencyOptions]}
            {...registerTx('currencyId', { required: t('validation.required') })}
          />
          <Input
            label={transactionType === 'reconcile' ? t('cashDrawers.actualBalance') : t('common.amount')}
            type="number"
            step="0.01"
            {...registerTx('amount', { required: t('validation.required') })}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {transactionType === 'adjust' ? t('cashDrawers.reason') : t('common.notes')}
            </label>
            <textarea
              {...registerTx('notes', transactionType === 'adjust' ? { required: t('validation.required') } : {})}
              rows={3}
              className="input"
              placeholder={transactionType === 'adjust' ? t('cashDrawers.reasonRequired') : ''}
            />
          </div>
          <div className="flex justify-end space-x-3 rtl:space-x-reverse pt-4">
            <Button variant="secondary" onClick={() => setShowTransactionModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit">{t('common.confirm')}</Button>
          </div>
        </form>
      </Modal>

      {/* History Modal */}
      <Modal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        title={t('cashDrawers.transactionHistory')}
        size="lg"
      >
        <div className="max-h-96 overflow-y-auto">
          {history.length === 0 ? (
            <p className="text-center text-gray-500 py-8">{t('common.noData')}</p>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="table-header">{t('common.date')}</th>
                  <th className="table-header">{t('common.type')}</th>
                  <th className="table-header">{t('currencies.currency')}</th>
                  <th className="table-header">{t('common.amount')}</th>
                  <th className="table-header">{t('common.notes')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {history.map((tx, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="table-cell text-sm">{formatDateTime(tx.created_at)}</td>
                    <td className="table-cell">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        tx.type === 'deposit' ? 'bg-green-100 text-green-800' :
                        tx.type === 'withdrawal' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {tx.type}
                      </span>
                    </td>
                    <td className="table-cell">{tx.currency_code}</td>
                    <td className="table-cell font-medium">{formatCurrency(tx.amount)}</td>
                    <td className="table-cell text-sm text-gray-500">{tx.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default CashDrawersPage;
