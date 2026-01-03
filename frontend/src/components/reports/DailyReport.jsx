import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { ArrowDownTrayIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
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

const DailyReport = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const exportDropdownRef = useRef(null);
  const [report, setReport] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [filters, setFilters] = useState({
    date: new Date().toISOString().split('T')[0],
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

  const fetchEmployees = useCallback(async () => {
    try {
      const response = await userService.getEmployees();
      const userList = response.data || [];
      setEmployees(userList);
    } catch (error) {
      console.error('Failed to fetch employees:', error);
    }
  }, []);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const response = await reportService.getDailyReport(
        filters.date,
        filters.employeeId || undefined
      );
      // Extract nested data from API response
      const data = response.data || response;
      setReport({
        transactions: data.transactions || [],
        totalTransactions: data.summary?.totalTransactions || 0,
        totalProfit: data.summary?.totalProfit || 0,
        totalCommission: data.summary?.totalCommission || 0,
        byCurrency: data.summary?.byCurrency || [],
        baseCurrency: 'USD'
      });
    } catch (error) {
      console.error('Failed to fetch daily report:', error);
    } finally {
      setLoading(false);
    }
  }, [filters.date, filters.employeeId]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleExport = async (format) => {
    setExporting(true);
    setExportDropdownOpen(false);
    try {
      const response = await reportService.exportDailyReport(filters.date, format);
      const extension = format === 'xlsx' ? 'xlsx' : format === 'csv' ? 'csv' : 'pdf';
      const filename = `daily-report-${filters.date}.${extension}`;
      downloadFile(response, filename);
      toast.success(t('reports.exportSuccess'));
    } catch (error) {
      console.error('Failed to export daily report:', error);
      toast.error(t('reports.exportError'));
    } finally {
      setExporting(false);
    }
  };

  const employeeOptions = employees.map(emp => ({
    value: emp.uuid || emp.id,
    label: emp.fullName || emp.name || emp.username
  }));

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
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${value === 'buy' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
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
      header: t('reports.rate'),
      accessor: 'rate',
      render: (value) => value?.toFixed(4)
    },
    {
      header: t('reports.total'),
      accessor: 'total',
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
      {/* Filters */}
      <Card>
        <div className="flex flex-wrap gap-4 items-end justify-between">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('reports.date')}
              </label>
              <input
                type="date"
                value={filters.date}
                onChange={(e) => handleFilterChange('date', e.target.value)}
                className="input-field"
              />
            </div>
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
              <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 dark:ring-gray-700 ring-black ring-opacity-5 z-10">
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

          {/* Transactions Table */}
          <Card title={t('reports.transactions')}>
            <Table
              columns={transactionColumns}
              data={report.transactions || []}
              loading={loading}
              emptyMessage={t('reports.noTransactions')}
            />
          </Card>
        </>
      ) : null}
    </div>
  );
};

export default DailyReport;
