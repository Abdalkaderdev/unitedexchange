import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { XMarkIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { Button, Input, Select } from '../common';
import scheduledReportService from '../../services/scheduledReportService';
import toast from 'react-hot-toast';

const ScheduledReportForm = ({ isOpen, onClose, onSuccess, initialData }) => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        reportType: 'daily',
        scheduleType: 'daily',
        scheduleDay: 1, // Monday
        scheduleTime: '08:00',
        recipients: [''],
        exportFormat: 'xlsx',
        isActive: true
    });

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setFormData({
                    ...initialData,
                    scheduleTime: initialData.scheduleTime ? initialData.scheduleTime.substring(0, 5) : '08:00'
                });
            } else {
                // Reset form
                setFormData({
                    name: '',
                    reportType: 'daily',
                    scheduleType: 'daily',
                    scheduleDay: 1,
                    scheduleTime: '08:00',
                    recipients: [''],
                    exportFormat: 'xlsx',
                    isActive: true
                });
            }
        }
    }, [isOpen, initialData]);

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleRecipientChange = (index, value) => {
        const newRecipients = [...formData.recipients];
        newRecipients[index] = value;
        setFormData(prev => ({ ...prev, recipients: newRecipients }));
    };

    const addRecipient = () => {
        setFormData(prev => ({ ...prev, recipients: [...prev.recipients, ''] }));
    };

    const removeRecipient = (index) => {
        if (formData.recipients.length === 1) return;
        const newRecipients = formData.recipients.filter((_, i) => i !== index);
        setFormData(prev => ({ ...prev, recipients: newRecipients }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validation
        if (!formData.name.trim()) {
            toast.error(t('common.required'));
            return;
        }

        const validRecipients = formData.recipients.filter(email => email.trim() !== '');
        if (validRecipients.length === 0) {
            toast.error(t('reports.recipientRequired') || 'At least one recipient is required');
            return;
        }

        setLoading(true);
        try {
            const payload = {
                ...formData,
                recipients: validRecipients,
                scheduleDay: parseInt(formData.scheduleDay)
            };

            if (initialData) {
                await scheduledReportService.updateSchedule(initialData.uuid, payload);
                toast.success(t('common.saved'));
            } else {
                await scheduledReportService.createSchedule(payload);
                toast.success(t('common.created'));
            }
            onSuccess();
            onClose();
        } catch (error) {
            console.error(error);
            toast.error(t('common.error'));
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const reportTypeOptions = [
        { value: 'daily', label: t('reports.dailyReport') },
        { value: 'monthly', label: t('reports.monthlyReport') },
        { value: 'profit_loss', label: t('reports.profitLoss') },
        { value: 'transactions', label: t('reports.transactions') }
    ];

    const scheduleTypeOptions = [
        { value: 'daily', label: t('reports.daily') || 'Daily' },
        { value: 'weekly', label: t('reports.weekly') || 'Weekly' }
    ];

    const dayOptions = [
        { value: 0, label: t('days.sunday') || 'Sunday' },
        { value: 1, label: t('days.monday') || 'Monday' },
        { value: 2, label: t('days.tuesday') || 'Tuesday' },
        { value: 3, label: t('days.wednesday') || 'Wednesday' },
        { value: 4, label: t('days.thursday') || 'Thursday' },
        { value: 5, label: t('days.friday') || 'Friday' },
        { value: 6, label: t('days.saturday') || 'Saturday' }
    ];

    const formatOptions = [
        { value: 'xlsx', label: 'Excel (XLSX)' },
        { value: 'csv', label: 'CSV' },
        { value: 'pdf', label: 'PDF' }
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">
                        {initialData ? (t('reports.editSchedule') || 'Edit Schedule') : (t('reports.newSchedule') || 'New Schedule')}
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-500"
                    >
                        <XMarkIcon className="h-6 w-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <Input
                        label={t('common.name')}
                        value={formData.name}
                        onChange={(e) => handleChange('name', e.target.value)}
                        required
                        placeholder="e.g. Daily Transaction Summary"
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <Select
                            label={t('reports.reportType') || 'Report Type'}
                            options={reportTypeOptions}
                            value={formData.reportType}
                            onChange={(e) => handleChange('reportType', e.target.value)}
                        />
                        <Select
                            label={t('reports.format') || 'Format'}
                            options={formatOptions}
                            value={formData.exportFormat}
                            onChange={(e) => handleChange('exportFormat', e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Select
                            label={t('reports.frequency') || 'Frequency'}
                            options={scheduleTypeOptions}
                            value={formData.scheduleType}
                            onChange={(e) => handleChange('scheduleType', e.target.value)}
                        />
                        <Input
                            label={t('reports.time') || 'Time'}
                            type="time"
                            value={formData.scheduleTime}
                            onChange={(e) => handleChange('scheduleTime', e.target.value)}
                            required
                        />
                    </div>

                    {formData.scheduleType === 'weekly' && (
                        <Select
                            label={t('reports.dayOfWeek') || 'Day of Week'}
                            options={dayOptions}
                            value={formData.scheduleDay}
                            onChange={(e) => handleChange('scheduleDay', e.target.value)}
                        />
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t('reports.recipients') || 'Recipients'}
                        </label>
                        <div className="space-y-2">
                            {formData.recipients.map((email, index) => (
                                <div key={index} className="flex items-center gap-2">
                                    <input
                                        type="email"
                                        className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                                        value={email}
                                        onChange={(e) => handleRecipientChange(index, e.target.value)}
                                        placeholder="email@example.com"
                                        required
                                    />
                                    {formData.recipients.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => removeRecipient(index)}
                                            className="text-red-500 hover:text-red-700"
                                        >
                                            <TrashIcon className="h-5 w-5" />
                                        </button>
                                    )}
                                </div>
                            ))}
                            <button
                                type="button"
                                onClick={addRecipient}
                                className="flex items-center text-sm text-primary-600 hover:text-primary-800"
                            >
                                <PlusIcon className="h-4 w-4 mr-1" />
                                {t('reports.addRecipient') || 'Add Recipient'}
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center pt-2">
                        <input
                            id="isActive"
                            type="checkbox"
                            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                            checked={formData.isActive}
                            onChange={(e) => handleChange('isActive', e.target.checked)}
                        />
                        <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">
                            {t('common.active')}
                        </label>
                    </div>

                    <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={onClose}
                            disabled={loading}
                        >
                            {t('common.cancel')}
                        </Button>
                        <Button
                            type="submit"
                            disabled={loading}
                        >
                            {loading ? (t('common.saving') || 'Saving...') : (t('common.save'))}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ScheduledReportForm;
