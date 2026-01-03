import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Modal } from '../common';
import api from '../../services/api'; // Use generic api or transactionService
import toast from 'react-hot-toast';

const BulkImportModal = ({ isOpen, onClose, onSuccess }) => {
    const { t } = useTranslation();
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [result, setResult] = useState(null);

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
        setResult(null);
    };

    const handleUpload = async () => {
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        setUploading(true);
        try {
            const response = await api.post('/transactions/import', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            if (response.data.success) {
                setResult(response.data.data);
                toast.success('Import processed');
                if (response.data.data.failed === 0) {
                    setTimeout(() => {
                        onSuccess?.();
                        onClose();
                    }, 1500);
                }
            }
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Import failed');
        } finally {
            setUploading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={t('transactions.importCsv') || "Bulk Import Transactions"}
            size="md"
        >
            <div className="space-y-4">
                {!result ? (
                    <>
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                            <input
                                type="file"
                                accept=".csv"
                                onChange={handleFileChange}
                                className="block w-full text-sm text-gray-500
                                  file:mr-4 file:py-2 file:px-4
                                  file:rounded-full file:border-0
                                  file:text-sm file:font-semibold
                                  file:bg-blue-50 file:text-blue-700
                                  hover:file:bg-blue-100"
                            />
                            <p className="mt-2 text-xs text-gray-400">Supported columns: Date, CustomerName, CurrencyIn, AmountIn, ...</p>
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button variant="secondary" onClick={onClose} disabled={uploading}>Cancel</Button>
                            <Button onClick={handleUpload} disabled={!file || uploading} loading={uploading}>
                                Upload & Process
                            </Button>
                        </div>
                    </>
                ) : (
                    <div className="bg-white">
                        <div className="mb-4">
                            <h3 className="font-bold text-lg">Import Results</h3>
                            <div className="grid grid-cols-2 gap-4 mt-2">
                                <div className="bg-green-50 p-3 rounded">
                                    <span className="block text-green-800 font-bold text-xl">{result.imported}</span>
                                    <span className="text-green-600 text-sm">Successful</span>
                                </div>
                                <div className="bg-red-50 p-3 rounded">
                                    <span className="block text-red-800 font-bold text-xl">{result.failed}</span>
                                    <span className="text-red-600 text-sm">Failed</span>
                                </div>
                            </div>
                        </div>

                        {result.errors && result.errors.length > 0 && (
                            <div className="max-h-40 overflow-y-auto border rounded p-2 text-sm bg-gray-50">
                                <ul className="list-disc pl-4 text-red-600">
                                    {result.errors.map((err, idx) => (
                                        <li key={idx}>Row {err.row}: {err.message}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div className="mt-4 flex justify-end">
                            <Button onClick={() => { onSuccess?.(); onClose(); }}>Close</Button>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default BulkImportModal;
