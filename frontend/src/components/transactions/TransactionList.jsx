import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import transactionService from '../../services/transactionService';
import currencyService from '../../services/currencyService';
import userService from '../../services/userService';
import { Button, Table, Pagination, ConfirmDialog, AdvancedFilters } from '../common';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { FunnelIcon, ArrowPathIcon, XCircleIcon, TrashIcon, EyeIcon, ArrowPathRoundedSquareIcon } from '@heroicons/react/24/outline';
import ReceiptActions from './ReceiptActions';
import BulkImportModal from './BulkImportModal';

const TransactionList = ({ onRefresh, onRepeat }) => {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({});

  // Cancel/Delete dialog states
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchCurrencies();
    fetchEmployees();
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [page, onRefresh]);

  const fetchCurrencies = async () => {
    try {
      const currencies = await currencyService.getCurrencies(true);
      setCurrencies(currencies || []);
    } catch (error) {
      console.error('Failed to fetch currencies:', error);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await userService.getEmployees();
      if (response.success) {
        setEmployees(response.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch employees:', error);
    }
  };

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: 10,
        ...filters
      };

      // Map AdvancedFilters amount range keys if present
      // AdvancedFilters uses minAmount/maxAmount which matches backend

      const response = await transactionService.getTransactions(params);
      if (response.success) {
        setTransactions(response.data.transactions || response.data);
        setTotalPages(response.data.pagination?.totalPages || response.data.totalPages || 1);
      }
    } catch (error) {
      toast.error(t('common.error'));
      console.error('Failed to fetch transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleApplyFilters = () => {
    setPage(1);
    fetchTransactions();
  };

  const handleResetFilters = () => {
    setFilters({});
    setPage(1);
    setTimeout(() => {
      // Need to re-trigger fetch after state update
      // But fetchTransactions reads from 'filters' state which is stale in this closure?
      // With the useEffect dependency on 'filters' removed, we need to manually trigger
      // Actually fetchTransactions depends on 'page' and 'onRefresh'. 
      // We should probably just set filters and then allow manual refresh or add 'filters' to dependency if we wanted auto-refresh
      // But AdvancedFilters usually requires manual 'Apply'.
      // So here we'll just reset and let user click filter or auto-trigger? 
      // Existing code used setTimeout. Let's call service directly with empty params for reset.
      setLoading(true);
      transactionService.getTransactions({ page: 1, limit: 10 }).then(response => {
        if (response.success) {
          setTransactions(response.data.transactions || response.data);
          setTotalPages(response.data.pagination?.totalPages || response.data.totalPages || 1);
        }
        setLoading(false);
      });
    }, 0);
  };

  // Cancel transaction handlers
  const handleCancelClick = (transaction) => {
    setSelectedTransaction(transaction);
    setCancelDialogOpen(true);
  };

  const handleCancelConfirm = async (reason) => {
    if (!selectedTransaction) return;

    setActionLoading(true);
    try {
      const response = await transactionService.cancelTransaction(selectedTransaction.uuid, reason);
      if (response.success) {
        toast.success(t('transactions.transactionCancelled'));
        fetchTransactions();
      } else {
        toast.error(response.message || t('common.error'));
      }
    } catch (error) {
      toast.error(t('common.error'));
      console.error('Failed to cancel transaction:', error);
    } finally {
      setActionLoading(false);
      setCancelDialogOpen(false);
      setSelectedTransaction(null);
    }
  };

  // Delete transaction handlers
  const handleDeleteClick = (transaction) => {
    setSelectedTransaction(transaction);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedTransaction) return;

    setActionLoading(true);
    try {
      const response = await transactionService.deleteTransaction(selectedTransaction.uuid);
      if (response.success) {
        toast.success(t('transactions.transactionDeleted'));
        fetchTransactions();
      } else {
        toast.error(response.message || t('common.error'));
      }
    } catch (error) {
      toast.error(t('common.error'));
      console.error('Failed to delete transaction:', error);
    } finally {
      setActionLoading(false);
      setDeleteDialogOpen(false);
      setSelectedTransaction(null);
    }
  };

  // Status badge component
  const StatusBadge = ({ status }) => {
    const statusStyles = {
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    };

    const statusLabels = {
      completed: t('transactions.completed'),
      cancelled: t('transactions.cancelled')
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyles[status] || 'bg-gray-100 text-gray-800'}`}>
        {statusLabels[status] || status}
      </span>
    );
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const currencyOptions = [
    { value: '', label: t('common.all') },
    ...currencies.map(c => ({
      value: c.code,
      label: `${c.code} - ${c.name}`
    }))
  ];

  const employeeOptions = [
    { value: '', label: t('reports.allEmployees') },
    ...employees.map(e => ({
      value: e.uuid,
      label: e.fullName
    }))
  ];

  const statusOptions = [
    { value: '', label: t('common.all') },
    { value: 'completed', label: t('transactions.completed') },
    { value: 'cancelled', label: t('transactions.cancelled') }
  ];

  const filterConfig = [
    {
      key: 'transactionNumber',
      type: 'text',
      label: t('transactions.transactionNumber') || 'Transaction ID',
      placeholder: 'TRX-...'
    },
    {
      key: 'dateRange',
      type: 'dateRange',
      startKey: 'startDate',
      endKey: 'endDate',
      startLabel: t('common.startDate'),
      endLabel: t('common.endDate')
    },
    {
      key: 'customerName',
      type: 'text',
      label: t('transactions.customerName'),
      placeholder: t('common.search')
    },
    {
      key: 'customerPhone',
      type: 'text',
      label: t('transactions.phone') || 'Phone',
      placeholder: 'e.g. 555-0123'
    },
    {
      key: 'amountRange',
      type: 'amountRange',
      minKey: 'minAmount',
      maxKey: 'maxAmount',
      minLabel: t('filters.minAmount'),
      maxLabel: t('filters.maxAmount')
    },
    {
      key: 'currencyIn',
      type: 'select',
      label: t('transactions.currencyIn'),
      options: currencyOptions
    },
    {
      key: 'currencyOut',
      type: 'select',
      label: t('transactions.currencyOut'),
      options: currencyOptions
    },
    {
      key: 'status',
      type: 'select',
      label: t('common.status'),
      options: statusOptions
    },
    {
      key: 'employeeId',
      type: 'select',
      label: t('transactions.employee'),
      options: employeeOptions
    },
    {
      key: 'notes',
      type: 'text',
      label: t('transactions.notes') || 'Notes',
      placeholder: 'Search notes...'
    }
  ];

  const columns = [
    {
      header: t('transactions.date'),
      accessor: 'transactionDate',
      render: (value, row) => (
        <div className="flex flex-col">
          <span className={`text-gray-600 text-sm ${row.status === 'cancelled' ? 'line-through' : ''}`}>
            {formatDate(value)}
          </span>
          {row.isFlagged && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 mt-1" title={row.flagReason}>
              <svg className="mr-1 h-3 w-3 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z" clipRule="evenodd" />
              </svg>
              Flagged
            </span>
          )}
        </div>
      )
    },
    {
      header: t('transactions.customerName'),
      accessor: 'customerName',
      render: (value, row) => (
        <div className={row.status === 'cancelled' ? 'line-through opacity-60' : ''}>
          <div className="font-medium text-gray-900">{value}</div>
          {row.customerPhone && (
            <div className="text-sm text-gray-500">{row.customerPhone}</div>
          )}
        </div>
      )
    },
    {
      header: t('transactions.currencyIn'),
      accessor: 'currencyIn',
      render: (_, row) => (
        <span className={`text-green-600 font-medium ${row.status === 'cancelled' ? 'line-through opacity-60' : ''}`}>
          {row.currencyInCode} {formatCurrency(row.amountIn)}
        </span>
      )
    },
    {
      header: t('transactions.currencyOut'),
      accessor: 'currencyOut',
      render: (_, row) => (
        <span className={`text-red-600 font-medium ${row.status === 'cancelled' ? 'line-through opacity-60' : ''}`}>
          {row.currencyOutCode} {formatCurrency(row.amountOut)}
        </span>
      )
    },
    {
      header: t('transactions.exchangeRate'),
      accessor: 'exchangeRate',
      render: (value, row) => (
        <span className={`text-gray-700 ${row.status === 'cancelled' ? 'line-through opacity-60' : ''}`}>
          {formatCurrency(value)}
        </span>
      )
    },
    {
      header: t('common.status'),
      accessor: 'status',
      render: (value) => (
        <StatusBadge status={value || 'completed'} />
      )
    },
    {
      header: t('transactions.employee'),
      accessor: 'employeeName',
      render: (value, row) => (
        <span className={`text-gray-500 ${row.status === 'cancelled' ? 'line-through opacity-60' : ''}`}>
          {value}
        </span>
      )
    },
    {
      header: t('receipts.print') || 'Receipt',
      accessor: 'receipt',
      render: (_, row) => (
        <ReceiptActions transaction={row} size="sm" />
      )
    },
    {
      header: t('common.actions'),
      accessor: 'actions',
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <Link
            to={`/transactions/${row.uuid}`}
            className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
            title={t('transactions.viewDetails')}
          >
            <EyeIcon className="h-5 w-5" />
          </Link>
          {row.status !== 'cancelled' && (
            <button
              onClick={() => handleCancelClick(row)}
              className="p-1 text-orange-600 hover:text-orange-800 hover:bg-orange-50 rounded"
              title={t('transactions.cancelTransaction')}
            >
              <XCircleIcon className="h-5 w-5" />
            </button>
          )}
          {isAdmin() && (
            <button
              onClick={() => handleDeleteClick(row)}
              className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
              title={t('transactions.deleteTransaction')}
            >
              <TrashIcon className="h-5 w-5" />
            </button>
          )}
          <button
            onClick={() => onRepeat(row)}
            className="p-1 text-green-600 hover:text-green-800 hover:bg-green-50 rounded"
            title={t('transactions.repeatTransaction') || 'Repeat'}
          >
            <ArrowPathRoundedSquareIcon className="h-5 w-5" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-4">
      {/* Header with Refresh button */}
      <div className="flex justify-end gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={fetchTransactions}
        >
          <ArrowPathIcon className="h-4 w-4 mr-2 rtl:mr-0 rtl:ml-2" />
          {t('common.refresh')}
        </Button>
      </div>

      {/* Advanced Filters */}
      <AdvancedFilters
        resourceType="transactions"
        filters={filters}
        filterConfig={filterConfig}
        onFilterChange={handleFilterChange}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
        isOpen={showFilters}
        onToggle={() => setShowFilters(!showFilters)}
      />

      {/* Transactions Table */}
      <Table
        columns={columns}
        data={transactions}
        loading={loading}
        emptyMessage={t('common.noData')}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      )}

      {/* Cancel Transaction Dialog */}
      <ConfirmDialog
        isOpen={cancelDialogOpen}
        onClose={() => {
          setCancelDialogOpen(false);
          setSelectedTransaction(null);
        }}
        onConfirm={handleCancelConfirm}
        title={t('transactions.cancelTransaction')}
        message={t('transactions.confirmCancel')}
        confirmText={t('transactions.cancelTransaction')}
        confirmVariant="danger"
        showReasonInput={true}
        reasonLabel={t('transactions.cancellationReason')}
        reasonPlaceholder={t('transactions.enterReason')}
        reasonRequired={false}
        loading={actionLoading}
      />

      {/* Delete Transaction Dialog */}
      <ConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setSelectedTransaction(null);
        }}
        onConfirm={handleDeleteConfirm}
        title={t('transactions.deleteTransaction')}
        message={t('transactions.confirmDelete')}
        confirmText={t('common.delete')}
        confirmVariant="danger"
        showReasonInput={false}
        loading={actionLoading}
      />
    </div>
  );
};

export default TransactionList;
