import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClockIcon } from '@heroicons/react/24/outline';
import { Table } from '../common';
import RateHistoryModal from './RateHistoryModal';

const ExchangeRateList = ({ rates, loading }) => {
  const { t } = useTranslation();
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedRate, setSelectedRate] = useState(null);

  const handleViewHistory = (rate) => {
    setSelectedRate(rate);
    setHistoryModalOpen(true);
  };

  const closeHistoryModal = () => {
    setHistoryModalOpen(false);
    setSelectedRate(null);
  };

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

  const columns = [
    {
      header: t('currencies.fromCurrency'),
      accessor: 'from_currency',
      render: (value, row) => (
        <div className="flex items-center">
          <span className="font-mono font-semibold text-gray-900">{value}</span>
          {row.from_currency_name && (
            <span className="ml-2 text-sm text-gray-500">
              ({row.from_currency_name})
            </span>
          )}
        </div>
      )
    },
    {
      header: t('currencies.toCurrency'),
      accessor: 'to_currency',
      render: (value, row) => (
        <div className="flex items-center">
          <span className="font-mono font-semibold text-gray-900">{value}</span>
          {row.to_currency_name && (
            <span className="ml-2 text-sm text-gray-500">
              ({row.to_currency_name})
            </span>
          )}
        </div>
      )
    },
    {
      header: t('currencies.buyRate'),
      accessor: 'buy_rate',
      render: (value) => (
        <span className="font-mono text-green-600 font-medium">
          {formatRate(value)}
        </span>
      )
    },
    {
      header: t('currencies.sellRate'),
      accessor: 'sell_rate',
      render: (value) => (
        <span className="font-mono text-blue-600 font-medium">
          {formatRate(value)}
        </span>
      )
    },
    {
      header: t('currencies.lastUpdated'),
      accessor: 'updated_at',
      render: (value) => (
        <span className="text-sm text-gray-500">
          {formatDate(value)}
        </span>
      )
    },
    {
      header: t('currencies.updatedBy'),
      accessor: 'updated_by_name',
      render: (value) => (
        <span className="text-sm text-gray-700">
          {value || '-'}
        </span>
      )
    },
    {
      header: t('common.actions'),
      accessor: 'id',
      render: (value, row) => (
        <button
          onClick={() => handleViewHistory(row)}
          className="inline-flex items-center px-2 py-1 text-sm text-primary-600 hover:text-primary-800 hover:bg-primary-50 rounded transition-colors"
          title={t('currencies.viewHistory')}
        >
          <ClockIcon className="h-4 w-4 mr-1" />
          {t('currencies.viewHistory')}
        </button>
      )
    }
  ];

  return (
    <>
      <Table
        columns={columns}
        data={rates}
        loading={loading}
        emptyMessage={t('currencies.noRates')}
      />

      <RateHistoryModal
        isOpen={historyModalOpen}
        onClose={closeHistoryModal}
        fromCurrency={selectedRate ? {
          id: selectedRate.from_currency_id,
          code: selectedRate.from_currency,
          name: selectedRate.from_currency_name
        } : null}
        toCurrency={selectedRate ? {
          id: selectedRate.to_currency_id,
          code: selectedRate.to_currency,
          name: selectedRate.to_currency_name
        } : null}
      />
    </>
  );
};

export default ExchangeRateList;
