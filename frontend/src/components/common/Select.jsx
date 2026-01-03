import React from 'react';

const Select = ({
  label,
  options = [],
  error,
  className = '',
  placeholder,
  ...props
}) => {
  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {label}
        </label>
      )}
      <select
        className={`input-field ${error ? 'border-red-500 dark:border-red-400 focus:ring-red-500 focus:border-red-500' : ''}`}
        {...props}
      >
        {placeholder && (
          <option value="" className="dark:bg-gray-800">{placeholder}</option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value} className="dark:bg-gray-800">
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
};

export default Select;
