import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { ArrowDownTrayIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import reportService from '../../services/reportService';
import userService from '../../services/userService';
import { Button, Select, Card, StatCard, Table } from '../common';
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

const MonthlyReport = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const exportDropdownRef = useRef(null);
  const [report, setReport] = useState(null);
  const [employees, setEmployees] = useState([]);

  const currentDate = new Date();
  const [filters, setFilters] = useState({
    year: currentDate.getFullYear(),
    month: currentDate.getMonth() + 1,
    employeeId: ''
  });

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
    fetchEmployees();
  }, []);

  useEffect(() => {
    fetchReport();
  }, [filters]);

  const fetchEmployees = async () => {
    try {
      const response = await userService.getEmployees();
      const userList = response.data || [];
      setEmployees(userList);
    } catch (error) {
      console.error('Failed to fetch employees:', error);
    }
  };

  const fetchReport = async () => {
    setLoading(true);
    try {
      const data = await reportService.getMonthlyReport(
        filters.year,
        filters.month,
        filters.employeeId || undefined
      );
      setReport(data);
    } catch (error) {
      console.error('Failed to fetch monthly report:', error);
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
      const response = await reportService.exportMonthlyReport(filters.year, filters.month, format);
      const extension = format === 'xlsx' ? 'xlsx' : format === 'csv' ? 'csv' : 'pdf';
      const monthStr = String(filters.month).padStart(2, '0');
      const filename = `monthly-report-${filters.year}-${monthStr}.${extension}`;
      downloadFile(response, filename);
      toast.success(t('reports.exportSuccess'));
    } catch (error) {
      console.error('Failed to export monthly report:', error);
      toast.error(t('reports.exportError'));
    } finally {
      setExporting(false);
    }
  };

  const employeeOptions = employees.map(emp => ({
    value: emp.uuid || emp.id,
    label: emp.fullName || emp.name || emp.username
  }));

  const yearOptions = [];
  for (let year = currentDate.getFullYear(); year >= currentDate.getFullYear() - 5; year--) {
    yearOptions.push({ value: year, label: year.toString() });
  }

  const monthOptions = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: t(`reports.months.${i + 1}`)
  }));

  const currencyColumns = [
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

  const employeeColumns = [
    {
      header: t('reports.employee'),
      accessor: 'name'
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

  const chartData = report?.dailyBreakdown?.map(day => ({
    date: day.date,
    transactions: day.transactionCount,
    profit: day.profit
  })) || [];

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <div className="flex flex-wrap gap-4 items-end justify-between">
          <div className="flex flex-wrap gap-4 items-end">
            <Select
              label={t('reports.year')}
              options={yearOptions}
              value={filters.year}
              onChange={(e) => handleFilterChange('year', parseInt(e.target.value))}
              className="min-w-[120px]"
            />
            <Select
              label={t('reports.month')}
              options={monthOptions}
              value={filters.month}
              onChange={(e) => handleFilterChange('month', parseInt(e.target.value))}
              className="min-w-[150px]"
            />
            <Select
              label={t('reports.employee')}
              placeholder={t('reports.allEmployees')}
              options={employeeOptions}
              value={filters.employeeId}
              onChange={(e) => handleFilterChange('employeeId', e.target.value)}
              className="min-w-[200px]"
            />
            <Button onClick={fetchReport} loading={loading}>
              {t('reports.refresh')}
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
              <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
                <div className="py-1">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <StatCard
              title={t('reports.totalTransactions')}
              value={report.totalTransactions?.toLocaleString() || '0'}
            />
            <StatCard
              title={t('reports.totalProfit')}
              value={`${report.totalProfit?.toLocaleString() || '0'} ${report.baseCurrency || ''}`}
            />
          </div>

          {/* Daily Breakdown Chart */}
          <Card title={t('reports.dailyBreakdown')}>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => {
                      const date = new Date(value);
                      return date.getDate().toString();
                    }}
                  />
                  <YAxis yAxisId="left" orientation="left" stroke="#3b82f6" />
                  <YAxis yAxisId="right" orientation="right" stroke="#10b981" />
                  <Tooltip
                    labelFormatter={(value) => new Date(value).toLocaleDateString()}
                    formatter={(value, name) => [
                      value?.toLocaleString(),
                      name === 'transactions' ? t('reports.transactions') : t('reports.profit')
                    ]}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="transactions"
                    fill="#3b82f6"
                    name="transactions"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    yAxisId="right"
                    dataKey="profit"
                    fill="#10b981"
                    name="profit"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Currency Breakdown Table */}
          <Card title={t('reports.currencyBreakdown')}>
            <Table
              columns={currencyColumns}
              data={report.currencyBreakdown || []}
              loading={loading}
              emptyMessage={t('reports.noData')}
            />
          </Card>

          {/* Employee Performance Table */}
          <Card title={t('reports.employeePerformance')}>
            <Table
              columns={employeeColumns}
              data={report.employeePerformance || []}
              loading={loading}
              emptyMessage={t('reports.noData')}
            />
          </Card>
        </>
      ) : null}
    </div>
  );
};

export default MonthlyReport;
