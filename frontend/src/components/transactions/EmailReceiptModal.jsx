import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Button, Input, Select } from '../common';
import transactionService from '../../services/transactionService';
import toast from 'react-hot-toast';

const EmailReceiptModal = ({ isOpen, onClose, transaction }) => {
  const { t, i18n } = useTranslation();
  const [email, setEmail] = useState(transaction?.customerEmail || '');
  const [lang, setLang] = useState(i18n.language || 'en');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const languageOptions = [
    { value: 'en', label: t('language.en') || 'English' },
    { value: 'ar', label: t('language.ar') || 'Arabic' },
    { value: 'ku', label: t('language.ku') || 'Kurdish' }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validate email
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(t('validation.invalidEmail') || 'Invalid email address');
      return;
    }

    setLoading(true);

    try {
      const response = await transactionService.emailReceipt(
        transaction.uuid,
        email,
        { type: 'customer', lang }
      );

      if (response.success) {
        toast.success(t('receipts.receiptSent') || 'Receipt sent successfully');
        onClose();
      } else {
        setError(response.message || t('receipts.receiptSendError'));
      }
    } catch (err) {
      console.error('Email receipt error:', err);
      setError(err.response?.data?.message || t('receipts.receiptSendError') || 'Failed to send receipt');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setEmail('');
    setError('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t('receipts.email') || 'Email Receipt'}
      size="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Transaction Info */}
        <div className="bg-gray-50 rounded-lg p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">{t('transactions.transactionNumber') || 'Transaction'}:</span>
            <span className="font-medium">{transaction?.transactionNumber}</span>
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-gray-600">{t('transactions.customerName') || 'Customer'}:</span>
            <span className="font-medium">{transaction?.customerName}</span>
          </div>
        </div>

        {/* Email Input */}
        <Input
          label={t('receipts.emailTo') || 'Email To'}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="customer@example.com"
          error={error}
          required
        />

        {/* Language Selection */}
        <Select
          label={t('receipts.language') || 'Language'}
          value={lang}
          onChange={(e) => setLang(e.target.value)}
          options={languageOptions}
        />

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={loading}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            disabled={loading}
          >
            {loading ? t('common.loading') : (t('receipts.sendReceipt') || 'Send Receipt')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default EmailReceiptModal;
