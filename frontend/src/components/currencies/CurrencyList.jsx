import React from 'react';
import { useTranslation } from 'react-i18next';
import { PencilIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { Table } from '../common';
import { Button } from '../common';

const CurrencyList = ({ currencies, loading, onEdit, onToggleStatus, isAdmin }) => {
  const { t } = useTranslation();

  const columns = [
    {
      header: t('currencies.code'),
      accessor: 'code',
      render: (value) => (
        <span className="font-mono font-semibold text-gray-900">{value}</span>
      )
    },
    {
      header: t('currencies.name'),
      accessor: 'name'
    },
    {
      header: t('currencies.symbol'),
      accessor: 'symbol',
      render: (value) => (
        <span className="font-mono text-lg">{value}</span>
      )
    },
    {
      header: t('currencies.status'),
      accessor: 'is_active',
      render: (value) => (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            value
              ? 'bg-green-100 text-green-800'
              : 'bg-red-100 text-red-800'
          }`}
        >
          {value ? t('currencies.active') : t('currencies.inactive')}
        </span>
      )
    },
    {
      header: t('currencies.actions'),
      accessor: 'id',
      render: (_, row) => (
        <div className="flex items-center space-x-2">
          {isAdmin && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onEdit(row)}
                title={t('currencies.edit')}
              >
                <PencilIcon className="h-4 w-4" />
              </Button>
              <Button
                variant={row.is_active ? 'danger' : 'primary'}
                size="sm"
                onClick={() => onToggleStatus(row)}
                title={row.is_active ? t('currencies.deactivate') : t('currencies.activate')}
              >
                {row.is_active ? (
                  <XCircleIcon className="h-4 w-4" />
                ) : (
                  <CheckCircleIcon className="h-4 w-4" />
                )}
              </Button>
            </>
          )}
        </div>
      )
    }
  ];

  return (
    <Table
      columns={columns}
      data={currencies}
      loading={loading}
      emptyMessage={t('currencies.noCurrencies')}
    />
  );
};

export default CurrencyList;
