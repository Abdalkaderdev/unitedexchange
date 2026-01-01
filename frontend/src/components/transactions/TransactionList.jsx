import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import transactionService from '../../services/transactionService';
import currencyService from '../../services/currencyService';
import { Button, Input, Select, Table, Card, Pagination, ConfirmDialog } from '../common';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { FunnelIcon, ArrowPathIcon, XCircleIcon, TrashIcon, EyeIcon } from '@heroicons/react/24/outline';
import ReceiptActions from './ReceiptActions';

const TransactionList = ({ onRefresh }) => {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    currencyCode: '',
    customerName: '',
    status: ''
  });

  // Cancel/Delete dialog states
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchCurrencies();
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

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: 10,
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value !== '')
        )
      };
      const response = await transactionService.getTransactions(params);
      if (response.success) {
        setTransactions(response.data.transactions || response.data);
        setTotalPages(response.data.totalPages || 1);
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
    setFilters({
      dateFrom: '',
      dateTo: '',
      currencyCode: '',
      customerName: '',
      status: ''
    });
    setPage(1);
    fetchTransactions();
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

  // Status filter options
  const statusOptions = [
    { value: '', label: t('common.all') },
    { value: 'completed', label: t('transactions.completed') },
    { value: 'cancelled', label: t('transactions.cancelled') }
  ];

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

  const currencyOptions = currencies.map(c => ({
    value: c.code,
    label: `${c.code} - ${c.name}`
  }));

  const columns = [
    {
      header: t('transactions.date'),
      accessor: 'transactionDate',
      render: (value, row) => (
        <span className={`text-gray-600 text-sm ${row.status === 'cancelled' ? 'line-through' : ''}`}>
          {formatDate(value)}
        </span>
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
        </div>
      )
    }
  ];

  return (
    <div className="space-y-4">
      {/* Filter Toggle Button */}
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
        >
          <FunnelIcon className="h-4 w-4 mr-2 rtl:mr-0 rtl:ml-2" />
          {t('common.filter')}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={fetchTransactions}
        >
          <ArrowPathIcon className="h-4 w-4 mr-2 rtl:mr-0 rtl:ml-2" />
          {t('common.refresh')}
        </Button>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <Card className="bg-gray-50">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <Input
              label={t('transactions.date') + ' (' + t('common.from') + ')'}
              type="date"
              value={filters.dateFrom}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
            />
            <Input
              label={t('transactions.date') + ' (' + t('common.to') + ')'}
              type="date"
              value={filters.dateTo}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
            />
            <Select
              label={t('currencies.code')}
              options={currencyOptions}
              placeholder={t('common.all')}
              value={filters.currencyCode}
              onChange={(e) => handleFilterChange('currencyCode', e.target.value)}
            />
            <Input
              label={t('transactions.customerName')}
              placeholder={t('common.search')}
              value={filters.customerName}
              onChange={(e) => handleFilterChange('customerName', e.target.value)}
            />
            <Select
              label={t('common.status')}
              options={statusOptions}
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 mt-4">
            <Button size="sm" onClick={handleApplyFilters}>
              {t('common.filter')}
            </Button>
            <Button variant="secondary" size="sm" onClick={handleResetFilters}>
              {t('common.cancel')}
            </Button>
          </div>
        </Card>
      )}

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
