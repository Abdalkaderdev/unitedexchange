import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Button, Input, Loading } from '../common';
import shiftService from '../../services/shiftService';
import currencyService from '../../services/currencyService';
import toast from 'react-hot-toast';
import {
  StopIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  MinusIcon
} from '@heroicons/react/24/outline';

const CloseShiftModal = ({ isOpen, onClose, shift, onSuccess }) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar' || i18n.language === 'ku';

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currencies, setCurrencies] = useState([]);
  const [expectedBalances, setExpectedBalances] = useState([]);
  const [countedAmounts, setCountedAmounts] = useState({});
  const [notes, setNotes] = useState('');
  const [reconciliation, setReconciliation] = useState([]);

  useEffect(() => {
    if (isOpen && shift) {
      fetchData();
    }
  }, [isOpen, shift]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [currenciesRes, expectedRes] = await Promise.all([
        currencyService.getCurrencies(true),
        shiftService.getExpectedBalances(shift.uuid)
      ]);

      setCurrencies(currenciesRes.success ? currenciesRes.data : []);

      if (expectedRes.success) {
        setExpectedBalances(expectedRes.data || []);

        // Initialize counted amounts with expected values
        const initial = {};
        for (const balance of expectedRes.data || []) {
          initial[balance.currencyId] = balance.expectedBalance.toFixed(2);
        }
        setCountedAmounts(initial);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleAmountChange = (currencyId, value) => {
    setCountedAmounts(prev => ({
      ...prev,
      [currencyId]: value
    }));

    // Calculate variance in real-time
    updateReconciliation(currencyId, value);
  };

  const updateReconciliation = (currencyId, value) => {
    const expected = expectedBalances.find(e => e.currencyId === currencyId);
    if (!expected) return;

    const actual = parseFloat(value) || 0;
    const difference = actual - expected.expectedBalance;

    let status = 'balanced';
    if (difference > 0.01) status = 'over';
    else if (difference < -0.01) status = 'short';

    setReconciliation(prev => {
      const existing = prev.find(r => r.currencyId === currencyId);
      const newEntry = {
        currencyId,
        currencyCode: expected.currencyCode,
        expected: expected.expectedBalance,
        actual,
        difference,
        status
      };

      if (existing) {
        return prev.map(r => r.currencyId === currencyId ? newEntry : r);
      }
      return [...prev, newEntry];
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setSubmitting(true);

      const closingBalances = Object.entries(countedAmounts).map(([currencyId, amount]) => ({
        currencyId: parseInt(currencyId),
        amount: parseFloat(amount) || 0
      }));

      const response = await shiftService.endShift(shift.uuid, {
        closingBalances,
        notes
      });

      if (response.success) {
        if (response.data.hasVariance) {
          toast.success(t('shifts.shiftEnded') + ' - ' + (t('shifts.varianceDetected') || 'Variance detected'));
        } else {
          toast.success(t('shifts.shiftEnded'));
        }
        onSuccess(response.data);
        onClose();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const getVarianceColor = (status) => {
    switch (status) {
      case 'over': return 'text-yellow-600 bg-yellow-50';
      case 'short': return 'text-red-600 bg-red-50';
      default: return 'text-green-600 bg-green-50';
    }
  };

  const getVarianceIcon = (status) => {
    switch (status) {
      case 'over': return <ArrowTrendingUpIcon className="h-5 w-5" />;
      case 'short': return <ArrowTrendingDownIcon className="h-5 w-5" />;
      default: return <CheckCircleIcon className="h-5 w-5" />;
    }
  };

  const formatAmount = (amount, symbol) => {
    const num = parseFloat(amount) || 0;
    return `${symbol || ''}${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const hasAnyVariance = reconciliation.some(r => r.status !== 'balanced');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('shifts.endShift')}
      size="lg"
    >
      {loading ? (
        <div className="flex justify-center py-12">
          <Loading size="lg" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className={`space-y-6 ${isRTL ? 'rtl' : 'ltr'}`}>
          {/* Shift Summary */}
          {shift && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-2">{t('shifts.summary')}</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">{t('shifts.startedAt')}:</span>
                  <span className="font-medium ml-2">{new Date(shift.startTime).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-gray-500">{t('shifts.transactions')}:</span>
                  <span className="font-medium ml-2">{shift.currentStats?.transactionCount || 0}</span>
                </div>
              </div>
            </div>
          )}

          {/* Cash Count Section */}
          <div>
            <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
              <span>{t('shifts.countCash') || 'Count Cash'}</span>
              {hasAnyVariance && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                  <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
                  {t('shifts.varianceDetected') || 'Variance'}
                </span>
              )}
            </h3>

            <div className="space-y-4">
              {expectedBalances.map((balance) => {
                const currencyReconciliation = reconciliation.find(r => r.currencyId === balance.currencyId);
                const difference = currencyReconciliation?.difference || 0;
                const status = currencyReconciliation?.status || 'balanced';

                return (
                  <div
                    key={balance.currencyId}
                    className={`p-4 rounded-lg border ${status !== 'balanced' ? 'border-yellow-200 bg-yellow-50/30' : 'border-gray-200'}`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{balance.currencyCode}</span>
                        <span className="text-sm text-gray-500">{balance.currencyName}</span>
                      </div>
                      {status !== 'balanced' && (
                        <div className={`flex items-center gap-1 px-2 py-1 rounded ${getVarianceColor(status)}`}>
                          {getVarianceIcon(status)}
                          <span className="text-sm font-medium">
                            {status === 'over' ? '+' : ''}{formatAmount(difference, balance.currencySymbol)}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">
                          {t('shifts.expectedBalance') || 'Expected'}
                        </label>
                        <div className="text-lg font-semibold text-gray-700">
                          {formatAmount(balance.expectedBalance, balance.currencySymbol)}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs text-gray-500 mb-1">
                          {t('cashDrawers.actualBalance') || 'Counted'}
                        </label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={countedAmounts[balance.currencyId] || ''}
                          onChange={(e) => handleAmountChange(balance.currencyId, e.target.value)}
                          className="text-lg"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}

              {expectedBalances.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  {t('shifts.noBalancesToReconcile') || 'No balances to reconcile'}
                </div>
              )}
            </div>
          </div>

          {/* Reconciliation Summary */}
          {hasAnyVariance && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-yellow-800">
                    {t('shifts.varianceWarning') || 'Cash Variance Detected'}
                  </h4>
                  <p className="text-sm text-yellow-700 mt-1">
                    {t('shifts.varianceWarningMessage') || 'There is a difference between expected and counted amounts. Please verify your count or provide notes explaining the variance.'}
                  </p>
                </div>
              </div>
            </div>
          )}

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
              placeholder={hasAnyVariance ? (t('shifts.explainVariance') || 'Please explain the variance...') : ''}
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
              variant={hasAnyVariance ? 'warning' : 'danger'}
              disabled={submitting}
            >
              {submitting ? (
                <Loading size="sm" />
              ) : (
                <>
                  <StopIcon className="h-5 w-5 mr-2" />
                  {t('shifts.endShift')}
                </>
              )}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};

export default CloseShiftModal;
