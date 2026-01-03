import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CalendarIcon,
  DocumentTextIcon,
  ClockIcon,
  UserIcon,
  BanknotesIcon,
  ChartBarIcon,
  XCircleIcon,
  EyeIcon
} from '@heroicons/react/24/outline';
import reportService from '../../services/reportService';
import { useAuth } from '../../contexts/AuthContext';
import { Button, Card, StatCard, Table, Modal, Loading } from '../common';

const DailyClosingReport = () => {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [closingReports, setClosingReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchClosingReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await reportService.getClosingReports();
      setClosingReports(data.reports || data || []);
    } catch (err) {
      console.error('Failed to fetch closing reports:', err);
      setError(t('reports.closingFetchError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchClosingReports();
  }, [fetchClosingReports]);

  const handleGenerateReport = async () => {
    setGenerating(true);
    setError(null);
    try {
      const result = await reportService.generateClosingReport(selectedDate);
      setClosingReports(prev => [result, ...prev]);
      setSelectedReport(result);
      setDetailModalOpen(true);
    } catch (err) {
      console.error('Failed to generate closing report:', err);
      setError(err.response?.data?.message || t('reports.closingGenerateError'));
    } finally {
      setGenerating(false);
    }
  };

  const handleViewReport = async (uuid) => {
    setLoading(true);
    try {
      const report = await reportService.getClosingReport(uuid);
      setSelectedReport(report);
      setDetailModalOpen(true);
    } catch (err) {
      console.error('Failed to fetch closing report:', err);
      setError(t('reports.closingFetchError'));
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const closingColumns = [
    {
      header: t('reports.date'),
      accessor: 'date',
      render: (value) => (
        <div className="flex items-center">
          <CalendarIcon className="h-4 w-4 text-gray-400 mr-2" />
          {formatDate(value)}
        </div>
      )
    },
    {
      header: t('reports.totalTransactions'),
      accessor: 'totalTransactions',
      render: (value) => value?.toLocaleString() || '0'
    },
    {
      header: t('reports.cancelledTransactions'),
      accessor: 'cancelledTransactions',
      render: (value) => (
        <span className={value > 0 ? 'text-red-600' : 'text-gray-500'}>
          {value?.toLocaleString() || '0'}
        </span>
      )
    },
    {
      header: t('reports.totalProfit'),
      accessor: 'totalProfit',
      render: (value, row) => (
        <span className={value >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
          {value?.toLocaleString() || '0'} {row.baseCurrency || ''}
        </span>
      )
    },
    {
      header: t('reports.generatedBy'),
      accessor: 'generatedBy',
      render: (value) => (
        <div className="flex items-center">
          <UserIcon className="h-4 w-4 text-gray-400 mr-2" />
          {value?.fullName || value?.username || '-'}
        </div>
      )
    },
    {
      header: t('reports.generatedAt'),
      accessor: 'createdAt',
      render: (value) => (
        <div className="flex items-center text-sm text-gray-500">
          <ClockIcon className="h-4 w-4 text-gray-400 mr-2" />
          {formatDateTime(value)}
        </div>
      )
    },
    {
      header: t('common.actions'),
      accessor: 'uuid',
      render: (value) => (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => handleViewReport(value)}
        >
          <EyeIcon className="h-4 w-4 mr-1" />
          {t('reports.viewClosing')}
        </Button>
      )
    }
  ];

  const currencyBreakdownColumns = [
    {
      header: t('reports.currency'),
      accessor: 'currencyCode'
    },
    {
      header: t('reports.buyTransactions'),
      accessor: 'buyCount',
      render: (value) => value?.toLocaleString() || '0'
    },
    {
      header: t('reports.sellTransactions'),
      accessor: 'sellCount',
      render: (value) => value?.toLocaleString() || '0'
    },
    {
      header: t('reports.totalVolume'),
      accessor: 'totalVolume',
      render: (value) => value?.toLocaleString() || '0'
    },
    {
      header: t('reports.profit'),
      accessor: 'profit',
      render: (value) => (
        <span className={value >= 0 ? 'text-green-600' : 'text-red-600'}>
          {value?.toLocaleString() || '0'}
        </span>
      )
    }
  ];

  const employeeBreakdownColumns = [
    {
      header: t('reports.employee'),
      accessor: 'name',
      render: (value, row) => (
        <div className="flex items-center">
          <UserIcon className="h-4 w-4 text-gray-400 mr-2" />
          {value || row.fullName || row.username}
        </div>
      )
    },
    {
      header: t('reports.transactions'),
      accessor: 'transactionCount',
      render: (value) => value?.toLocaleString() || '0'
    },
    {
      header: t('reports.totalVolume'),
      accessor: 'totalVolume',
      render: (value) => value?.toLocaleString() || '0'
    },
    {
      header: t('reports.profit'),
      accessor: 'profit',
      render: (value) => (
        <span className={value >= 0 ? 'text-green-600' : 'text-red-600'}>
          {value?.toLocaleString() || '0'}
        </span>
      )
    }
  ];

  const transactionColumns = [
    {
      header: t('reports.transactionId'),
      accessor: 'id',
      render: (value) => <span className="font-mono text-sm">{value}</span>
    },
    {
      header: t('reports.time'),
      accessor: 'createdAt',
      render: (value) => new Date(value).toLocaleTimeString()
    },
    {
      header: t('reports.type'),
      accessor: 'type',
      render: (value) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          value === 'buy' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
        }`}>
          {t(`reports.${value}`)}
        </span>
      )
    },
    {
      header: t('reports.currency'),
      accessor: 'currencyCode'
    },
    {
      header: t('reports.amount'),
      accessor: 'amount',
      render: (value) => value?.toLocaleString()
    },
    {
      header: t('reports.profit'),
      accessor: 'profit',
      render: (value) => (
        <span className={value >= 0 ? 'text-green-600' : 'text-red-600'}>
          {value?.toLocaleString()}
        </span>
      )
    },
    {
      header: t('reports.employee'),
      accessor: 'employeeName'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Generate Report Card */}
      <Card>
        <div className="flex flex-col md:flex-row md:items-end gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('reports.selectDate')}
            </label>
            <div className="relative">
              <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="input-field pl-10"
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>
          {isAdmin() && (
            <Button
              onClick={handleGenerateReport}
              loading={generating}
              className="flex items-center"
            >
              <DocumentTextIcon className="h-5 w-5 mr-2" />
              {t('reports.generateClosing')}
            </Button>
          )}
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-700">
            <XCircleIcon className="h-5 w-5 mr-2 flex-shrink-0" />
            {error}
          </div>
        )}
      </Card>

      {/* Closing Reports History */}
      <Card
        title={t('reports.closingHistory')}
        action={
          <Button variant="secondary" size="sm" onClick={fetchClosingReports} loading={loading}>
            {t('common.refresh')}
          </Button>
        }
      >
        {loading && closingReports.length === 0 ? (
          <Loading size="lg" className="py-12" />
        ) : (
          <Table
            columns={closingColumns}
            data={closingReports}
            loading={loading}
            emptyMessage={t('reports.noClosingReports')}
          />
        )}
      </Card>

      {/* Detail Modal */}
      <Modal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title={t('reports.closingReport')}
        size="xl"
      >
        {selectedReport && (
          <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
            {/* Report Header */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center">
                  <CalendarIcon className="h-6 w-6 text-primary-500 mr-2" />
                  <div>
                    <p className="text-sm text-gray-500">{t('reports.date')}</p>
                    <p className="font-semibold">{formatDate(selectedReport.date)}</p>
                  </div>
                </div>
                <div className="flex items-center">
                  <UserIcon className="h-6 w-6 text-primary-500 mr-2" />
                  <div>
                    <p className="text-sm text-gray-500">{t('reports.generatedBy')}</p>
                    <p className="font-semibold">
                      {selectedReport.generatedBy?.fullName || selectedReport.generatedBy?.username || '-'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center">
                  <ClockIcon className="h-6 w-6 text-primary-500 mr-2" />
                  <div>
                    <p className="text-sm text-gray-500">{t('reports.generatedAt')}</p>
                    <p className="font-semibold">{formatDateTime(selectedReport.createdAt)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                title={t('reports.totalTransactions')}
                value={selectedReport.totalTransactions?.toLocaleString() || '0'}
                icon={ChartBarIcon}
              />
              <StatCard
                title={t('reports.cancelledTransactions')}
                value={selectedReport.cancelledTransactions?.toLocaleString() || '0'}
                icon={XCircleIcon}
              />
              <StatCard
                title={t('reports.totalProfit')}
                value={`${selectedReport.totalProfit?.toLocaleString() || '0'} ${selectedReport.baseCurrency || ''}`}
                icon={BanknotesIcon}
              />
              <StatCard
                title={t('reports.totalCommission')}
                value={`${selectedReport.totalCommission?.toLocaleString() || '0'} ${selectedReport.baseCurrency || ''}`}
                icon={BanknotesIcon}
              />
            </div>

            {/* Currency Breakdown */}
            {selectedReport.currencyBreakdown && selectedReport.currencyBreakdown.length > 0 && (
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <BanknotesIcon className="h-5 w-5 mr-2 text-primary-500" />
                  {t('reports.currencyBreakdown')}
                </h4>
                <Table
                  columns={currencyBreakdownColumns}
                  data={selectedReport.currencyBreakdown}
                  emptyMessage={t('reports.noData')}
                />
              </div>
            )}

            {/* Employee Breakdown */}
            {selectedReport.employeeBreakdown && selectedReport.employeeBreakdown.length > 0 && (
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <UserIcon className="h-5 w-5 mr-2 text-primary-500" />
                  {t('reports.employeeBreakdown')}
                </h4>
                <Table
                  columns={employeeBreakdownColumns}
                  data={selectedReport.employeeBreakdown}
                  emptyMessage={t('reports.noData')}
                />
              </div>
            )}

            {/* Transactions List */}
            {selectedReport.transactions && selectedReport.transactions.length > 0 && (
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                  <DocumentTextIcon className="h-5 w-5 mr-2 text-primary-500" />
                  {t('reports.transactions')}
                </h4>
                <Table
                  columns={transactionColumns}
                  data={selectedReport.transactions}
                  emptyMessage={t('reports.noTransactions')}
                />
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DailyClosingReport;
