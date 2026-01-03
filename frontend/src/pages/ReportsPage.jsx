import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PlusIcon } from '@heroicons/react/24/outline';
import DailyReport from '../components/reports/DailyReport';
import MonthlyReport from '../components/reports/MonthlyReport';
import DailyClosingReport from '../components/reports/DailyClosingReport';
import ProfitLossReport from '../components/reports/ProfitLossReport';
import ScheduledReportList from '../components/reports/ScheduledReportList';
import ScheduledReportForm from '../components/reports/ScheduledReportForm';
import { Button } from '../components/common';
import { useAuth } from '../contexts/AuthContext';

const ReportsPage = () => {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('daily');
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [scheduleRefreshKey, setScheduleRefreshKey] = useState(0);

  const tabs = [
    { id: 'daily', label: t('reports.dailyReport') },
    { id: 'monthly', label: t('reports.monthlyReport') },
    { id: 'profitLoss', label: t('reports.profitLoss') },
    { id: 'closing', label: t('reports.dailyClosing') }
  ];

  if (isAdmin()) {
    tabs.push({ id: 'scheduled', label: t('reports.scheduledReports') || 'Scheduled Reports' });
  }

  const handleCreateSchedule = () => {
    setEditingSchedule(null);
    setIsScheduleModalOpen(true);
  };

  const handleEditSchedule = (schedule) => {
    setEditingSchedule(schedule);
    setIsScheduleModalOpen(true);
  }

  const handleScheduleSaved = () => {
    setScheduleRefreshKey(prev => prev + 1);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('reports.title')}</h1>
          <p className="mt-1 text-sm text-gray-500">{t('reports.subtitle')}</p>
        </div>
        {activeTab === 'scheduled' && (
          <Button onClick={handleCreateSchedule}>
            <PlusIcon className="h-5 w-5 mr-2" />
            {t('reports.newSchedule') || 'New Schedule'}
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
                ${activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === 'daily' && <DailyReport />}
        {activeTab === 'monthly' && <MonthlyReport />}
        {activeTab === 'profitLoss' && <ProfitLossReport />}
        {activeTab === 'closing' && <DailyClosingReport />}
        {activeTab === 'scheduled' && (
          <ScheduledReportList
            key={scheduleRefreshKey}
            onEdit={handleEditSchedule}
          />
        )}
      </div>

      {/* Scheduled Report Modal */}
      <ScheduledReportForm
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        onSuccess={handleScheduleSaved}
        initialData={editingSchedule}
      />
    </div>
  );
};

export default ReportsPage;

