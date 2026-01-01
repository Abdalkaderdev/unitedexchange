import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Modal, Input } from '../common';
import customerService from '../../services/customerService';
import toast from 'react-hot-toast';
import {
  NoSymbolIcon,
  CheckCircleIcon,
  StarIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

const BulkActionBar = ({ selectedCustomers, onClear, onSuccess }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockReason, setBlockReason] = useState('');

  const selectedCount = selectedCustomers.length;

  if (selectedCount === 0) return null;

  const handleAction = async (action, reason = null) => {
    setLoading(true);
    try {
      const uuids = selectedCustomers.map(c => c.uuid);
      const response = await customerService.bulkUpdate(uuids, action, reason);

      if (response.success) {
        const actionLabels = {
          block: t('customers.bulkBlocked') || 'blocked',
          unblock: t('customers.bulkUnblocked') || 'unblocked',
          setVip: t('customers.bulkSetVip') || 'set as VIP',
          removeVip: t('customers.bulkRemoveVip') || 'removed from VIP'
        };
        toast.success(`${response.data.updated.length} ${t('customers.customers') || 'customer(s)'} ${actionLabels[action]}`);
        onClear();
        onSuccess && onSuccess();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || t('common.error'));
    } finally {
      setLoading(false);
      setShowBlockModal(false);
      setBlockReason('');
    }
  };

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg p-4 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">
              {selectedCount} {t('customers.selected') || 'selected'}
            </span>
            <button
              onClick={onClear}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              {t('common.cancel')}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleAction('setVip')}
              disabled={loading}
            >
              <StarIcon className="h-4 w-4 mr-1 text-yellow-500" />
              {t('customers.setVip') || 'Set VIP'}
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleAction('removeVip')}
              disabled={loading}
            >
              <StarIcon className="h-4 w-4 mr-1 text-gray-400" />
              {t('customers.removeVip') || 'Remove VIP'}
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleAction('unblock')}
              disabled={loading}
            >
              <CheckCircleIcon className="h-4 w-4 mr-1 text-green-500" />
              {t('customers.unblock')}
            </Button>

            <Button
              variant="danger"
              size="sm"
              onClick={() => setShowBlockModal(true)}
              disabled={loading}
            >
              <NoSymbolIcon className="h-4 w-4 mr-1" />
              {t('customers.block')}
            </Button>
          </div>
        </div>
      </div>

      {/* Block Reason Modal */}
      <Modal
        isOpen={showBlockModal}
        onClose={() => setShowBlockModal(false)}
        title={t('customers.blockCustomers') || 'Block Customers'}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            {t('customers.bulkBlockConfirm') || `Are you sure you want to block ${selectedCount} customer(s)?`}
          </p>

          <Input
            label={t('customers.blockReason')}
            value={blockReason}
            onChange={(e) => setBlockReason(e.target.value)}
            placeholder={t('customers.enterBlockReason') || 'Enter reason for blocking...'}
          />

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowBlockModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={() => handleAction('block', blockReason)}
              disabled={loading}
            >
              {loading ? t('common.loading') : t('customers.block')}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default BulkActionBar;
