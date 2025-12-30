import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import DailyReport from '../components/reports/DailyReport';
import MonthlyReport from '../components/reports/MonthlyReport';
import DailyClosingReport from '../components/reports/DailyClosingReport';
import ProfitLossReport from '../components/reports/ProfitLossReport';

const ReportsPage = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('daily');

  const tabs = [
    { id: 'daily', label: t('reports.dailyReport') },
    { id: 'monthly', label: t('reports.monthlyReport') },
    { id: 'profitLoss', label: t('reports.profitLoss') },
    { id: 'closing', label: t('reports.dailyClosing') }
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('reports.title')}</h1>
        <p className="mt-1 text-sm text-gray-500">{t('reports.subtitle')}</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
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
      <div>
        {activeTab === 'daily' && <DailyReport />}
        {activeTab === 'monthly' && <MonthlyReport />}
        {activeTab === 'profitLoss' && <ProfitLossReport />}
        {activeTab === 'closing' && <DailyClosingReport />}
      </div>
    </div>
  );
};

export default ReportsPage;
