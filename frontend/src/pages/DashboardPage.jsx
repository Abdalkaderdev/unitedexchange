import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Card, StatCard, Button, Loading } from '../components/common';
import CurrencyCalculator from '../components/dashboard/CurrencyCalculator';
import ProfitTicker from '../components/dashboard/ProfitTicker';
import LeaderboardWidget from '../components/dashboard/LeaderboardWidget';
import reportService from '../services/reportService';
import cashDrawerService from '../services/cashDrawerService';
import {
  LineChart,
  BarChart,
  PieChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Line,
  Bar,
  Pie,
  Cell,
  Area,
  AreaChart
} from 'recharts';
import {
  ArrowsRightLeftIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
  BanknotesIcon,
  PlusIcon
} from '@heroicons/react/24/outline';

// Chart color palette
const CHART_COLORS = [
  '#3B82F6', // blue-500
  '#10B981', // emerald-500
  '#F59E0B', // amber-500
  '#EF4444', // red-500
  '#8B5CF6', // violet-500
  '#EC4899', // pink-500
  '#06B6D4', // cyan-500
  '#84CC16', // lime-500
  '#F97316', // orange-500
  '#6366F1'  // indigo-500
];

const DashboardPage = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chartsLoading, setChartsLoading] = useState(true);
  const [dailyTrend, setDailyTrend] = useState([]);
  const [profitByCurrency, setProfitByCurrency] = useState([]);
  const [transactionsByCurrencyPair, setTransactionsByCurrencyPair] = useState([]);

  useEffect(() => {
    fetchDashboardStats();
    fetchChartData();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const response = await reportService.getDashboardStats();
      if (response.success) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchChartData = async () => {
    setChartsLoading(true);
    try {
      const response = await reportService.getDashboardCharts();
      if (response.success) {
        setDailyTrend(response.data.dailyTrend || []);
        setProfitByCurrency(response.data.profitByCurrency || []);
        setTransactionsByCurrencyPair(response.data.transactionsByCurrencyPair || []);
      }
    } catch (error) {
      console.error('Failed to fetch chart data:', error);
      // Set empty arrays on error
      setDailyTrend([]);
      setProfitByCurrency([]);
      setTransactionsByCurrencyPair([]);
    } finally {
      setChartsLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  // Custom tooltip for charts
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
          <p className="text-gray-600 dark:text-gray-300 font-medium">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.name}: {entry.name === 'profit' ? `$${formatCurrency(entry.value)}` : entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Custom tooltip for pie chart
  const PieTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
          <p className="text-gray-600 dark:text-gray-300 font-medium">{data.name}</p>
          <p className="text-sm" style={{ color: data.payload.fill }}>
            {t('dashboard.charts.transactions')}: {data.value}
          </p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loading size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('dashboard.title')}</h1>
          <p className="text-gray-500 dark:text-gray-400">
            {t('dashboard.welcome')}, {user?.fullName}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-64">
            <ProfitTicker />
          </div>
          <Button onClick={() => navigate('/transactions?new=true')}>
            <PlusIcon className="h-5 w-5 mr-2 rtl:mr-0 rtl:ml-2" />
            {t('dashboard.newTransaction')}
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t('dashboard.todayTransactions')}
          value={stats?.today?.transactionCount || 0}
          icon={ArrowsRightLeftIcon}
        />
        <StatCard
          title={t('dashboard.todayProfit')}
          value={`$${formatCurrency(stats?.today?.totalProfit || 0)}`}
          icon={BanknotesIcon}
        />
        <StatCard
          title={t('dashboard.monthlyTransactions')}
          value={stats?.thisMonth?.transactionCount || 0}
          icon={CurrencyDollarIcon}
        />
        <StatCard
          title={t('dashboard.monthlyProfit')}
          value={`$${formatCurrency(stats?.thisMonth?.totalProfit || 0)}`}
          icon={BanknotesIcon}
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard
          title={t('dashboard.activeCurrencies')}
          value={stats?.activeCurrencies || 0}
          icon={CurrencyDollarIcon}
        />
        <StatCard
          title={t('dashboard.activeUsers')}
          value={stats?.activeUsers || 0}
          icon={UserGroupIcon}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Transaction Volume & Profit Chart */}
        <Card title={t('dashboard.charts.dailyTrend')} className="lg:col-span-2">
          {chartsLoading ? (
            <div className="flex items-center justify-center h-80">
              <Loading size="md" />
            </div>
          ) : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyTrend} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTransactions" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12, fill: '#6B7280' }}
                    tickLine={false}
                    axisLine={{ stroke: '#E5E7EB' }}
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 12, fill: '#6B7280' }}
                    tickLine={false}
                    axisLine={{ stroke: '#E5E7EB' }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 12, fill: '#6B7280' }}
                    tickLine={false}
                    axisLine={{ stroke: '#E5E7EB' }}
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ paddingTop: '20px' }}
                    formatter={(value) => (
                      <span className="text-gray-600 text-sm">
                        {value === 'transactions' ? t('dashboard.charts.transactions') : t('dashboard.charts.profit')}
                      </span>
                    )}
                  />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="transactions"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorTransactions)"
                    name="transactions"
                  />
                  <Area
                    yAxisId="right"
                    type="monotone"
                    dataKey="profit"
                    stroke="#10B981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorProfit)"
                    name="profit"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* --- Leaderboard Widget in a new layout row --- */}
        <div className="lg:col-span-1">
          <LeaderboardWidget />
        </div>
        <div className="lg:col-span-1">
          <Card title={t('dashboard.charts.profitByCurrency')}>
            {chartsLoading ? (
              <div className="flex items-center justify-center h-80">
                <Loading size="md" />
              </div>
            ) : (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={profitByCurrency} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 12, fill: '#6B7280' }}
                      tickLine={false}
                      axisLine={{ stroke: '#E5E7EB' }}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: '#6B7280' }}
                      tickLine={false}
                      axisLine={{ stroke: '#E5E7EB' }}
                      tickFormatter={(value) => `$${value}`}
                    />
                    <Tooltip
                      formatter={(value) => [`$${formatCurrency(value)}`, t('dashboard.charts.profit')]}
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #E5E7EB',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                      }}
                    />
                    <Bar
                      dataKey="profit"
                      radius={[4, 4, 0, 0]}
                    >
                      {profitByCurrency.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </div>

        {/* Transactions by Currency Pair Pie Chart */}
        <Card title={t('dashboard.charts.transactionsByCurrencyPair')}>
          {chartsLoading ? (
            <div className="flex items-center justify-center h-80">
              <Loading size="md" />
            </div>
          ) : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={transactionsByCurrencyPair}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={{ stroke: '#9CA3AF', strokeWidth: 1 }}
                  >
                    {transactionsByCurrencyPair.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                        stroke="white"
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                  <Legend
                    layout="vertical"
                    align="right"
                    verticalAlign="middle"
                    formatter={(value) => (
                      <span className="text-gray-600 text-sm">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card title={t('dashboard.recentTransactions')}>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="table-header">{t('transactions.customerName')}</th>
                <th className="table-header">{t('transactions.currencyIn')}</th>
                <th className="table-header">{t('transactions.currencyOut')}</th>
                <th className="table-header">{t('transactions.employee')}</th>
                <th className="table-header">{t('transactions.date')}</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {stats?.recentTransactions?.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    {t('common.noData')}
                  </td>
                </tr>
              ) : (
                stats?.recentTransactions?.map((tx) => (
                  <tr key={tx.uuid} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="table-cell font-medium">{tx.customerName}</td>
                    <td className="table-cell">
                      <span className="text-green-600 dark:text-green-400">
                        {tx.currencyInCode} {formatCurrency(tx.amountIn)}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className="text-red-600 dark:text-red-400">
                        {tx.currencyOutCode} {formatCurrency(tx.amountOut)}
                      </span>
                    </td>
                    <td className="table-cell text-gray-500 dark:text-gray-400">{tx.employeeName}</td>
                    <td className="table-cell text-gray-500 dark:text-gray-400 text-sm">
                      {formatDate(tx.transactionDate)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Calculator and Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CurrencyCalculator />

        {/* Quick Actions */}
        <Card title={t('dashboard.quickActions')}>
          <div className="grid grid-cols-2 gap-4">
            <Button
              variant="secondary"
              className="flex-col h-24"
              onClick={() => navigate('/transactions')}
            >
              <ArrowsRightLeftIcon className="h-6 w-6 mb-2" />
              <span className="text-sm">{t('nav.transactions')}</span>
            </Button>
            <Button
              variant="secondary"
              className="flex-col h-24"
              onClick={() => navigate('/currencies')}
            >
              <CurrencyDollarIcon className="h-6 w-6 mb-2" />
              <span className="text-sm">{t('nav.currencies')}</span>
            </Button>
            <Button
              variant="secondary"
              className="flex-col h-24"
              onClick={() => navigate('/reports')}
            >
              <BanknotesIcon className="h-6 w-6 mb-2" />
              <span className="text-sm">{t('nav.reports')}</span>
            </Button>
            <Button
              variant="secondary"
              className="flex-col h-24"
              onClick={() => navigate('/reports?tab=monthly')}
            >
              <UserGroupIcon className="h-6 w-6 mb-2" />
              <span className="text-sm">{t('reports.monthlyReport')}</span>
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default DashboardPage;
