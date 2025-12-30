import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { ArrowDownTrayIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import reportService from '../../services/reportService';
import { Button, Card, StatCard, Table } from '../common';
import { Loading } from '../common';

// Helper function for downloading files
const downloadFile = (response, filename) => {
  const blob = new Blob([response.data]);
  const link = document.createElement('a');
  link.href = window.URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(link.href);
};

const ProfitLossReport = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const exportDropdownRef = useRef(null);
  const [report, setReport] = useState(null);

  // Default to last 30 days
  const getDefaultDates = () => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    };
  };

  const [filters, setFilters] = useState(getDefaultDates());

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target)) {
        setExportDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    fetchReport();
  }, []);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const data = await reportService.getProfitLossReport(
        filters.startDate,
        filters.endDate
      );
      setReport(data);
    } catch (error) {
      console.error('Failed to fetch profit/loss report:', error);
      toast.error(t('reports.fetchError'));
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleExport = async (format) => {
    setExporting(true);
    setExportDropdownOpen(false);
    try {
      const response = await reportService.exportProfitLossReport(
        filters.startDate,
        filters.endDate,
        format
      );
      const extension = format === 'xlsx' ? 'xlsx' : format === 'csv' ? 'csv' : 'pdf';
      const filename = `profit-loss-${filters.startDate}-to-${filters.endDate}.${extension}`;
      downloadFile(response, filename);
      toast.success(t('reports.exportSuccess'));
    } catch (error) {
      console.error('Failed to export profit/loss report:', error);
      toast.error(t('reports.exportError'));
    } finally {
      setExporting(false);
    }
  };

  const handleExportTransactions = async (format) => {
    setExporting(true);
    setExportDropdownOpen(false);
    try {
      const response = await reportService.exportTransactionsReport(
        filters.startDate,
        filters.endDate,
        format
      );
      const extension = format === 'xlsx' ? 'xlsx' : format === 'csv' ? 'csv' : 'pdf';
      const filename = `transactions-${filters.startDate}-to-${filters.endDate}.${extension}`;
      downloadFile(response, filename);
      toast.success(t('reports.exportSuccess'));
    } catch (error) {
      console.error('Failed to export transactions report:', error);
      toast.error(t('reports.exportError'));
    } finally {
      setExporting(false);
    }
  };

  const summaryColumns = [
    {
      header: t('reports.currency'),
      accessor: 'currencyCode'
    },
    {
      header: t('reports.totalIn'),
      accessor: 'totalIn',
      render: (value) => value?.toLocaleString() || '0'
    },
    {
      header: t('reports.totalOut'),
      accessor: 'totalOut',
      render: (value) => value?.toLocaleString() || '0'
    },
    {
      header: t('reports.profit'),
      accessor: 'profit',
      render: (value) => (
        <span className={value >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
          {value?.toLocaleString() || '0'}
        </span>
      )
    }
  ];

  const chartData = report?.dailyProfitLoss?.map(day => ({
    date: day.date,
    profit: day.profit,
    revenue: day.revenue,
    expenses: day.expenses
  })) || [];

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <div className="flex flex-wrap gap-4 items-end justify-between">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('reports.startDate')}
              </label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('reports.endDate')}
              </label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                className="input-field"
              />
            </div>
            <Button onClick={fetchReport} loading={loading}>
              {t('reports.generateReport')}
            </Button>
          </div>

          {/* Export Dropdown */}
          <div className="relative" ref={exportDropdownRef}>
            <Button
              variant="secondary"
              onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
              disabled={exporting || !report}
              className="inline-flex items-center"
            >
              {exporting ? (
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
              )}
              {t('reports.export')}
              <ChevronDownIcon className="h-4 w-4 ml-2" />
            </Button>
            {exportDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
                <div className="py-1">
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {t('reports.profitLoss')}
                  </div>
                  <button
                    onClick={() => handleExport('xlsx')}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    {t('reports.exportExcel')}
                  </button>
                  <button
                    onClick={() => handleExport('csv')}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    {t('reports.exportCSV')}
                  </button>
                  <button
                    onClick={() => handleExport('pdf')}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    {t('reports.exportPDF')}
                  </button>
                  <div className="border-t border-gray-100 my-1"></div>
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {t('reports.transactions')}
                  </div>
                  <button
                    onClick={() => handleExportTransactions('xlsx')}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    {t('reports.exportExcel')}
                  </button>
                  <button
                    onClick={() => handleExportTransactions('csv')}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    {t('reports.exportCSV')}
                  </button>
                  <button
                    onClick={() => handleExportTransactions('pdf')}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    {t('reports.exportPDF')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {loading && !report ? (
        <Loading size="lg" className="py-12" />
      ) : report ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <StatCard
              title={t('reports.totalTransactions')}
              value={report.totalTransactions?.toLocaleString() || '0'}
            />
            <StatCard
              title={t('reports.totalIn')}
              value={`${report.totalRevenue?.toLocaleString() || '0'} ${report.baseCurrency || ''}`}
            />
            <StatCard
              title={t('reports.totalOut')}
              value={`${report.totalExpenses?.toLocaleString() || '0'} ${report.baseCurrency || ''}`}
            />
            <StatCard
              title={t('reports.netProfit')}
              value={`${report.netProfit?.toLocaleString() || '0'} ${report.baseCurrency || ''}`}
            />
          </div>

          {/* Profit/Loss Chart */}
          {chartData.length > 0 && (
            <Card title={t('reports.profitTrend')}>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(value) => {
                        const date = new Date(value);
                        return `${date.getMonth() + 1}/${date.getDate()}`;
                      }}
                    />
                    <YAxis />
                    <Tooltip
                      labelFormatter={(value) => new Date(value).toLocaleDateString()}
                      formatter={(value, name) => [
                        value?.toLocaleString(),
                        name === 'profit' ? t('reports.profit') :
                        name === 'revenue' ? t('reports.totalIn') :
                        t('reports.totalOut')
                      ]}
                    />
                    <Legend
                      formatter={(value) =>
                        value === 'profit' ? t('reports.profit') :
                        value === 'revenue' ? t('reports.totalIn') :
                        t('reports.totalOut')
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="profit"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={{ fill: '#10b981' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={{ fill: '#3b82f6' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="expenses"
                      stroke="#ef4444"
                      strokeWidth={2}
                      dot={{ fill: '#ef4444' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {/* Currency Breakdown Table */}
          <Card title={t('reports.currencyBreakdown')}>
            <Table
              columns={summaryColumns}
              data={report.currencyBreakdown || []}
              loading={loading}
              emptyMessage={t('reports.noData')}
            />
          </Card>
        </>
      ) : null}
    </div>
  );
};

export default ProfitLossReport;
