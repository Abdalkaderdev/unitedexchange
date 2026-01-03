import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import transactionService from '../../services/transactionService';
import currencyService from '../../services/currencyService';
import { Button, Input, Select, Modal } from '../common';
import toast from 'react-hot-toast';
import { CalculatorIcon } from '@heroicons/react/24/outline';

const TransactionForm = ({ isOpen, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const [currencies, setCurrencies] = useState([]);
  const [exchangeRates, setExchangeRates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
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

  useEffect(() => {
    if (isOpen) {
      fetchCurrencies();
      fetchExchangeRates();
      resetForm();
    }
  }, [isOpen]);

  useEffect(() => {
    // Auto-populate exchange rate when currencies change
    if (formData.currencyInId && formData.currencyOutId && exchangeRates.length > 0) {
      const rate = findExchangeRate(formData.currencyInId, formData.currencyOutId);
      if (rate) {
        setFormData(prev => ({ ...prev, exchangeRate: rate.toString() }));
      }
    }
  }, [formData.currencyInId, formData.currencyOutId, exchangeRates]);

  const fetchCurrencies = async () => {
    try {
      const response = await currencyService.getCurrencies(true);
      if (response.success) {
        setCurrencies(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch currencies:', error);
    }
  };

  const fetchExchangeRates = async () => {
    try {
      const response = await currencyService.getExchangeRates();
      if (response.success) {
        setExchangeRates(response.data);
      }
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
    if (!formData.amountIn || parseFloat(formData.amountIn) < 0) {
      newErrors.amountIn = t('validation.positiveNumber');
    }
    if (!formData.exchangeRate || parseFloat(formData.exchangeRate) < 0) {
      newErrors.exchangeRate = t('validation.positiveNumber');
    }
    if (!formData.amountOut || parseFloat(formData.amountOut) < 0) {
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

      const response = await transactionService.createTransaction(payload);
      if (response.success) {
        toast.success(t('transactions.transactionCreated'));
        onSuccess?.();
        onClose();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || t('common.error'));
      console.error('Failed to create transaction:', error);
    } finally {
      setLoading(false);
    }
  };

  const currencyOptions = currencies.map(c => ({
    value: c.id.toString(),
    label: `${c.code} - ${c.name}`
  }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('transactions.newTransaction')}
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

        {/* Calculate Button */}
        <div className="flex justify-center">
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