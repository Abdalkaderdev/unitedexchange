import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

const RateHistoryChart = ({ history, showBuyRate = true, showSellRate = true }) => {
  const { t } = useTranslation();

  const chartData = useMemo(() => {
    if (!history || history.length === 0) return null;

    // Reverse to show oldest first (left to right)
    const sortedHistory = [...history].reverse();

    // Get all rates for calculating min/max
    const allRates = [];
    sortedHistory.forEach(item => {
      if (showBuyRate && item.new_buy_rate) allRates.push(Number(item.new_buy_rate));
      if (showSellRate && item.new_sell_rate) allRates.push(Number(item.new_sell_rate));
    });

    if (allRates.length === 0) return null;

    const minRate = Math.min(...allRates);
    const maxRate = Math.max(...allRates);
    const range = maxRate - minRate || 1;
    const padding = range * 0.1;

    return {
      items: sortedHistory,
      minRate: minRate - padding,
      maxRate: maxRate + padding,
      range: range + (padding * 2)
    };
  }, [history, showBuyRate, showSellRate]);

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('default', {
      month: 'short',
      day: 'numeric'
    }).format(date);
  };

  const formatRate = (rate) => {
    if (rate === null || rate === undefined) return '-';
    return Number(rate).toFixed(4);
  };

  const getYPosition = (rate) => {
    if (!chartData || rate === null || rate === undefined) return 0;
    const normalizedValue = (Number(rate) - chartData.minRate) / chartData.range;
    return 100 - (normalizedValue * 100);
  };

  if (!chartData || chartData.items.length < 2) {
    return (
      <div className="p-8 text-center text-gray-500">
        {t('currencies.notEnoughData')}
      </div>
    );
  }

  const width = Math.max(chartData.items.length * 80, 400);

  return (
    <div className="w-full">
      {/* Legend */}
      <div className="flex items-center justify-center space-x-6 mb-4">
        {showBuyRate && (
          <div className="flex items-center space-x-2">
            <div className="w-4 h-1 bg-green-500 rounded"></div>
            <span className="text-sm text-gray-600">{t('currencies.buyRate')}</span>
          </div>
        )}
        {showSellRate && (
          <div className="flex items-center space-x-2">
            <div className="w-4 h-1 bg-blue-500 rounded"></div>
            <span className="text-sm text-gray-600">{t('currencies.sellRate')}</span>
          </div>
        )}
      </div>

      {/* Chart Container */}
      <div className="overflow-x-auto">
        <div className="relative" style={{ minWidth: width, height: 250 }}>
          {/* Y-axis labels */}
          <div className="absolute left-0 top-0 bottom-8 w-16 flex flex-col justify-between text-xs text-gray-500">
            <span>{formatRate(chartData.maxRate)}</span>
            <span>{formatRate((chartData.maxRate + chartData.minRate) / 2)}</span>
            <span>{formatRate(chartData.minRate)}</span>
          </div>

          {/* Chart area */}
          <div className="absolute left-16 right-0 top-0 bottom-8 border-l border-b border-gray-200">
            {/* Grid lines */}
            <div className="absolute inset-0">
              <div className="absolute w-full h-px bg-gray-100 top-0"></div>
              <div className="absolute w-full h-px bg-gray-100 top-1/2"></div>
              <div className="absolute w-full h-px bg-gray-100 bottom-0"></div>
            </div>

            {/* SVG for lines and points */}
            <svg
              className="absolute inset-0 w-full h-full"
              preserveAspectRatio="none"
              viewBox={`0 0 ${width - 64} 100`}
            >
              {/* Buy rate line */}
              {showBuyRate && (
                <polyline
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="2"
                  points={chartData.items
                    .map((item, index) => {
                      const x = (index / (chartData.items.length - 1)) * (width - 64);
                      const y = getYPosition(item.new_buy_rate);
                      return `${x},${y}`;
                    })
                    .join(' ')}
                />
              )}

              {/* Sell rate line */}
              {showSellRate && (
                <polyline
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="2"
                  points={chartData.items
                    .map((item, index) => {
                      const x = (index / (chartData.items.length - 1)) * (width - 64);
                      const y = getYPosition(item.new_sell_rate);
                      return `${x},${y}`;
                    })
                    .join(' ')}
                />
              )}

              {/* Data points */}
              {chartData.items.map((item, index) => {
                const x = (index / (chartData.items.length - 1)) * (width - 64);
                return (
                  <g key={index}>
                    {showBuyRate && item.new_buy_rate && (
                      <circle
                        cx={x}
                        cy={getYPosition(item.new_buy_rate)}
                        r="3"
                        fill="#22c55e"
                        className="hover:r-5 transition-all"
                      >
                        <title>
                          {formatDate(item.changed_at)}: {formatRate(item.new_buy_rate)}
                        </title>
                      </circle>
                    )}
                    {showSellRate && item.new_sell_rate && (
                      <circle
                        cx={x}
                        cy={getYPosition(item.new_sell_rate)}
                        r="3"
                        fill="#3b82f6"
                        className="hover:r-5 transition-all"
                      >
                        <title>
                          {formatDate(item.changed_at)}: {formatRate(item.new_sell_rate)}
                        </title>
                      </circle>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          {/* X-axis labels */}
          <div
            className="absolute left-16 right-0 bottom-0 h-8 flex justify-between text-xs text-gray-500"
          >
            {chartData.items.map((item, index) => (
              <span
                key={index}
                className="transform -rotate-45 origin-top-left whitespace-nowrap"
                style={{ width: `${100 / chartData.items.length}%` }}
              >
                {index === 0 || index === chartData.items.length - 1 || index % Math.ceil(chartData.items.length / 5) === 0
                  ? formatDate(item.changed_at)
                  : ''}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RateHistoryChart;
