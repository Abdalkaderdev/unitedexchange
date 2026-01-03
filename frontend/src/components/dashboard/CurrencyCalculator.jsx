import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Loading } from '../common';
import { currencyService } from '../../services/currencyService';
import { ArrowsRightLeftIcon, CalculatorIcon } from '@heroicons/react/24/outline';

const CurrencyCalculator = () => {
  const { t } = useTranslation();
  const [currencies, setCurrencies] = useState([]);
  const [exchangeRates, setExchangeRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fromCurrency, setFromCurrency] = useState('');
  const [toCurrency, setToCurrency] = useState('');
  const [amount, setAmount] = useState('');
  const [rateType, setRateType] = useState('buy'); // 'buy' or 'sell'

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [currenciesData, ratesData] = await Promise.all([
        currencyService.getCurrencies(true), // Only active currencies
        currencyService.getExchangeRates()
      ]);
      setCurrencies(currenciesData);
      setExchangeRates(ratesData);

      // Set default selections if currencies exist
      if (currenciesData.length >= 2) {
        setFromCurrency(currenciesData[0].id.toString());
        setToCurrency(currenciesData[1].id.toString());
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Find the exchange rate for the selected currency pair
  const currentRate = useMemo(() => {
    if (!fromCurrency || !toCurrency || fromCurrency === toCurrency) {
      return null;
    }

    const rate = exchangeRates.find(
      r => r.fromCurrencyId === parseInt(fromCurrency) &&
           r.toCurrencyId === parseInt(toCurrency)
    );

    if (rate) {
      return rate;
    }

    // Try inverse rate
    const inverseRate = exchangeRates.find(
      r => r.fromCurrencyId === parseInt(toCurrency) &&
           r.toCurrencyId === parseInt(fromCurrency)
    );

    if (inverseRate) {
      return {
        ...inverseRate,
        buyRate: inverseRate.sellRate ? 1 / inverseRate.sellRate : null,
        sellRate: inverseRate.buyRate ? 1 / inverseRate.buyRate : null,
        isInverse: true
      };
    }

    return null;
  }, [fromCurrency, toCurrency, exchangeRates]);

  // Calculate the converted amount
  const convertedAmount = useMemo(() => {
    if (!amount || !currentRate) return null;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return null;

    const rate = rateType === 'buy' ? currentRate.buyRate : currentRate.sellRate;
    if (!rate) return null;

    return numAmount * parseFloat(rate);
  }, [amount, currentRate, rateType]);

  // Get currency details by ID
  const getCurrencyById = (id) => {
    return currencies.find(c => c.id === parseInt(id));
  };

  // Swap currencies
  const handleSwap = () => {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
  };

  // Format number with commas
  const formatNumber = (num) => {
    if (num === null || num === undefined) return '';
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    }).format(num);
  };

  if (loading) {
    return (
      <Card title={t('dashboard.currencyCalculator.title')}>
        <div className="flex items-center justify-center h-48">
          <Loading size="md" />
        </div>
      </Card>
    );
  }

  const fromCurrencyData = getCurrencyById(fromCurrency);
  const toCurrencyData = getCurrencyById(toCurrency);

  return (
    <Card
      title={t('dashboard.currencyCalculator.title')}
      action={
        <div className="flex items-center gap-2">
          <CalculatorIcon className="h-5 w-5 text-primary-600" />
        </div>
      }
    >
      <div className="space-y-4">
        {/* Rate Type Toggle */}
        <div className="flex rounded-lg bg-gray-100 dark:bg-gray-700 p-1">
          <button
            type="button"
            className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
              rateType === 'buy'
                ? 'bg-white dark:bg-gray-600 text-primary-600 dark:text-primary-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
            onClick={() => setRateType('buy')}
          >
            {t('dashboard.currencyCalculator.buyRate')}
          </button>
          <button
            type="button"
            className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
              rateType === 'sell'
                ? 'bg-white dark:bg-gray-600 text-primary-600 dark:text-primary-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
            onClick={() => setRateType('sell')}
          >
            {t('dashboard.currencyCalculator.sellRate')}
          </button>
        </div>

        {/* Currency Selection Row */}
        <div className="flex items-center gap-2">
          {/* From Currency */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('dashboard.currencyCalculator.from')}
            </label>
            <select
              value={fromCurrency}
              onChange={(e) => setFromCurrency(e.target.value)}
              className="input-field"
            >
              <option value="">{t('transactions.selectCurrency')}</option>
              {currencies.map((currency) => (
                <option key={currency.id} value={currency.id}>
                  {currency.code} - {currency.name}
                </option>
              ))}
            </select>
          </div>

          {/* Swap Button */}
          <div className="flex items-end pb-1">
            <button
              type="button"
              onClick={handleSwap}
              className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              title={t('dashboard.currencyCalculator.swap')}
            >
              <ArrowsRightLeftIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>

          {/* To Currency */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('dashboard.currencyCalculator.to')}
            </label>
            <select
              value={toCurrency}
              onChange={(e) => setToCurrency(e.target.value)}
              className="input-field"
            >
              <option value="">{t('transactions.selectCurrency')}</option>
              {currencies.map((currency) => (
                <option key={currency.id} value={currency.id}>
                  {currency.code} - {currency.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Amount Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('dashboard.currencyCalculator.amount')}
          </label>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={t('transactions.enterAmount')}
              className="input-field pr-16"
              min="0"
              step="any"
            />
            {fromCurrencyData && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 font-medium">
                {fromCurrencyData.code}
              </span>
            )}
          </div>
        </div>

        {/* Exchange Rate Display */}
        {currentRate && (
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                {t('dashboard.currencyCalculator.currentRate')}:
              </span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                1 {fromCurrencyData?.code} = {formatNumber(rateType === 'buy' ? currentRate.buyRate : currentRate.sellRate)} {toCurrencyData?.code}
              </span>
            </div>
          </div>
        )}

        {/* Result */}
        {convertedAmount !== null && (
          <div className="bg-primary-50 dark:bg-primary-900/30 rounded-lg p-4 border border-primary-100 dark:border-primary-800">
            <div className="text-center">
              <p className="text-sm text-primary-600 dark:text-primary-400 mb-1">
                {t('dashboard.currencyCalculator.result')}
              </p>
              <p className="text-2xl font-bold text-primary-700 dark:text-primary-300">
                {toCurrencyData?.symbol || ''} {formatNumber(convertedAmount)}
              </p>
              <p className="text-sm text-primary-600 dark:text-primary-400 mt-1">
                {toCurrencyData?.code}
              </p>
            </div>
          </div>
        )}

        {/* No Rate Available Message */}
        {fromCurrency && toCurrency && fromCurrency !== toCurrency && !currentRate && (
          <div className="bg-yellow-50 dark:bg-yellow-900/30 rounded-lg p-3 border border-yellow-100 dark:border-yellow-800">
            <p className="text-sm text-yellow-700 dark:text-yellow-400 text-center">
              {t('dashboard.currencyCalculator.noRateAvailable')}
            </p>
          </div>
        )}

        {/* Same Currency Warning */}
        {fromCurrency && toCurrency && fromCurrency === toCurrency && (
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
              {t('dashboard.currencyCalculator.sameCurrencyWarning')}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
};

export default CurrencyCalculator;
