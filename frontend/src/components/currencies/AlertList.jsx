import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TrashIcon, BellIcon } from '@heroicons/react/24/outline';
import { Table, Button, ConfirmDialog, Badge } from '../common';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

// Assuming you'll create a rateAlertService or use fetch directly. 
// For now, I'll assume a prop or service call.
// Let's stick to the plan: List and Delete.

const AlertList = ({ alerts, loading, onDelete }) => {
    const { t } = useTranslation();
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [selectedAlert, setSelectedAlert] = useState(null);

    const handleDeleteClick = (alert) => {
        setSelectedAlert(alert);
        setDeleteDialogOpen(true);
    };

    const handleDeleteConfirm = () => {
        if (selectedAlert) {
            onDelete(selectedAlert.uuid);
            setDeleteDialogOpen(false);
            setSelectedAlert(null);
        }
    };

    const columns = [
        {
            header: t('currencies.currencyPair') || 'Pair',
            accessor: 'pair',
            render: (_, row) => (
                <span className="font-semibold">
                    {row.fromCurrency}/{row.toCurrency}
                </span>
            )
        },
        {
            header: t('common.condition') || 'Condition',
            accessor: 'condition',
            render: (_, row) => (
                <span>
                    {row.condition === 'above' ? '>' : '<'} {row.targetRate}
                </span>
            )
        },
        {
            header: t('common.status') || 'Status',
            accessor: 'isActive',
            render: (value) => (
                <Badge variant={value ? 'success' : 'secondary'}>
                    {value ? t('common.active') || 'Active' : t('common.inactive') || 'Inactive'}
                </Badge>
            )
        },
        {
            header: t('common.actions'),
            accessor: 'actions',
            render: (_, row) => (
                <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleDeleteClick(row)}
                    className="p-1"
                >
                    <TrashIcon className="h-4 w-4" />
                </Button>
            )
        }
    ];

    return (
        <>
            <Table
                columns={columns}
                data={alerts}
                loading={loading}
                emptyMessage={
                    <div className="text-center py-8">
                        <BellIcon className="mx-auto h-12 w-12 text-gray-400" />
                        <h3 className="mt-2 text-sm font-medium text-gray-900">{t('currencies.noAlerts') || 'No alerts set'}</h3>
                        <p className="mt-1 text-sm text-gray-500">{t('currencies.createFirstAlert') || 'Create your first rate alert.'}</p>
                    </div>
                }
            />

            <ConfirmDialog
                isOpen={deleteDialogOpen}
                onClose={() => setDeleteDialogOpen(false)}
                onConfirm={handleDeleteConfirm}
                title={t('currencies.deleteAlert') || 'Delete Alert'}
                message={t('currencies.deleteAlertConfirm') || 'Are you sure you want to delete this alert?'}
                confirmVariant="danger"
            />
        </>
    );
};

export default AlertList;
