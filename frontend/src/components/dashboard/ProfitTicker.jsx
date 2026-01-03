import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import { useTranslation } from 'react-i18next';
import { ArrowTrendingUpIcon } from '@heroicons/react/24/solid';

// Use relative URL in production, localhost in development
const socketUrl = process.env.NODE_ENV === 'production'
    ? window.location.origin
    : 'http://localhost:5000';

const socket = io(socketUrl, {
    withCredentials: true,
    autoConnect: true,
    path: '/socket.io'
});

const ProfitTicker = () => {
    const { t } = useTranslation();
    const [dailyProfit, setDailyProfit] = useState(0);
    const [lastTxId, setLastTxId] = useState(null);
    const [animate, setAnimate] = useState(false);

    useEffect(() => {
        // Initial fetch of daily profit could be done via API here if needed
        // For now, we wait for updates or could fetch from a reports endpoint

        socket.on('connect', () => {
            console.log('Connected to ticker');
        });

        socket.on('profit_update', (data) => {
            setDailyProfit(data.dailyProfit);
            setLastTxId(data.newTransaction?.uuid);
            setAnimate(true);
            setTimeout(() => setAnimate(false), 2000);
        });

        return () => {
            socket.off('profit_update');
            socket.off('connect');
        };
    }, []);

    return (
        <div className={`
       transition-all duration-500 ease-in-out transform
       bg-white dark:bg-gray-800 shadow dark:shadow-gray-900/30 rounded-lg p-4 flex items-center justify-between
       ${animate ? 'ring-2 ring-green-400 dark:ring-green-500 bg-green-50 dark:bg-green-900/20' : 'ring-0'}
    `}>
            <div className="flex items-center">
                <div className="bg-green-100 dark:bg-green-900/50 p-2 rounded-full mr-3">
                    <ArrowTrendingUpIcon className={`h-6 w-6 text-green-600 dark:text-green-400 ${animate ? 'animate-bounce' : ''}`} />
                </div>
                <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider">{t('dashboard.dailyProfit') || "Daily Profit"}</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(dailyProfit)}
                    </p>
                </div>
            </div>
            {animate && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300 animate-pulse">
                    Live Update
                </span>
            )}
        </div>
    );
};

export default ProfitTicker;
