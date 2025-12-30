import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
  ArrowPathIcon,
  ArrowDownTrayIcon,
  FunnelIcon
} from '@heroicons/react/24/outline';
import currencyService from '../services/currencyService';
import { Button, Card, Select } from '../components/common';
import Table, { Pagination } from '../components/common/Table';
import RateHistoryChart from '../components/currencies/RateHistoryChart';

const RateHistoryPage = () => {
  const { t } = useTranslation();

  // State
  const [currencies, setCurrencies] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingCurrencies, setLoadingCurrencies] = useState(true);

  // Filters
  const [fromCurrencyId, setFromCurrencyId] = useState('');
  const [toCurrencyId, setToCurrencyId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(true);
  const [showChart, setShowChart] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 20;

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

  // Fetch currencies
  const fetchCurrencies = useCallback(async () => {
    try {
      setLoadingCurrencies(true);
      const data = await currencyService.getCurrencies(true);
      setCurrencies(data);
    } catch (error) {
      toast.error(t('currencies.fetchError'));
      console.error('Error fetching currencies:', error);
    } finally {
      setLoadingCurrencies(false);
    }
  }, [t]);

  // Fetch history
  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      const data = await currencyService.getAllRateHistory({
        fromCurrencyId: fromCurrencyId || undefined,
        toCurrencyId: toCurrencyId || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page,
        limit
      });
      setHistory(data.history || []);
      setTotalPages(data.totalPages || 1);
    } catch (error) {
      toast.error(t('currencies.fetchHistoryError'));
      console.error('Error fetching rate history:', error);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, [fromCurrencyId, toCurrencyId, startDate, endDate, page, t]);

  // Initial load
  useEffect(() => {
    fetchCurrencies();
  }, [fetchCurrencies]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Handle filter change - reset to page 1
  const handleFilterChange = (setter) => (e) => {
    setter(e.target.value);
    setPage(1);
  };

  // Clear filters
  const handleClearFilters = () => {
    setFromCurrencyId('');
    setToCurrencyId('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  // Export to CSV
  const handleExport = async () => {
    try {
      const data = await currencyService.getAllRateHistory({
        fromCurrencyId: fromCurrencyId || undefined,
        toCurrencyId: toCurrencyId || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page: 1,
        limit: 10000 // Get all records for export
      });

      const historyData = data.history || [];

      if (historyData.length === 0) {
        toast.error(t('currencies.noDataToExport'));
        return;
      }

      // Create CSV content
      const headers = [
        t('currencies.changedAt'),
        t('currencies.fromCurrency'),
        t('currencies.toCurrency'),
        t('currencies.oldBuyRate'),
        t('currencies.newBuyRate'),
        t('currencies.oldSellRate'),
        t('currencies.newSellRate'),
        t('currencies.changedBy')
      ].join(',');

      const rows = historyData.map(item => [
        formatDate(item.changed_at),
        item.from_currency,
        item.to_currency,
        formatRate(item.old_buy_rate),
        formatRate(item.new_buy_rate),
        formatRate(item.old_sell_rate),
        formatRate(item.new_sell_rate),
        item.changed_by_name || '-'
      ].join(','));

      const csvContent = [headers, ...rows].join('\n');

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `rate-history-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(t('currencies.exportSuccess'));
    } catch (error) {
      toast.error(t('currencies.exportError'));
      console.error('Error exporting rate history:', error);
    }
  };

  // Currency options for select
  const currencyOptions = currencies.map(c => ({
    value: c.id.toString(),
    label: `${c.code} - ${c.name}`
  }));

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
      header: t('currencies.currencyPair'),
      accessor: 'from_currency',
      render: (value, row) => (
        <div className="flex items-center">
          <span className="font-mono font-semibold text-gray-900">
            {value}
          </span>
          <span className="mx-2 text-gray-400">/</span>
          <span className="font-mono font-semibold text-gray-900">
            {row.to_currency}
          </span>
        </div>
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

  // Check if specific currency pair is selected for chart
  const canShowChart = fromCurrencyId && toCurrencyId && history.length >= 2;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {t('currencies.rateHistory')}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {t('currencies.rateHistoryDescription')}
        </p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center text-gray-700 hover:text-gray-900"
          >
            <FunnelIcon className="h-5 w-5 mr-2" />
            <span className="font-medium">{t('common.filter')}</span>
          </button>
          <div className="flex space-x-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleClearFilters}
            >
              {t('currencies.clearFilters')}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExport}
              disabled={history.length === 0}
            >
              <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
              {t('common.export')}
            </Button>
          </div>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Select
              label={t('currencies.fromCurrency')}
              options={currencyOptions}
              value={fromCurrencyId}
              onChange={handleFilterChange(setFromCurrencyId)}
              placeholder={t('common.all')}
              disabled={loadingCurrencies}
            />
            <Select
              label={t('currencies.toCurrency')}
              options={currencyOptions}
              value={toCurrencyId}
              onChange={handleFilterChange(setToCurrencyId)}
              placeholder={t('common.all')}
              disabled={loadingCurrencies}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('currencies.startDate')}
              </label>
              <input
                type="date"
                className="input-field"
                value={startDate}
                onChange={handleFilterChange(setStartDate)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('currencies.endDate')}
              </label>
              <input
                type="date"
                className="input-field"
                value={endDate}
                onChange={handleFilterChange(setEndDate)}
              />
            </div>
          </div>
        )}
      </Card>

      {/* Chart Toggle & Chart */}
      {canShowChart && (
        <Card className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {t('currencies.rateChart')}
            </h3>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowChart(!showChart)}
            >
              {showChart ? t('currencies.hideChart') : t('currencies.showChart')}
            </Button>
          </div>
          {showChart && (
            <RateHistoryChart history={history} showBuyRate showSellRate />
          )}
        </Card>
      )}

      {/* History Table */}
      <Card
        title={t('currencies.allRateChanges')}
        action={
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchHistory}
            disabled={loading}
          >
            <ArrowPathIcon className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            {t('common.refresh')}
          </Button>
        }
      >
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
      </Card>
    </div>
  );
};

export default RateHistoryPage;
