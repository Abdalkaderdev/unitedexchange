import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Table, Pagination } from '../common';
import currencyService from '../../services/currencyService';

const RateHistoryModal = ({ isOpen, onClose, fromCurrency, toCurrency }) => {
  const { t } = useTranslation();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 10;

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('default', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date);
  };

  const formatRate = (rate) => {
    if (rate === null || rate === undefined) return '-';
    return Number(rate).toFixed(4);
  };

  const getRateChange = (oldRate, newRate) => {
    if (oldRate === null || newRate === null) return null;
    const change = newRate - oldRate;
    const percentChange = ((change / oldRate) * 100).toFixed(2);
    return {
      change,
      percentChange,
      isPositive: change > 0,
      isNegative: change < 0
    };
  };

  const fetchHistory = useCallback(async () => {
    if (!fromCurrency?.id || !toCurrency?.id) return;

    try {
      setLoading(true);
      const data = await currencyService.getRateHistory(
        fromCurrency.id,
        toCurrency.id,
        page,
        limit
      );
      setHistory(data.history || []);
      setTotalPages(data.totalPages || 1);
    } catch (error) {
      console.error('Error fetching rate history:', error);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, [fromCurrency, toCurrency, page]);

  useEffect(() => {
    if (isOpen) {
      setPage(1);
      fetchHistory();
    }
  }, [isOpen, fetchHistory]);

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [page, isOpen, fetchHistory]);

  const columns = [
    {
      header: t('currencies.changedAt'),
      accessor: 'changed_at',
      render: (value) => (
        <span className="text-sm text-gray-600">
          {formatDate(value)}
        </span>
      )
    },
    {
      header: t('currencies.oldBuyRate'),
      accessor: 'old_buy_rate',
      render: (value) => (
        <span className="font-mono text-gray-500">
          {formatRate(value)}
        </span>
      )
    },
    {
      header: t('currencies.newBuyRate'),
      accessor: 'new_buy_rate',
      render: (value, row) => {
        const change = getRateChange(row.old_buy_rate, value);
        return (
          <div className="flex items-center space-x-2">
            <span className="font-mono text-green-600 font-medium">
              {formatRate(value)}
            </span>
            {change && change.change !== 0 && (
              <span className={`text-xs ${change.isPositive ? 'text-green-500' : 'text-red-500'}`}>
                {change.isPositive ? '+' : ''}{change.percentChange}%
              </span>
            )}
          </div>
        );
      }
    },
    {
      header: t('currencies.oldSellRate'),
      accessor: 'old_sell_rate',
      render: (value) => (
        <span className="font-mono text-gray-500">
          {formatRate(value)}
        </span>
      )
    },
    {
      header: t('currencies.newSellRate'),
      accessor: 'new_sell_rate',
      render: (value, row) => {
        const change = getRateChange(row.old_sell_rate, value);
        return (
          <div className="flex items-center space-x-2">
            <span className="font-mono text-blue-600 font-medium">
              {formatRate(value)}
            </span>
            {change && change.change !== 0 && (
              <span className={`text-xs ${change.isPositive ? 'text-green-500' : 'text-red-500'}`}>
                {change.isPositive ? '+' : ''}{change.percentChange}%
              </span>
            )}
          </div>
        );
      }
    },
    {
      header: t('currencies.changedBy'),
      accessor: 'changed_by_name',
      render: (value) => (
        <span className="text-sm text-gray-700">
          {value || '-'}
        </span>
      )
    }
  ];

  const title = fromCurrency && toCurrency
    ? `${t('currencies.rateHistory')}: ${fromCurrency.code} / ${toCurrency.code}`
    : t('currencies.rateHistory');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="xl"
    >
      <div className="mt-4">
        {fromCurrency && toCurrency && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">
                {fromCurrency.name} ({fromCurrency.code})
                <span className="mx-2">→</span>
                {toCurrency.name} ({toCurrency.code})
              </span>
            </div>
          </div>
        )}

        <Table
          columns={columns}
          data={history}
          loading={loading}
          emptyMessage={t('currencies.noHistory')}
        />

        {totalPages > 1 && (
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        )}
      </div>
    </Modal>
  );
};

export default RateHistoryModal;
