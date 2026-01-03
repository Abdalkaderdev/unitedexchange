import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    PencilSquareIcon,
    TrashIcon,
    PlayIcon,
    PauseIcon,
    ClockIcon,
    PlayCircleIcon
} from '@heroicons/react/24/outline';
import { Button, Table, ConfirmDialog, Badge } from '../common';
import scheduledReportService from '../../services/scheduledReportService';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

const ScheduledReportList = ({ onEdit }) => {
    const { t } = useTranslation();
    const { isAdmin } = useAuth();
    const [schedules, setSchedules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshKey, setRefreshKey] = useState(0);

    // Dialog states
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [selectedSchedule, setSelectedSchedule] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        fetchSchedules();
    }, [refreshKey]);

    const fetchSchedules = async () => {
        try {
            setLoading(true);
            const response = await scheduledReportService.getSchedules({ limit: 100 });
            if (response.success) {
                setSchedules(response.data || []);
            }
        } catch (error) {
            console.error('Failed to fetch schedules:', error);
            toast.error(t('common.error'));
        } finally {
            setLoading(false);
        }
    };

    const handleRunNow = async (schedule) => {
        try {
            toast.loading(t('reports.runningReport') || 'Running report...', { id: 'runReport' });
            const response = await scheduledReportService.runScheduleNow(schedule.uuid);
            if (response.success) {
                toast.success(t('reports.reportExecuted') || 'Report executed successfully', { id: 'runReport' });
                fetchSchedules();
            } else {
                toast.error(response.message || t('common.error'), { id: 'runReport' });
            }
        } catch (error) {
            toast.error(t('common.error'), { id: 'runReport' });
        }
    };

    const handleToggleActive = async (schedule) => {
        try {
            const updatedStatus = !schedule.isActive;
            const response = await scheduledReportService.updateSchedule(schedule.uuid, {
                isActive: updatedStatus
            });

            if (response.success) {
                toast.success(updatedStatus ? t('common.activated') : t('common.deactivated'));
                fetchSchedules();
            }
        } catch (error) {
            toast.error(t('common.error'));
        }
    };

    const handleDeleteClick = (schedule) => {
        setSelectedSchedule(schedule);
        setDeleteDialogOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!selectedSchedule) return;

        try {
            setActionLoading(true);
            const response = await scheduledReportService.deleteSchedule(selectedSchedule.uuid);
            if (response.success) {
                toast.success(t('common.deleted'));
                fetchSchedules();
            }
        } catch (error) {
            toast.error(t('common.error'));
        } finally {
            setActionLoading(false);
            setDeleteDialogOpen(false);
            setSelectedSchedule(null);
        }
    };

    const columns = [
        {
            header: t('common.name'),
            accessor: 'name',
            render: (value, row) => (
                <div>
                    <div className="font-medium text-gray-900">{value}</div>
                    <div className="text-xs text-gray-500 capitalize">{row.reportType.replace('_', ' ')}</div>
                </div>
            )
        },
        {
            header: t('reports.frequency') || 'Frequency',
            accessor: 'scheduleType',
            render: (value, row) => (
                <div className="flex items-center">
                    <ClockIcon className="h-4 w-4 mr-1 text-gray-400" />
                    <span className="capitalize">
                        {value}
                        {value === 'weekly' && row.scheduleDay !== null && (
                            ` (${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][row.scheduleDay]})`
                        )}
                        {` at ${row.scheduleTime.substring(0, 5)}`}
                    </span>
                </div>
            )
        },
        {
            header: t('reports.recipients') || 'Recipients',
            accessor: 'recipients',
            render: (value) => (
                <div className="text-sm text-gray-600">
                    {value.length} recipient{value.length !== 1 ? 's' : ''}
                </div>
            )
        },
        {
            header: t('common.status'),
            accessor: 'isActive',
            render: (value) => (
                <Badge variant={value ? 'success' : 'warning'}>
                    {value ? t('common.active') : t('common.inactive')}
                </Badge>
            )
        },
        {
            header: t('reports.lastRun') || 'Last Run',
            accessor: 'lastRunAt',
            render: (value) => (
                <span className="text-sm text-gray-500">
                    {value ? new Date(value).toLocaleString() : '-'}
                </span>
            )
        },
        {
            header: t('common.actions'),
            accessor: 'actions',
            render: (_, row) => (
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => handleRunNow(row)}
                        className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                        title={t('reports.runNow') || 'Run Now'}
                    >
                        <PlayCircleIcon className="h-5 w-5" />
                    </button>

                    <button
                        onClick={() => handleToggleActive(row)}
                        className={`p-1 rounded ${row.isActive ? 'text-amber-600 hover:text-amber-800 hover:bg-amber-50' : 'text-green-600 hover:text-green-800 hover:bg-green-50'}`}
                        title={row.isActive ? t('common.deactivate') : t('common.activate')}
                    >
                        {row.isActive ? <PauseIcon className="h-5 w-5" /> : <PlayIcon className="h-5 w-5" />}
                    </button>

                    <button
                        onClick={() => onEdit(row)}
                        className="p-1 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded"
                        title={t('common.edit')}
                    >
                        <PencilSquareIcon className="h-5 w-5" />
                    </button>

                    <button
                        onClick={() => handleDeleteClick(row)}
                        className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                        title={t('common.delete')}
                    >
                        <TrashIcon className="h-5 w-5" />
                    </button>
                </div>
            )
        }
    ];

    return (
        <div>
            <Table
                columns={columns}
                data={schedules}
                loading={loading}
                emptyMessage={t('reports.noSchedules') || 'No scheduled reports found.'}
            />

            <ConfirmDialog
                isOpen={deleteDialogOpen}
                onClose={() => setDeleteDialogOpen(false)}
                onConfirm={handleDeleteConfirm}
                title={t('reports.deleteSchedule') || 'Delete Schedule'}
                message={t('reports.confirmDeleteSchedule') || 'Are you sure you want to delete this scheduled report?'}
                confirmText={t('common.delete')}
                confirmVariant="danger"
                loading={actionLoading}
            />
        </div>
    );
};

export default ScheduledReportList;
