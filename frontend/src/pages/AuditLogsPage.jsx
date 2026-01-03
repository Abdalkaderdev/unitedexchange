import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Button, Input, Select, Loading, Modal } from '../components/common';
import { Pagination } from '../components/common/Table';
import auditService from '../services/auditService';
import userService from '../services/userService';
import toast from 'react-hot-toast';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  EyeIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XCircleIcon,
  ShieldExclamationIcon
} from '@heroicons/react/24/outline';

const AuditLogsPage = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar' || i18n.language === 'ku';

  const [logs, setLogs] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 });

  const [filters, setFilters] = useState({
    action: '',
    resourceType: '',
    userId: '',
    severity: '',
    startDate: '',
    endDate: '',
    search: ''
  });

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== ''))
      };
      const response = await auditService.getLogs(params);
      if (response.success) {
        setLogs(response.data || []);
        setPagination(prev => ({ ...prev, ...response.pagination }));
      }
    } catch (error) {
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, filters, t]);

  const fetchUsers = async () => {
    try {
      const response = await userService.getEmployees();
      if (response.success) {
        setUsers(response.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch users');
    }
  };

  useEffect(() => {
    fetchLogs();
    fetchUsers();
  }, [fetchLogs]);

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const applyFilters = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchLogs();
  };

  const resetFilters = () => {
    setFilters({
      action: '',
      resourceType: '',
      userId: '',
      severity: '',
      startDate: '',
      endDate: '',
      search: ''
    });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const viewLogDetails = (log) => {
    setSelectedLog(log);
    setShowDetailModal(true);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString(i18n.language);
  };

  const getSeverityBadge = (severity) => {
    const config = {
      info: { bg: 'bg-blue-100', text: 'text-blue-800', icon: InformationCircleIcon },
      warning: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: ExclamationTriangleIcon },
      error: { bg: 'bg-red-100', text: 'text-red-800', icon: XCircleIcon },
      critical: { bg: 'bg-red-200', text: 'text-red-900', icon: ShieldExclamationIcon }
    };
    const c = config[severity] || config.info;
    const Icon = c.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
        <Icon className="h-3 w-3" />
        {severity}
      </span>
    );
  };

  const getActionLabel = (action) => {
    const labels = {
      'CREATE': t('audit.actions.create') || 'Create',
      'UPDATE': t('audit.actions.update') || 'Update',
      'DELETE': t('audit.actions.delete') || 'Delete',
      'LOGIN': t('audit.actions.login') || 'Login',
      'LOGOUT': t('audit.actions.logout') || 'Logout',
      'SHIFT_START': t('audit.actions.shiftStart') || 'Shift Start',
      'SHIFT_END': t('audit.actions.shiftEnd') || 'Shift End'
    };
    return labels[action] || action;
  };

  const actionOptions = [
    { value: '', label: t('common.all') },
    { value: 'CREATE', label: 'Create' },
    { value: 'UPDATE', label: 'Update' },
    { value: 'DELETE', label: 'Delete' },
    { value: 'LOGIN', label: 'Login' },
    { value: 'LOGOUT', label: 'Logout' },
    { value: 'SHIFT_START', label: 'Shift Start' },
    { value: 'SHIFT_END', label: 'Shift End' }
  ];

  const resourceTypeOptions = [
    { value: '', label: t('common.all') },
    { value: 'transactions', label: t('nav.transactions') },
    { value: 'users', label: t('nav.users') },
    { value: 'currencies', label: t('nav.currencies') },
    { value: 'customers', label: t('nav.customers') },
    { value: 'exchange_rates', label: t('nav.exchangeRates') },
    { value: 'shifts', label: t('nav.shifts') },
    { value: 'cash_drawers', label: t('nav.cashDrawers') }
  ];

  const severityOptions = [
    { value: '', label: t('common.all') },
    { value: 'info', label: 'Info' },
    { value: 'warning', label: 'Warning' },
    { value: 'error', label: 'Error' },
    { value: 'critical', label: 'Critical' }
  ];

  return (
    <div className={`space-y-6 ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('audit.title') || 'Audit Logs'}</h1>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setShowFilters(!showFilters)}>
            <FunnelIcon className="h-4 w-4 mr-2" />
            {t('common.filter')}
          </Button>
          <Button variant="secondary" onClick={fetchLogs}>
            <ArrowPathIcon className="h-4 w-4 mr-2" />
            {t('common.refresh')}
          </Button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <Input
              label={t('common.search')}
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              placeholder={t('audit.searchPlaceholder') || 'Search...'}
            />
            <Select
              label={t('audit.action') || 'Action'}
              value={filters.action}
              onChange={(e) => handleFilterChange('action', e.target.value)}
              options={actionOptions}
            />
            <Select
              label={t('audit.resourceType') || 'Resource Type'}
              value={filters.resourceType}
              onChange={(e) => handleFilterChange('resourceType', e.target.value)}
              options={resourceTypeOptions}
            />
            <Select
              label={t('audit.severity') || 'Severity'}
              value={filters.severity}
              onChange={(e) => handleFilterChange('severity', e.target.value)}
              options={severityOptions}
            />
            <Select
              label={t('audit.user') || 'User'}
              value={filters.userId}
              onChange={(e) => handleFilterChange('userId', e.target.value)}
              options={[
                { value: '', label: t('common.all') },
                ...users.map(u => ({ value: u.uuid, label: u.fullName }))
              ]}
            />
            <Input
              label={t('reports.startDate')}
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
            />
            <Input
              label={t('reports.endDate')}
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
            />
            <div className="flex items-end gap-2">
              <Button onClick={applyFilters}>{t('common.filter')}</Button>
              <Button variant="secondary" onClick={resetFilters}>{t('common.cancel')}</Button>
            </div>
          </div>
        </Card>
      )}

      {/* Logs Table */}
      <Card>
        {loading ? (
          <div className="flex justify-center py-12">
            <Loading size="lg" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('audit.timestamp') || 'Timestamp'}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('audit.user') || 'User'}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('audit.action') || 'Action'}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('audit.resource') || 'Resource'}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('audit.severity') || 'Severity'}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-4 py-12 text-center text-gray-500">
                        {t('common.noData')}
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {formatDate(log.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className="font-medium text-gray-900">
                            {log.user?.fullName || 'System'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-gray-800 text-xs font-medium">
                            {getActionLabel(log.action)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {log.resourceType}
                          {log.resourceId && <span className="text-gray-400 ml-1">#{log.resourceId}</span>}
                        </td>
                        <td className="px-4 py-3">
                          {getSeverityBadge(log.severity)}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => viewLogDetails(log)}
                            className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                            title={t('common.view')}
                          >
                            <EyeIcon className="h-5 w-5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {pagination.totalPages > 1 && (
              <div className="mt-4">
                <Pagination
                  page={pagination.page}
                  totalPages={pagination.totalPages}
                  onPageChange={(page) => setPagination(prev => ({ ...prev, page }))}
                />
              </div>
            )}
          </>
        )}
      </Card>

      {/* Log Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title={t('audit.logDetails') || 'Log Details'}
        size="lg"
      >
        {selectedLog && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 uppercase">{t('audit.timestamp') || 'Timestamp'}</label>
                <p className="font-medium">{formatDate(selectedLog.createdAt)}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase">{t('audit.user') || 'User'}</label>
                <p className="font-medium">{selectedLog.user?.fullName || 'System'}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase">{t('audit.action') || 'Action'}</label>
                <p className="font-medium">{getActionLabel(selectedLog.action)}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase">{t('audit.resource') || 'Resource'}</label>
                <p className="font-medium">{selectedLog.resourceType} #{selectedLog.resourceId}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase">{t('audit.severity') || 'Severity'}</label>
                <p>{getSeverityBadge(selectedLog.severity)}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase">{t('audit.ipAddress') || 'IP Address'}</label>
                <p className="font-medium font-mono">{selectedLog.ipAddress || '-'}</p>
              </div>
            </div>

            {selectedLog.oldValues && (
              <div>
                <label className="text-xs text-gray-500 uppercase mb-1 block">{t('audit.oldValues') || 'Previous Values'}</label>
                <pre className="bg-red-50 p-3 rounded text-xs overflow-x-auto text-red-800">
                  {JSON.stringify(selectedLog.oldValues, null, 2)}
                </pre>
              </div>
            )}

            {selectedLog.newValues && (
              <div>
                <label className="text-xs text-gray-500 uppercase mb-1 block">{t('audit.newValues') || 'New Values'}</label>
                <pre className="bg-green-50 p-3 rounded text-xs overflow-x-auto text-green-800">
                  {JSON.stringify(selectedLog.newValues, null, 2)}
                </pre>
              </div>
            )}

            <div className="flex justify-end pt-4">
              <Button variant="secondary" onClick={() => setShowDetailModal(false)}>
                {t('common.close')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AuditLogsPage;
