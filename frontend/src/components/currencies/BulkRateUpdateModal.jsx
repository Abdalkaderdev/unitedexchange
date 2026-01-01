import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Button, Input } from '../common';
import currencyService from '../../services/currencyService';
import toast from 'react-hot-toast';

const BulkRateUpdateModal = ({ isOpen, onClose, rates, currencies, onSuccess }) => {
  const { t } = useTranslation();
  const [editedRates, setEditedRates] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && rates) {
      setEditedRates(rates.map(r => ({
        id: r.id,
        fromCurrencyId: r.fromCurrency.id,
        toCurrencyId: r.toCurrency.id,
        fromCode: r.fromCurrency.code,
        toCode: r.toCurrency.code,
        buyRate: r.buyRate.toString(),
        sellRate: r.sellRate.toString(),
        originalBuyRate: r.buyRate,
        originalSellRate: r.sellRate
      })));
    }
  }, [isOpen, rates]);

  const handleRateChange = (index, field, value) => {
    setEditedRates(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const getChangedRates = () => {
    return editedRates.filter(r =>
      parseFloat(r.buyRate) !== r.originalBuyRate ||
      parseFloat(r.sellRate) !== r.originalSellRate
    );
  };

  const handleSubmit = async () => {
    const changedRates = getChangedRates();

    if (changedRates.length === 0) {
      toast.error(t('currencies.noChanges') || 'No changes to save');
      return;
    }

    // Validate rates
    for (const rate of changedRates) {
      const buy = parseFloat(rate.buyRate);
      const sell = parseFloat(rate.sellRate);
      if (isNaN(buy) || buy <= 0 || isNaN(sell) || sell <= 0) {
        toast.error(t('validation.positiveNumber'));
        return;
      }
    }

    setLoading(true);
    try {
      const ratesPayload = changedRates.map(r => ({
        fromCurrencyId: r.fromCurrencyId,
        toCurrencyId: r.toCurrencyId,
        buyRate: parseFloat(r.buyRate),
        sellRate: parseFloat(r.sellRate)
      }));

      const response = await currencyService.bulkUpdateRates(ratesPayload);

      if (response.success) {
        toast.success(t('currencies.bulkUpdateSuccess') || `${changedRates.length} rate(s) updated successfully`);
        onSuccess && onSuccess();
        onClose();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const changedCount = getChangedRates().length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('currencies.bulkUpdateRates') || 'Bulk Update Rates'}
      size="xl"
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          {t('currencies.bulkUpdateDescription') || 'Edit multiple exchange rates at once. Only changed rates will be updated.'}
        </p>

        <div className="max-h-96 overflow-y-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  {t('currencies.currencyPair') || 'Currency Pair'}
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  {t('currencies.buyRate')}
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  {t('currencies.sellRate')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {editedRates.map((rate, index) => {
                const buyChanged = parseFloat(rate.buyRate) !== rate.originalBuyRate;
                const sellChanged = parseFloat(rate.sellRate) !== rate.originalSellRate;

                return (
                  <tr key={rate.id} className={buyChanged || sellChanged ? 'bg-yellow-50' : ''}>
                    <td className="px-4 py-2 text-sm font-medium text-gray-900">
                      {rate.fromCode} / {rate.toCode}
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        step="0.000001"
                        value={rate.buyRate}
                        onChange={(e) => handleRateChange(index, 'buyRate', e.target.value)}
                        className={`w-32 px-2 py-1 text-sm border rounded focus:ring-primary-500 focus:border-primary-500 ${
                          buyChanged ? 'border-yellow-400 bg-yellow-50' : 'border-gray-300'
                        }`}
                      />
                      {buyChanged && (
                        <span className="ml-2 text-xs text-gray-500">
                          ({rate.originalBuyRate})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        step="0.000001"
                        value={rate.sellRate}
                        onChange={(e) => handleRateChange(index, 'sellRate', e.target.value)}
                        className={`w-32 px-2 py-1 text-sm border rounded focus:ring-primary-500 focus:border-primary-500 ${
                          sellChanged ? 'border-yellow-400 bg-yellow-50' : 'border-gray-300'
                        }`}
                      />
                      {sellChanged && (
                        <span className="ml-2 text-xs text-gray-500">
                          ({rate.originalSellRate})
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {changedCount > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
            {changedCount} {t('currencies.ratesWillBeUpdated') || 'rate(s) will be updated'}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={loading || changedCount === 0}>
            {loading ? t('common.loading') : t('common.save')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default BulkRateUpdateModal;
