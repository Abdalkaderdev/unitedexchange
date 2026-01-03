import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import transactionService from '../../services/transactionService';
import currencyService from '../../services/currencyService';
import { Button, Input, Select, Modal } from '../common';
import toast from 'react-hot-toast';
import { CalculatorIcon } from '@heroicons/react/24/outline';

const TransactionForm = ({ isOpen, onClose, onSuccess, initialData = null }) => {
  const { t } = useTranslation();
  const [currencies, setCurrencies] = useState([]);
  const [exchangeRates, setExchangeRates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [successData, setSuccessData] = useState(null);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    currencyInId: '',
    currencyOutId: '',
    amountIn: '',
    exchangeRate: '',
    amountOut: '',
    notes: ''
  });

  const fetchCurrencies = async () => {
    try {
      const currencies = await currencyService.getCurrencies(true);
      setCurrencies(currencies || []);
    } catch (error) {
      console.error('Failed to fetch currencies:', error);
    }
  };

  const fetchExchangeRates = async () => {
    try {
      const rates = await currencyService.getExchangeRates();
      setExchangeRates(rates || []);
    } catch (error) {
      console.error('Failed to fetch exchange rates:', error);
    }
  };

  const findExchangeRate = (currencyInId, currencyOutId) => {
    const rate = exchangeRates.find(
      r => r.fromCurrencyId === parseInt(currencyInId) &&
        r.toCurrencyId === parseInt(currencyOutId)
    );
    return rate?.sellRate || rate?.rate || null;
  };

  const resetForm = () => {
    setFormData({
      customerName: '',
      customerPhone: '',
      currencyInId: '',
      currencyOutId: '',
      amountIn: '',
      exchangeRate: '',
      amountOut: '',
      notes: ''
    });
    setErrors({});
  };

  useEffect(() => {
    if (isOpen) {
      fetchCurrencies();
      fetchExchangeRates();
      if (initialData) {
        setFormData({
          customerName: initialData.customerName || '',
          customerPhone: initialData.customerPhone || '',
          currencyInId: initialData.currencyInId ? initialData.currencyInId.toString() : '',
          currencyOutId: initialData.currencyOutId ? initialData.currencyOutId.toString() : '',
          amountIn: initialData.amountIn ? initialData.amountIn.toString() : '',
          exchangeRate: '',
          amountOut: '',
          notes: initialData.notes || ''
        });
        setErrors({});
      } else {
        resetForm();
      }
    }
  }, [isOpen, initialData]);

  useEffect(() => {
    if (formData.currencyInId && formData.currencyOutId && exchangeRates.length > 0) {
      const rate = findExchangeRate(formData.currencyInId, formData.currencyOutId);
      if (rate) {
        setFormData(prev => ({ ...prev, exchangeRate: rate.toString() }));
      }
    }
  }, [formData.currencyInId, formData.currencyOutId, exchangeRates]);

  // Success View Component
  if (successData) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={t('transactions.transactionSuccessful')}
        size="md"
      >
        <div className="text-center py-6">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
            <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">{t('transactions.createdSuccessfully')}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            {t('transactions.transactionNumber')}: <span className="font-mono font-medium text-gray-900 dark:text-gray-100">{successData.transactionNumber}</span>
          </p>

          <div className="flex flex-col gap-3">
            <Button
              onClick={() => setEmailModalOpen(true)}
              variant="primary"
              className="w-full justify-center"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              {t('transactions.emailReceipt')}
            </Button>

            <div className="flex gap-3">
              <Button
                onClick={() => {/* Print Logic Placeholder */ }}
                variant="secondary"
                className="flex-1 justify-center"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                {t('common.print')}
              </Button>
              <Button
                onClick={onClose}
                variant="outline"
                className="flex-1 justify-center"
              >
                {t('common.close')}
              </Button>
            </div>
          </div>
        </div>

        {emailModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-500 bg-opacity-75">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl dark:shadow-gray-900/50 w-96">
              <h3 className="text-lg font-medium mb-4">{t('transactions.enterEmail')}</h3>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const email = e.target.email.value;
                try {
                  await transactionService.emailReceipt(successData.uuid, email);
                  toast.success(t('transactions.receiptSent'));
                  setEmailModalOpen(false);
                  onClose();
                } catch (err) {
                  toast.error(t('common.error'));
                }
              }}>
                <input
                  name="email"
                  type="email"
                  required
                  className="w-full border dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded p-2 mb-4"
                  placeholder="customer@example.com"
                />
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => setEmailModalOpen(false)}>{t('common.cancel')}</Button>
                  <Button type="submit">{t('common.send')}</Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </Modal>
    );
  }

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const handleCalculate = () => {
    const amountIn = parseFloat(formData.amountIn);
    const rate = parseFloat(formData.exchangeRate);

    if (!isNaN(amountIn) && !isNaN(rate) && rate > 0) {
      const amountOut = amountIn * rate;
      setFormData(prev => ({
        ...prev,
        amountOut: amountOut.toFixed(2)
      }));
    } else {
      toast.error(t('transactions.enterAmount'));
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.customerName.trim()) {
      newErrors.customerName = t('validation.required');
    }
    if (!formData.currencyInId) {
      newErrors.currencyInId = t('validation.required');
    }
    if (!formData.currencyOutId) {
      newErrors.currencyOutId = t('validation.required');
    }
    if (!formData.amountIn || parseFloat(formData.amountIn) <= 0) {
      newErrors.amountIn = t('validation.positiveNumber');
    }
    if (!formData.exchangeRate || parseFloat(formData.exchangeRate) <= 0) {
      newErrors.exchangeRate = t('validation.positiveNumber');
    }
    if (!formData.amountOut || parseFloat(formData.amountOut) <= 0) {
      newErrors.amountOut = t('validation.positiveNumber');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setLoading(true);
    try {
      const payload = {
        customerName: formData.customerName.trim(),
        customerPhone: formData.customerPhone.trim() || null,
        currencyInId: parseInt(formData.currencyInId),
        currencyOutId: parseInt(formData.currencyOutId),
        amountIn: parseFloat(formData.amountIn),
        exchangeRate: parseFloat(formData.exchangeRate),
        amountOut: parseFloat(formData.amountOut),
        notes: formData.notes.trim() || null
      };

      const response = await transactionService.create(payload);

      if (response.success) {
        toast.success(t('transactions.transactionCreated'));
        onSuccess?.();
        // Instead of closing, switch to success view
        setSuccessData({
          uuid: response.data.uuid || response.uuid, // Handle different response structures
          transactionNumber: response.data.transactionNumber || 'NEW',
          customerName: formData.customerName,
          amountIn: formData.amountIn,
          currencyInId: formData.currencyInId,
          amountOut: formData.amountOut,
          currencyOutId: formData.currencyOutId
        });
        setLoading(false); // Stop loading but keep modal open
      }
    } catch (error) {
      toast.error(error.response?.data?.message || t('common.error'));
      console.error('Failed to create transaction:', error);
      setLoading(false);
    }
    // Removed finally block to handle local loading state manually for success case logic
  };

  const currencyOptions = currencies.map(c => ({
    value: c.id.toString(),
    label: `${c.code} - ${c.name}`
  }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? t('transactions.repeatTransaction') : t('transactions.newTransaction')}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Customer Name */}
          <Input
            label={t('transactions.customerName') + ' *'}
            value={formData.customerName}
            onChange={(e) => handleChange('customerName', e.target.value)}
            error={errors.customerName}
            placeholder={t('transactions.customerName')}
          />

          {/* Customer Phone */}
          <Input
            label={t('transactions.customerPhone')}
            value={formData.customerPhone}
            onChange={(e) => handleChange('customerPhone', e.target.value)}
            placeholder={t('transactions.customerPhone')}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Currency In */}
          <Select
            label={t('transactions.currencyIn') + ' *'}
            options={currencyOptions}
            placeholder={t('transactions.selectCurrency')}
            value={formData.currencyInId}
            onChange={(e) => handleChange('currencyInId', e.target.value)}
            error={errors.currencyInId}
          />

          {/* Currency Out */}
          <Select
            label={t('transactions.currencyOut') + ' *'}
            options={currencyOptions}
            placeholder={t('transactions.selectCurrency')}
            value={formData.currencyOutId}
            onChange={(e) => handleChange('currencyOutId', e.target.value)}
            error={errors.currencyOutId}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Amount In */}
          <Input
            label={t('transactions.amountIn') + ' *'}
            type="number"
            step="0.01"
            min="0"
            value={formData.amountIn}
            onChange={(e) => handleChange('amountIn', e.target.value)}
            error={errors.amountIn}
            placeholder="0.00"
          />

          {/* Exchange Rate */}
          <Input
            label={t('transactions.exchangeRate') + ' *'}
            type="number"
            step="0.0001"
            min="0"
            value={formData.exchangeRate}
            onChange={(e) => handleChange('exchangeRate', e.target.value)}
            error={errors.exchangeRate}
            placeholder="0.0000"
          />

          {/* Amount Out */}
          <div>
            <Input
              label={t('transactions.amountOut') + ' *'}
              type="number"
              step="0.01"
              min="0"
              value={formData.amountOut}
              onChange={(e) => handleChange('amountOut', e.target.value)}
              error={errors.amountOut}
              placeholder="0.00"
            />
          </div>
        </div>

        <div className="flex justify-center flex-col items-center gap-2">
          {formData.amountIn && formData.currencyInId && (() => {
            const currency = currencies.find(c => c.id.toString() === formData.currencyInId.toString());
            const threshold = currency?.highValueThreshold || 10000;
            if (parseFloat(formData.amountIn) >= threshold) {
              return (
                <div className="w-full bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-2">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-yellow-700">
                        {t('transactions.highValueWarning', { threshold: threshold.toLocaleString() })}
                        <span className="font-bold block mt-1">
                          Warning: This transaction will be flagged for review.
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              );
            }
            return null;
          })()}

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleCalculate}
          >
            <CalculatorIcon className="h-4 w-4 mr-2 rtl:mr-0 rtl:ml-2" />
            {t('transactions.calculate')}
          </Button>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('transactions.notes')}
          </label>
          <textarea
            className="input-field min-h-[80px]"
            value={formData.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
            placeholder={t('transactions.notes')}
            rows={3}
          />
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            loading={loading}
          >
            {t('common.save')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default TransactionForm;
