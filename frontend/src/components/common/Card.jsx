import React from 'react';

const Card = ({ children, className = '', title, action }) => {
  return (
    <div className={`card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-4">
          {title && (
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
          )}
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
};

export const StatCard = ({ title, value, icon: Icon, trend, className = '' }) => {
  return (
    <div className={`card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
          {trend && (
            <p className={`text-sm mt-1 ${trend > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {trend > 0 ? '+' : ''}{trend}%
            </p>
          )}
        </div>
        {Icon && (
          <div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
            <Icon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
          </div>
        )}
      </div>
    </div>
  );
};

export default Card;
