import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { TrophyIcon, FireIcon } from '@heroicons/react/24/solid';
import { Card, Loading } from '../common';
import reportService from '../../services/reportService';

const LeaderboardWidget = () => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState('profit');
    const [data, setData] = useState({ topProfit: [], mostActive: [] });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLeaderboard = async () => {
            try {
                setLoading(true);
                const response = await reportService.getLeaderboard('month');
                if (response.data.success) {
                    setData(response.data.data);
                }
            } catch (error) {
                console.error('Failed to fetch leaderboard', error);
            } finally {
                setLoading(false);
            }
        };

        fetchLeaderboard();
    }, []);

    const List = ({ items, type }) => (
        <div className="space-y-4">
            {items.length === 0 ? (
                <p className="text-center text-gray-500 dark:text-gray-400 py-4">{t('common.noData')}</p>
            ) : (
                items.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                        <div className="flex items-center gap-3">
                            <div className={`
                 flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full font-bold text-white
                 ${index === 0 ? 'bg-yellow-400 ring-2 ring-yellow-200 dark:ring-yellow-600' :
                                    index === 1 ? 'bg-gray-400' :
                                        index === 2 ? 'bg-orange-400' : 'bg-blue-500'}
              `}>
                                {index + 1}
                            </div>
                            <div>
                                <p className="font-semibold text-gray-900 dark:text-gray-100">{item.name}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{item.subValue}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className={`font-bold ${type === 'profit' ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'}`}>
                                {type === 'profit' ? `$${item.value}` : item.value}
                            </p>
                        </div>
                    </div>
                ))
            )}
        </div>
    );

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <h3 className="font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                    <TrophyIcon className="h-5 w-5 text-yellow-500" />
                    {t('dashboard.leaderboard.title') || "Top Performers"} <span className="text-xs font-normal text-gray-400 dark:text-gray-500 ml-1">(This Month)</span>
                </h3>
            </div>

            <div className="p-2">
                <div className="flex p-1 space-x-1 bg-gray-100 dark:bg-gray-700 rounded-lg mb-4">
                    <button
                        onClick={() => setActiveTab('profit')}
                        className={`
              flex-1 flex items-center justify-center py-2 text-sm font-medium rounded-md transition-all
              ${activeTab === 'profit'
                                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}
            `}
                    >
                        {t('dashboard.leaderboard.profit') || "Top Profit"}
                    </button>
                    <button
                        onClick={() => setActiveTab('volume')}
                        className={`
              flex-1 flex items-center justify-center py-2 text-sm font-medium rounded-md transition-all
              ${activeTab === 'volume'
                                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}
            `}
                    >
                        {t('dashboard.leaderboard.volume') || "Most Active"}
                    </button>
                </div>

                {loading ? (
                    <div className="flex justify-center py-8"><Loading size="md" /></div>
                ) : (
                    <List
                        items={activeTab === 'profit' ? data.topProfit : data.mostActive}
                        type={activeTab}
                    />
                )}
            </div>
        </div>
    );
};

export default LeaderboardWidget;
