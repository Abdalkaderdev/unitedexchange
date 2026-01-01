import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { Button, Input, Select, Card, Loading } from '../components/common';
import ReceiptActions from '../components/transactions/ReceiptActions';
import transactionService from '../services/transactionService';
import toast from 'react-hot-toast';
import {
  ArrowLeftIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  UserIcon,
  PhoneIcon,
  IdentificationIcon,
  CurrencyDollarIcon,
  ArrowsRightLeftIcon,
  CalendarIcon,
  ClockIcon,
  DocumentTextIcon,
  CreditCardIcon,
  HashtagIcon,
  ExclamationTriangleIcon,
  UserCircleIcon
} from '@heroicons/react/24/outline';

const TransactionDetailPage = () => {
  const { uuid } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar' || i18n.language === 'ku';

  const [transaction, setTransaction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  useEffect(() => {
    fetchTransaction();
  }, [uuid]);

  const fetchTransaction = async () => {
    try {
      setLoading(true);
      const response = await transactionService.getTransaction(uuid);
      if (response.success) {
        setTransaction(response.data);
        reset({
          customerName: response.data.customerName,
          customerPhone: response.data.customerPhone || '',
          customerIdType: response.data.customerIdType || '',
          customerIdNumber: response.data.customerIdNumber || '',
          notes: response.data.notes || '',
          paymentMethod: response.data.paymentMethod || 'cash',
          referenceNumber: response.data.referenceNumber || ''
        });
      }
    } catch (error) {
      toast.error(t('common.error'));
      navigate('/transactions');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data) => {
    try {
      setSaving(true);
      const response = await transactionService.updateTransaction(uuid, data);
      if (response.success) {
        toast.success(t('transactions.transactionUpdated') || 'Transaction updated successfully');
        setEditing(false);
        fetchTransaction();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    setEditing(false);
    reset({
      customerName: transaction.customerName,
      customerPhone: transaction.customerPhone || '',
      customerIdType: transaction.customerIdType || '',
      customerIdNumber: transaction.customerIdNumber || '',
      notes: transaction.notes || '',
      paymentMethod: transaction.paymentMethod || 'cash',
      referenceNumber: transaction.referenceNumber || ''
    });
  };

  const idTypeOptions = [
    { value: '', label: t('common.select') || 'Select' },
    { value: 'passport', label: t('customers.idTypes.passport') || 'Passport' },
    { value: 'national_id', label: t('customers.idTypes.national_id') || 'National ID' },
    { value: 'driver_license', label: t('customers.idTypes.driving_license') || 'Driving License' },
    { value: 'other', label: t('customers.idTypes.other') || 'Other' }
  ];

  const paymentMethodOptions = [
    { value: 'cash', label: t('transactions.paymentMethods.cash') || 'Cash' },
    { value: 'card', label: t('transactions.paymentMethods.card') || 'Card' },
    { value: 'bank_transfer', label: t('transactions.paymentMethods.bank_transfer') || 'Bank Transfer' },
    { value: 'cheque', label: t('transactions.paymentMethods.cheque') || 'Cheque' },
    { value: 'other', label: t('transactions.paymentMethods.other') || 'Other' }
  ];

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString(i18n.language, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleTimeString(i18n.language, {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatAmount = (amount, symbol) => {
    const num = parseFloat(amount);
    return `${symbol || ''}${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Loading size="lg" />
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">{t('common.noData')}</p>
      </div>
    );
  }

  const isCancelled = transaction.status === 'cancelled';

  return (
    <div className={`space-y-6 ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/transactions')}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeftIcon className={`h-5 w-5 ${isRTL ? 'rotate-180' : ''}`} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {t('transactions.viewDetails') || 'Transaction Details'}
            </h1>
            <p className="text-sm text-gray-500">
              #{transaction.transactionNumber}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ReceiptActions transaction={transaction} />

          {!isCancelled && !editing && (
            <Button onClick={() => setEditing(true)}>
              <PencilIcon className="h-4 w-4 mr-2" />
              {t('common.edit')}
            </Button>
          )}

          {editing && (
            <>
              <Button variant="secondary" onClick={cancelEdit} disabled={saving}>
                <XMarkIcon className="h-4 w-4 mr-2" />
                {t('common.cancel')}
              </Button>
              <Button onClick={handleSubmit(onSubmit)} disabled={saving}>
                <CheckIcon className="h-4 w-4 mr-2" />
                {saving ? t('common.loading') : t('common.save')}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Status Banner */}
      {isCancelled && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <ExclamationTriangleIcon className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-800">{t('transactions.cancelled')}</p>
            {transaction.cancellation && (
              <div className="text-sm text-red-600 mt-1">
                <p>{t('transactions.cancelledBy')}: {transaction.cancellation.cancelledBy}</p>
                <p>{t('transactions.cancelledAt')}: {formatDate(transaction.cancellation.cancelledAt)} {formatTime(transaction.cancellation.cancelledAt)}</p>
                {transaction.cancellation.reason && (
                  <p>{t('transactions.cancellationReason')}: {transaction.cancellation.reason}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Transaction Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Exchange Details */}
          <Card>
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <ArrowsRightLeftIcon className="h-5 w-5 text-blue-600" />
                {t('nav.exchangeRates') || 'Exchange Details'}
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Currency In */}
                <div className="bg-green-50 rounded-lg p-4">
                  <p className="text-sm text-green-600 font-medium mb-1">
                    {t('transactions.currencyIn')}
                  </p>
                  <p className="text-2xl font-bold text-green-700">
                    {formatAmount(transaction.amountIn, transaction.currencyIn.symbol)}
                  </p>
                  <p className="text-sm text-green-600 mt-1">
                    {transaction.currencyIn.code} - {transaction.currencyIn.name}
                  </p>
                </div>

                {/* Currency Out */}
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-sm text-blue-600 font-medium mb-1">
                    {t('transactions.currencyOut')}
                  </p>
                  <p className="text-2xl font-bold text-blue-700">
                    {formatAmount(transaction.amountOut, transaction.currencyOut.symbol)}
                  </p>
                  <p className="text-sm text-blue-600 mt-1">
                    {transaction.currencyOut.code} - {transaction.currencyOut.name}
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase">{t('transactions.exchangeRate')}</p>
                  <p className="font-semibold text-gray-900">{transaction.exchangeRate?.toFixed(6)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">{t('reports.marketRate') || 'Market Rate'}</p>
                  <p className="font-semibold text-gray-900">{transaction.marketRate?.toFixed(6)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">{t('transactions.profit')}</p>
                  <p className={`font-semibold ${transaction.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${transaction.profit?.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">{t('reports.totalCommission') || 'Commission'}</p>
                  <p className="font-semibold text-gray-900">${transaction.commission?.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Customer Information */}
          <Card>
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <UserIcon className="h-5 w-5 text-blue-600" />
                {t('customers.customerDetails') || 'Customer Information'}
              </h2>

              {editing ? (
                <form className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label={t('transactions.customerName')}
                      {...register('customerName', { required: t('validation.required') })}
                      error={errors.customerName?.message}
                    />
                    <Input
                      label={t('transactions.customerPhone')}
                      {...register('customerPhone')}
                    />
                    <Select
                      label={t('customers.idType')}
                      options={idTypeOptions}
                      {...register('customerIdType')}
                    />
                    <Input
                      label={t('customers.idNumber')}
                      {...register('customerIdNumber')}
                    />
                  </div>
                </form>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3">
                    <UserCircleIcon className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500 uppercase">{t('transactions.customerName')}</p>
                      <p className="font-medium text-gray-900">
                        {transaction.customerName}
                        {transaction.customer?.isVip && (
                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                            VIP
                          </span>
                        )}
                      </p>
                      {transaction.customer && (
                        <Link
                          to={`/customers?search=${encodeURIComponent(transaction.customerName)}`}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          {t('transactions.viewDetails') || 'View customer profile'}
                        </Link>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <PhoneIcon className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500 uppercase">{t('transactions.customerPhone')}</p>
                      <p className="font-medium text-gray-900">{transaction.customerPhone || '-'}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <IdentificationIcon className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500 uppercase">{t('customers.idType')}</p>
                      <p className="font-medium text-gray-900">
                        {transaction.customerIdType
                          ? (t(`customers.idTypes.${transaction.customerIdType}`) || transaction.customerIdType)
                          : '-'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <HashtagIcon className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500 uppercase">{t('customers.idNumber')}</p>
                      <p className="font-medium text-gray-900">{transaction.customerIdNumber || '-'}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Payment & Notes */}
          <Card>
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <CreditCardIcon className="h-5 w-5 text-blue-600" />
                {t('transactions.paymentDetails') || 'Payment & Notes'}
              </h2>

              {editing ? (
                <form className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select
                      label={t('transactions.paymentMethod') || 'Payment Method'}
                      options={paymentMethodOptions}
                      {...register('paymentMethod')}
                    />
                    <Input
                      label={t('transactions.referenceNumber') || 'Reference Number'}
                      {...register('referenceNumber')}
                      placeholder={t('transactions.enterReference') || 'Enter reference number'}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('transactions.notes')}
                    </label>
                    <textarea
                      {...register('notes')}
                      rows={3}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                </form>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3">
                    <CreditCardIcon className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500 uppercase">{t('transactions.paymentMethod') || 'Payment Method'}</p>
                      <p className="font-medium text-gray-900">
                        {t(`transactions.paymentMethods.${transaction.paymentMethod}`) || transaction.paymentMethod || 'Cash'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <HashtagIcon className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500 uppercase">{t('transactions.referenceNumber') || 'Reference Number'}</p>
                      <p className="font-medium text-gray-900">{transaction.referenceNumber || '-'}</p>
                    </div>
                  </div>

                  <div className="md:col-span-2 flex items-start gap-3">
                    <DocumentTextIcon className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500 uppercase">{t('transactions.notes')}</p>
                      <p className="font-medium text-gray-900">{transaction.notes || '-'}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status & Time */}
          <Card>
            <div className="p-6">
              <h3 className="text-sm font-medium text-gray-900 mb-4">
                {t('common.status')}
              </h3>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">{t('common.status')}</span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    isCancelled
                      ? 'bg-red-100 text-red-800'
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {isCancelled ? t('transactions.cancelled') : t('transactions.completed')}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 flex items-center gap-1">
                    <CalendarIcon className="h-4 w-4" />
                    {t('transactions.date')}
                  </span>
                  <span className="text-sm font-medium text-gray-900">
                    {formatDate(transaction.transactionDate)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 flex items-center gap-1">
                    <ClockIcon className="h-4 w-4" />
                    {t('reports.time')}
                  </span>
                  <span className="text-sm font-medium text-gray-900">
                    {formatTime(transaction.transactionDate)}
                  </span>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">{t('transactions.employee')}</span>
                    <span className="text-sm font-medium text-gray-900">
                      {transaction.employee?.fullName}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Quick Actions */}
          <Card>
            <div className="p-6">
              <h3 className="text-sm font-medium text-gray-900 mb-4">
                {t('dashboard.quickActions') || 'Quick Actions'}
              </h3>

              <div className="space-y-2">
                <Link
                  to="/transactions"
                  className="block w-full px-4 py-2 text-sm text-center text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  {t('common.back')} {t('nav.transactions')}
                </Link>

                {transaction.customer && (
                  <Link
                    to={`/customers?search=${encodeURIComponent(transaction.customerName)}`}
                    className="block w-full px-4 py-2 text-sm text-center text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                  >
                    {t('customers.customerDetails') || 'View Customer'}
                  </Link>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TransactionDetailPage;
