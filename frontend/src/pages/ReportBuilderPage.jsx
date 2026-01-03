import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card, Select, Loading } from '../components/common';
import api from '../services/api';
import reportService from '../services/reportService';
import toast from 'react-hot-toast';
import {
  ChartBarIcon,
  TableCellsIcon,
  ArrowDownTrayIcon,
  PlayIcon,
  AdjustmentsHorizontalIcon
} from '@heroicons/react/24/outline';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

const ReportBuilderPage = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'chart'

  // Report configuration
  const [config, setConfig] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    groupBy: 'day',
    metrics: ['transaction_count', 'total_profit'],
    filters: {}
  });

  useEffect(() => {
    fetchFilters();
  }, []);

  const fetchFilters = async () => {
    try {
      const [usersRes, currenciesRes] = await Promise.all([
        api.get('/users/employees'),
        api.get('/currencies')
      ]);
      if (usersRes.data.success) setEmployees(usersRes.data.data || []);
      if (currenciesRes.data.success) setCurrencies(currenciesRes.data.currencies || currenciesRes.data.data || []);
    } catch (error) {
      console.error('Error fetching filters:', error);
    }
  };

  const groupByOptions = [
    { value: 'day', label: t('reportBuilder.groupByDay') },
    { value: 'week', label: t('reportBuilder.groupByWeek') },
    { value: 'month', label: t('reportBuilder.groupByMonth') },
    { value: 'employee', label: t('reportBuilder.groupByEmployee') },
    { value: 'currency_in', label: t('reportBuilder.groupByCurrencyIn') },
    { value: 'currency_out', label: t('reportBuilder.groupByCurrencyOut') }
  ];

  const metricOptions = [
    { value: 'transaction_count', label: t('reportBuilder.transactionCount') },
    { value: 'total_profit', label: t('reportBuilder.totalProfit') },
    { value: 'total_commission', label: t('reportBuilder.totalCommission') },
    { value: 'total_amount_in', label: t('reportBuilder.totalAmountIn') },
    { value: 'total_amount_out', label: t('reportBuilder.totalAmountOut') },
    { value: 'avg_profit', label: t('reportBuilder.avgProfit') },
    { value: 'avg_exchange_rate', label: t('reportBuilder.avgExchangeRate') }
  ];

  const handleConfigChange = (field, value) => {
    setConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleFilterChange = (field, value) => {
    setConfig(prev => ({
      ...prev,
      filters: {
        ...prev.filters,
        [field]: value || undefined
      }
    }));
  };

  const toggleMetric = (metric) => {
    setConfig(prev => {
      const metrics = prev.metrics.includes(metric)
        ? prev.metrics.filter(m => m !== metric)
        : [...prev.metrics, metric];
      return { ...prev, metrics: metrics.length > 0 ? metrics : ['transaction_count'] };
    });
  };

  const generateReport = async () => {
    try {
      setLoading(true);
      const response = await api.post('/reports/custom', config);
      if (response.data.success) {
        setReportData(response.data.data);
        toast.success(t('reportBuilder.reportGenerated'));
      }
    } catch (error) {
      toast.error(error.response?.data?.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const exportReport = async (format) => {
    if (!reportData || !reportData.results || reportData.results.length === 0) {
      toast.error(t('reportBuilder.noDataToExport'));
      return;
    }

    try {
      if (format === 'csv') {
        // Use client-side CSV export
        const headers = Object.keys(reportData.results[0]);
        const csvRows = [headers.join(',')];
        reportData.results.forEach(row => {
          const values = headers.map(h => {
            const val = row[h];
            if (val === null || val === undefined) return '';
            return typeof val === 'string' && val.includes(',') ? `"${val}"` : val;
          });
          csvRows.push(values.join(','));
        });
        const csv = csvRows.join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.download = `custom-report-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
      } else {
        // Use server-side Excel export
        setLoading(true);
        const response = await reportService.exportCustomReport(config, format);
        const blob = new Blob([response.data]);
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.download = `custom-report-${new Date().toISOString().split('T')[0]}.${format}`;
        link.click();
        window.URL.revokeObjectURL(link.href);
        setLoading(false);
      }
      toast.success(t('reportBuilder.exportSuccess'));
    } catch (error) {
      console.error('Export error:', error);
      toast.error(t('common.error'));
      setLoading(false);
    }
  };

  const formatValue = (value, key) => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'number') {
      if (key.includes('rate')) return value.toFixed(4);
      return value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    }
    return value;
  };

  const getChartColor = (index) => {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
    return colors[index % colors.length];
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('reportBuilder.title')}</h1>
      </div>

      {/* Configuration Panel */}
      <Card>
        <div className="flex items-center mb-4">
          <AdjustmentsHorizontalIcon className="h-5 w-5 text-gray-500 mr-2" />
          <h2 className="text-lg font-medium">{t('reportBuilder.configuration')}</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('reportBuilder.startDate')}
            </label>
            <input
              type="date"
              value={config.startDate}
              onChange={(e) => handleConfigChange('startDate', e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('reportBuilder.endDate')}
            </label>
            <input
              type="date"
              value={config.endDate}
              onChange={(e) => handleConfigChange('endDate', e.target.value)}
              className="input"
            />
          </div>

          {/* Group By */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('reportBuilder.groupBy')}
            </label>
            <select
              value={config.groupBy}
              onChange={(e) => handleConfigChange('groupBy', e.target.value)}
              className="input"
            >
              {groupByOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Employee Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('reportBuilder.filterEmployee')}
            </label>
            <select
              value={config.filters.employeeId || ''}
              onChange={(e) => handleFilterChange('employeeId', e.target.value)}
              className="input"
            >
              <option value="">{t('common.all')}</option>
              {employees.map(e => (
                <option key={e.uuid} value={e.uuid}>{e.full_name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Metrics Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('reportBuilder.selectMetrics')}
          </label>
          <div className="flex flex-wrap gap-2">
            {metricOptions.map(metric => (
              <button
                key={metric.value}
                onClick={() => toggleMetric(metric.value)}
                className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${config.metrics.includes(metric.value)
                  ? 'bg-primary-100 border-primary-500 text-primary-700'
                  : 'bg-white border-gray-300 text-gray-600 hover:border-gray-400'
                  }`}
              >
                {metric.label}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 rtl:space-x-reverse">
            <Button onClick={generateReport} disabled={loading}>
              <PlayIcon className="h-4 w-4 mr-2" />
              {loading ? t('common.loading') : t('reportBuilder.generate')}
            </Button>
          </div>

          {reportData && reportData.results && reportData.results.length > 0 && (
            <div className="flex items-center space-x-2 rtl:space-x-reverse">
              <Button variant="secondary" onClick={() => setViewMode(viewMode === 'table' ? 'chart' : 'table')}>
                {viewMode === 'table' ? (
                  <>
                    <ChartBarIcon className="h-4 w-4 mr-2" />
                    {t('reportBuilder.showChart')}
                  </>
                ) : (
                  <>
                    <TableCellsIcon className="h-4 w-4 mr-2" />
                    {t('reportBuilder.showTable')}
                  </>
                )}
              </Button>
              <Button variant="secondary" onClick={() => exportReport('csv')}>
                <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                {t('reportBuilder.exportCSV')}
              </Button>
              <Button variant="secondary" onClick={() => exportReport('xlsx')}>
                <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                {t('reportBuilder.exportExcel')}
              </Button>
            </div>
          )}
        </div>
      </Card >

      {/* Loading */}
      {
        loading && (
          <div className="flex justify-center py-12">
            <Loading size="lg" />
          </div>
        )
      }

      {/* Results */}
      {
        !loading && reportData && reportData.results && (
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium">{t('reportBuilder.results')}</h2>
              <span className="text-sm text-gray-500">
                {reportData.results.length} {t('reportBuilder.records')}
              </span>
            </div>

            {reportData.results.length === 0 ? (
              <p className="text-center text-gray-500 py-8">{t('common.noData')}</p>
            ) : viewMode === 'table' ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {Object.keys(reportData.results[0]).map(key => (
                        <th key={key} className="table-header">
                          {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {reportData.results.map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        {Object.entries(row).map(([key, value], i) => (
                          <td key={i} className="table-cell">
                            {formatValue(value, key)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  {config.groupBy === 'employee' || config.groupBy === 'currency_in' || config.groupBy === 'currency_out' ? (
                    <BarChart data={reportData.results}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey={config.groupBy} />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      {config.metrics.map((metric, idx) => (
                        <Bar
                          key={metric}
                          dataKey={metric}
                          fill={getChartColor(idx)}
                          name={metricOptions.find(m => m.value === metric)?.label || metric}
                        />
                      ))}
                    </BarChart>
                  ) : (
                    <LineChart data={reportData.results}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey={config.groupBy} />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      {config.metrics.map((metric, idx) => (
                        <Line
                          key={metric}
                          type="monotone"
                          dataKey={metric}
                          stroke={getChartColor(idx)}
                          name={metricOptions.find(m => m.value === metric)?.label || metric}
                        />
                      ))}
                    </LineChart>
                  )}
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        )
      }
    </div >
  );
};

export default ReportBuilderPage;
