import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Button, Input, Select, Loading } from '../common';
import shiftService from '../../services/shiftService';
import currencyService from '../../services/currencyService';
import cashDrawerService from '../../services/cashDrawerService';
import toast from 'react-hot-toast';
import { PlayIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';

const OpenShiftModal = ({ isOpen, onClose, onSuccess }) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar' || i18n.language === 'ku';

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currencies, setCurrencies] = useState([]);
  const [cashDrawers, setCashDrawers] = useState([]);
  const [selectedDrawer, setSelectedDrawer] = useState('');
  const [openingBalances, setOpeningBalances] = useState([]);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [currenciesRes, drawersRes] = await Promise.all([
        currencyService.getCurrencies(true),
        cashDrawerService ? cashDrawerService.getDrawers().catch(() => ({ success: true, data: [] })) : Promise.resolve({ success: true, data: [] })
      ]);

      const currenciesData = currenciesRes.success ? currenciesRes.data : [];
      setCurrencies(currenciesData);
      setCashDrawers(drawersRes?.data || []);

      // Initialize with main currencies (USD, IQD, EUR if available)
      const mainCurrencyCodes = ['USD', 'IQD', 'EUR'];
      const initialBalances = currenciesData
        .filter(c => mainCurrencyCodes.includes(c.code))
        .map(c => ({
          currencyId: c.id,
          currencyCode: c.code,
          currencySymbol: c.symbol,
          amount: ''
        }));

      setOpeningBalances(initialBalances.length > 0 ? initialBalances : []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const addCurrency = () => {
    const availableCurrencies = currencies.filter(
      c => !openingBalances.find(b => b.currencyId === c.id)
    );

    if (availableCurrencies.length > 0) {
      const currency = availableCurrencies[0];
      setOpeningBalances([...openingBalances, {
        currencyId: currency.id,
        currencyCode: currency.code,
        currencySymbol: currency.symbol,
        amount: ''
      }]);
    }
  };

  const removeCurrency = (index) => {
    setOpeningBalances(openingBalances.filter((_, i) => i !== index));
  };

  const updateBalance = (index, field, value) => {
    const updated = [...openingBalances];
    if (field === 'currencyId') {
      const currency = currencies.find(c => c.id === parseInt(value));
      if (currency) {
        updated[index] = {
          ...updated[index],
          currencyId: currency.id,
          currencyCode: currency.code,
          currencySymbol: currency.symbol
        };
      }
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setOpeningBalances(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setSubmitting(true);

      const balances = openingBalances
        .filter(b => b.amount && parseFloat(b.amount) >= 0)
        .map(b => ({
          currencyId: b.currencyId,
          amount: parseFloat(b.amount) || 0
        }));

      const response = await shiftService.startShift({
        drawerId: selectedDrawer || undefined,
        openingBalances: balances,
        notes
      });

      if (response.success) {
        toast.success(t('shifts.shiftStarted'));
        onSuccess(response.data);
        onClose();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const availableCurrencies = currencies.filter(
    c => !openingBalances.find(b => b.currencyId === c.id)
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('shifts.startShift')}
      size="md"
    >
      {loading ? (
        <div className="flex justify-center py-12">
          <Loading size="lg" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className={`space-y-6 ${isRTL ? 'rtl' : 'ltr'}`}>
          {/* Cash Drawer Selection */}
          {cashDrawers.length > 0 && (
            <div>
              <Select
                label={t('shifts.selectCashDrawer') || 'Select Cash Drawer'}
                value={selectedDrawer}
                onChange={(e) => setSelectedDrawer(e.target.value)}
                options={[
                  { value: '', label: t('common.none') || 'None' },
                  ...cashDrawers.map(d => ({
                    value: d.uuid,
                    label: d.name
                  }))
                ]}
              />
            </div>
          )}

          {/* Opening Balances */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">
                {t('shifts.openingBalances') || 'Opening Balances'}
              </label>
              {availableCurrencies.length > 0 && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={addCurrency}
                >
                  <PlusIcon className="h-4 w-4 mr-1" />
                  {t('common.add')}
                </Button>
              )}
            </div>

            <div className="space-y-3">
              {openingBalances.map((balance, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="w-32">
                    <Select
                      value={balance.currencyId}
                      onChange={(e) => updateBalance(index, 'currencyId', e.target.value)}
                      options={[
                        { value: balance.currencyId, label: balance.currencyCode },
                        ...availableCurrencies.map(c => ({
                          value: c.id,
                          label: c.code
                        }))
                      ]}
                    />
                  </div>
                  <div className="flex-1">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={balance.amount}
                      onChange={(e) => updateBalance(index, 'amount', e.target.value)}
                      placeholder={`${balance.currencySymbol} 0.00`}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeCurrency(index)}
                    className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </div>
              ))}

              {openingBalances.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">
                  {t('shifts.noOpeningBalances') || 'No opening balances set. Click Add to enter your starting cash.'}
                </p>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('common.notes')}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder={t('shifts.notesPlaceholder') || 'Optional notes...'}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={submitting}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={submitting}
            >
              {submitting ? (
                <Loading size="sm" />
              ) : (
                <>
                  <PlayIcon className="h-5 w-5 mr-2" />
                  {t('shifts.startShift')}
                </>
              )}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};

export default OpenShiftModal;
