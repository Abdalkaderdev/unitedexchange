import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { PrinterIcon, EnvelopeIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import transactionService from '../../services/transactionService';
import toast from 'react-hot-toast';
import EmailReceiptModal from './EmailReceiptModal';

const ReceiptActions = ({ transaction, size = 'sm', showLabels = false }) => {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(null);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const printFrameRef = useRef(null);

  // Extract base language code (e.g., 'en-US' -> 'en')
  const baseLang = (i18n.language || 'en').split('-')[0];
  // Only allow supported languages, fallback to 'en'
  const currentLang = ['en', 'ar', 'ku'].includes(baseLang) ? baseLang : 'en';

  const handlePrint = async () => {
    if (loading) return;
    setLoading('print');

    try {
      // Get receipt PDF
      const blob = await transactionService.getReceipt(transaction.uuid, {
        type: 'customer',
        lang: currentLang
      });

      // Create URL and open print dialog
      const url = URL.createObjectURL(blob);

      // Create hidden iframe for printing
      if (printFrameRef.current) {
        document.body.removeChild(printFrameRef.current);
      }

      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = url;
      printFrameRef.current = iframe;
      document.body.appendChild(iframe);

      iframe.onload = () => {
        iframe.contentWindow.print();
        URL.revokeObjectURL(url);
      };

      // Log the print action
      await transactionService.logReceiptAction(transaction.uuid, 'print', {
        type: 'customer',
        lang: currentLang
      });

    } catch (error) {
      console.error('Print error:', error);
      toast.error(t('receipts.printError') || 'Failed to print receipt');
    } finally {
      setLoading(null);
    }
  };

  const handleDownload = async () => {
    if (loading) return;
    setLoading('download');

    try {
      const blob = await transactionService.getReceipt(transaction.uuid, {
        type: 'customer',
        download: true,
        lang: currentLang
      });

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `receipt-${transaction.transactionNumber || transaction.uuid}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Log the download action
      await transactionService.logReceiptAction(transaction.uuid, 'download', {
        type: 'customer',
        lang: currentLang
      });

      toast.success(t('receipts.downloadSuccess') || 'Receipt downloaded');
    } catch (error) {
      console.error('Download error:', error);
      toast.error(t('receipts.downloadError') || 'Failed to download receipt');
    } finally {
      setLoading(null);
    }
  };

  const iconSize = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  const buttonPadding = size === 'sm' ? 'p-1' : 'p-1.5';

  // Don't show actions for cancelled transactions
  if (transaction.status === 'cancelled') {
    return null;
  }

  return (
    <>
      <div className="flex items-center gap-1">
        {/* Print Button */}
        <button
          onClick={handlePrint}
          disabled={loading === 'print'}
          className={`${buttonPadding} text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50`}
          title={t('receipts.print') || 'Print'}
        >
          <PrinterIcon className={`${iconSize} ${loading === 'print' ? 'animate-pulse' : ''}`} />
          {showLabels && <span className="ml-1 text-sm">{t('receipts.print')}</span>}
        </button>

        {/* Download Button */}
        <button
          onClick={handleDownload}
          disabled={loading === 'download'}
          className={`${buttonPadding} text-gray-600 hover:text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-50`}
          title={t('receipts.download') || 'Download'}
        >
          <ArrowDownTrayIcon className={`${iconSize} ${loading === 'download' ? 'animate-pulse' : ''}`} />
          {showLabels && <span className="ml-1 text-sm">{t('receipts.download')}</span>}
        </button>

        {/* Email Button */}
        <button
          onClick={() => setEmailModalOpen(true)}
          disabled={loading === 'email'}
          className={`${buttonPadding} text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors disabled:opacity-50`}
          title={t('receipts.email') || 'Email'}
        >
          <EnvelopeIcon className={`${iconSize} ${loading === 'email' ? 'animate-pulse' : ''}`} />
          {showLabels && <span className="ml-1 text-sm">{t('receipts.email')}</span>}
        </button>
      </div>

      {/* Email Modal */}
      <EmailReceiptModal
        isOpen={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        transaction={transaction}
      />
    </>
  );
};

export default ReceiptActions;
