import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../components/common';
import TransactionList from '../components/transactions/TransactionList';
import TransactionForm from '../components/transactions/TransactionForm';
import { PlusIcon } from '@heroicons/react/24/outline';

const TransactionsPage = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    // Check if we should open the form on page load (from dashboard quick action)
    if (searchParams.get('new') === 'true') {
      setIsFormOpen(true);
      // Remove the query param to avoid reopening on refresh
      searchParams.delete('new');
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams]);

  const handleOpenForm = () => {
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
  };

  const handleTransactionCreated = () => {
    // Trigger a refresh of the transaction list
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('transactions.title')}
          </h1>
          <p className="text-gray-500 mt-1">
            {t('nav.transactions')}
          </p>
        </div>
        <Button onClick={handleOpenForm}>
          <PlusIcon className="h-5 w-5 mr-2 rtl:mr-0 rtl:ml-2" />
          {t('transactions.newTransaction')}
        </Button>
      </div>

      {/* Transaction List */}
      <TransactionList onRefresh={refreshKey} />

      {/* Transaction Form Modal */}
      <TransactionForm
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        onSuccess={handleTransactionCreated}
      />
    </div>
  );
};

export default TransactionsPage;
