import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import cashDrawerService from '../../services/cashDrawerService';
import { Button, Input, Modal, Table } from '../common';
import toast from 'react-hot-toast';
import { CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

const ClosingWizard = ({ isOpen, onClose, drawerId }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [step, setStep] = useState(1); // 1: Overview, 2: Count, 3: Verify, 4: Summary
    const [loading, setLoading] = useState(false);
    const [drawerStatus, setDrawerStatus] = useState(null);
    const [actualCounts, setActualCounts] = useState({}); // { currencyId: amount }
    const [notes, setNotes] = useState('');
    const [result, setResult] = useState(null);

    useEffect(() => {
        if (isOpen && drawerId) {
            fetchDrawerStatus();
            setStep(1);
            setActualCounts({});
            setNotes('');
            setResult(null);
        }
    }, [isOpen, drawerId]);

    const fetchDrawerStatus = async () => {
        setLoading(true);
        try {
            const response = await cashDrawerService.getStatus(drawerId);
            if (response.success) {
                setDrawerStatus(response.data);
            }
        } catch (error) {
            console.error('Failed to fetch drawer status:', error);
            toast.error(t('common.error'));
        } finally {
            setLoading(false);
        }
    };

    const handleCountChange = (currencyId, value) => {
        setActualCounts(prev => ({
            ...prev,
            [currencyId]: value
        }));
    };

    const handleNext = () => {
        if (step === 2) {
            // Validate counts
            // Optional: Could force input for all currencies, but explicit count of 0 is fine.
        }
        setStep(prev => prev + 1);
    };

    const handleBack = () => {
        setStep(prev => prev - 1);
    };

    const handleSubmit = async () => {
        setLoading(true);
        try {
            const payload = {
                actualBalances: Object.entries(actualCounts).map(([id, amount]) => ({
                    currencyId: parseInt(id),
                    amount: parseFloat(amount || 0)
                })),
                notes
            };

            const response = await cashDrawerService.submitClosing(drawerId, payload);
            if (response.success) {
                setResult(response.data);
                setStep(4); // Go to summary
                toast.success(t('closing.success'));
            }
        } catch (error) {
            toast.error(error.response?.data?.message || t('common.error'));
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount, symbol) => {
        return `${symbol || ''} ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(amount || 0)}`;
    };

    const renderStepContent = () => {
        if (!drawerStatus) return <div>{t('common.loading')}</div>;

        switch (step) {
            case 1: // Overview
                return (
                    <div className="space-y-4">
                        <h3 className="text-lg font-medium text-gray-900">{t('closing.overview')}</h3>
                        <p className="text-sm text-gray-500">{t('closing.overviewDesc')}</p>
                        <div className="bg-gray-50 p-4 rounded-md">
                            <p><strong>{t('common.drawer')}:</strong> {drawerStatus.drawerName}</p>
                            <p><strong>{t('closing.lastClosing')}:</strong> {drawerStatus.lastClosingTime ? new Date(drawerStatus.lastClosingTime).toLocaleString() : t('common.never')}</p>
                        </div>
                        <div className="flex justify-end">
                            <Button onClick={handleNext}>{t('common.next')}</Button>
                        </div>
                    </div>
                );

            case 2: // Count
                return (
                    <div className="space-y-4">
                        <h3 className="text-lg font-medium text-gray-900">{t('closing.enterCounts')}</h3>
                        <p className="text-sm text-gray-500">{t('closing.enterCountsDesc')}</p>

                        <div className="max-h-[60vh] overflow-y-auto">
                            {drawerStatus.expectedBalances.map(currency => (
                                <div key={currency.currencyId} className="flex items-center justify-between py-3 border-b border-gray-100">
                                    <div className="flex-1">
                                        <span className="font-medium">{currency.code}</span>
                                        <span className="text-xs text-gray-500 ml-2">{currency.name}</span>
                                    </div>
                                    <div className="w-48">
                                        <Input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            placeholder="0.00"
                                            value={actualCounts[currency.currencyId] || ''}
                                            onChange={(e) => handleCountChange(currency.currencyId, e.target.value)}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-between pt-4">
                            <Button variant="secondary" onClick={handleBack}>{t('common.back')}</Button>
                            <Button onClick={handleNext}>{t('common.next')}</Button>
                        </div>
                    </div>
                );

            case 3: // Verify
                // Calculate variances for preview
                const variances = drawerStatus.expectedBalances.map(c => {
                    const actual = parseFloat(actualCounts[c.currencyId] || 0);
                    const diff = actual - c.expectedAmount;
                    return {
                        ...c,
                        actual,
                        diff
                    };
                });

                const hasVariance = variances.some(v => Math.abs(v.diff) > 0.01);

                return (
                    <div className="space-y-4">
                        <h3 className="text-lg font-medium text-gray-900">{t('closing.verify')}</h3>

                        {hasVariance && (
                            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                                <div className="flex">
                                    <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 mr-2" />
                                    <p className="text-sm text-yellow-700">{t('closing.varianceWarning')}</p>
                                </div>
                            </div>
                        )}

                        <div className="max-h-[50vh] overflow-y-auto border rounded-md">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('common.currency')}</th>
                                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">{t('closing.expected')}</th>
                                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">{t('closing.actual')}</th>
                                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">{t('closing.variance')}</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {variances.map((row) => (
                                        <tr key={row.currencyId} className={Math.abs(row.diff) > 0.01 ? 'bg-yellow-50' : ''}>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{row.code}</td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-right text-gray-500">{formatCurrency(row.expectedAmount, row.symbol)}</td>
                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-right text-gray-900">{formatCurrency(row.actual, row.symbol)}</td>
                                            <td className={`px-3 py-2 whitespace-nowrap text-sm text-right font-bold ${row.diff < 0 ? 'text-red-600' : (row.diff > 0 ? 'text-green-600' : 'text-gray-500')}`}>
                                                {formatCurrency(row.diff, row.symbol)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.notes')}</label>
                            <textarea
                                className="input-field w-full"
                                rows={3}
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder={t('closing.notesPlaceholder')}
                            />
                        </div>

                        <div className="flex justify-between pt-4">
                            <Button variant="secondary" onClick={handleBack}>{t('common.back')}</Button>
                            <Button onClick={handleSubmit} loading={loading}>{t('closing.submitClosing')}</Button>
                        </div>
                    </div>
                );

            case 4: // Summary
                return (
                    <div className="space-y-6 text-center py-8">
                        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100">
                            <CheckCircleIcon className="h-10 w-10 text-green-600" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-900">{t('closing.closedSuccessfully')}</h3>
                            <p className="text-gray-500 mt-2">{t('closing.reportSaved')}</p>
                        </div>

                        <div className="flex justify-center gap-4">
                            <Button variant="secondary" onClick={onClose}>{t('common.close')}</Button>
                            <Button onClick={() => window.print()}>{t('closing.printReport')}</Button>
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={t('closing.endOfDayClosing')}
            size="xl"
        >
            {renderStepContent()}
        </Modal>
    );
};

export default ClosingWizard;
