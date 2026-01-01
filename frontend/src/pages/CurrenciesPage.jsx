import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { PlusIcon, ArrowPathIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../contexts/AuthContext';
import currencyService from '../services/currencyService';
import { Button, Card } from '../components/common';
import CurrencyList from '../components/currencies/CurrencyList';
import CurrencyForm from '../components/currencies/CurrencyForm';
import ExchangeRateList from '../components/currencies/ExchangeRateList';
import ExchangeRateForm from '../components/currencies/ExchangeRateForm';
import { BulkRateUpdateModal } from '../components/currencies';

const CurrenciesPage = () => {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();

  // Tab state
  const [activeTab, setActiveTab] = useState('currencies');

  // Currencies state
  const [currencies, setCurrencies] = useState([]);
  const [loadingCurrencies, setLoadingCurrencies] = useState(true);
  const [currencyModalOpen, setCurrencyModalOpen] = useState(false);
  const [editingCurrency, setEditingCurrency] = useState(null);
  const [savingCurrency, setSavingCurrency] = useState(false);

  // Exchange rates state
  const [exchangeRates, setExchangeRates] = useState([]);
  const [loadingRates, setLoadingRates] = useState(true);
  const [rateModalOpen, setRateModalOpen] = useState(false);
  const [savingRate, setSavingRate] = useState(false);
  const [bulkRateModalOpen, setBulkRateModalOpen] = useState(false);

  // Fetch currencies
  const fetchCurrencies = useCallback(async () => {
    try {
      setLoadingCurrencies(true);
      const data = await currencyService.getCurrencies();
      setCurrencies(data);
    } catch (error) {
      toast.error(t('currencies.fetchError'));
      console.error('Error fetching currencies:', error);
    } finally {
      setLoadingCurrencies(false);
    }
  }, [t]);

  // Fetch exchange rates
  const fetchExchangeRates = useCallback(async () => {
    try {
      setLoadingRates(true);
      const data = await currencyService.getExchangeRates();
      setExchangeRates(data);
    } catch (error) {
      toast.error(t('currencies.fetchRatesError'));
      console.error('Error fetching exchange rates:', error);
    } finally {
      setLoadingRates(false);
    }
  }, [t]);

  // Initial data fetch
  useEffect(() => {
    fetchCurrencies();
    fetchExchangeRates();
  }, [fetchCurrencies, fetchExchangeRates]);

  // Handle add currency
  const handleAddCurrency = () => {
    setEditingCurrency(null);
    setCurrencyModalOpen(true);
  };

  // Handle edit currency
  const handleEditCurrency = (currency) => {
    setEditingCurrency(currency);
    setCurrencyModalOpen(true);
  };

  // Handle toggle currency status
  const handleToggleStatus = async (currency) => {
    try {
      await currencyService.updateCurrency(currency.id, {
        is_active: !currency.is_active
      });
      toast.success(
        currency.is_active
          ? t('currencies.deactivated')
          : t('currencies.activated')
      );
      fetchCurrencies();
    } catch (error) {
      toast.error(t('currencies.updateError'));
      console.error('Error toggling currency status:', error);
    }
  };

  // Handle currency form submit
  const handleCurrencySubmit = async (data) => {
    try {
      setSavingCurrency(true);
      if (editingCurrency) {
        await currencyService.updateCurrency(editingCurrency.id, data);
        toast.success(t('currencies.updated'));
      } else {
        await currencyService.createCurrency(data);
        toast.success(t('currencies.created'));
      }
      setCurrencyModalOpen(false);
      setEditingCurrency(null);
      fetchCurrencies();
    } catch (error) {
      const errorMessage = error.response?.data?.message || t('currencies.saveError');
      toast.error(errorMessage);
      console.error('Error saving currency:', error);
    } finally {
      setSavingCurrency(false);
    }
  };

  // Handle add exchange rate
  const handleAddRate = () => {
    setRateModalOpen(true);
  };

  // Handle exchange rate form submit
  const handleRateSubmit = async (data) => {
    try {
      setSavingRate(true);
      await currencyService.setExchangeRate(data);
      toast.success(t('currencies.rateSet'));
      setRateModalOpen(false);
      fetchExchangeRates();
    } catch (error) {
      const errorMessage = error.response?.data?.message || t('currencies.setRateError');
      toast.error(errorMessage);
      console.error('Error setting exchange rate:', error);
    } finally {
      setSavingRate(false);
    }
  };

  // Tab configuration
  const tabs = [
    { id: 'currencies', label: t('currencies.currencies') },
    { id: 'rates', label: t('currencies.exchangeRates') }
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {t('currencies.title')}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {t('currencies.subtitle')}
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Currencies Tab */}
      {activeTab === 'currencies' && (
        <Card
          title={t('currencies.allCurrencies')}
          action={
            <div className="flex space-x-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={fetchCurrencies}
                disabled={loadingCurrencies}
              >
                <ArrowPathIcon className={`h-4 w-4 mr-1 ${loadingCurrencies ? 'animate-spin' : ''}`} />
                {t('common.refresh')}
              </Button>
              {isAdmin() && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleAddCurrency}
                >
                  <PlusIcon className="h-4 w-4 mr-1" />
                  {t('currencies.addCurrency')}
                </Button>
              )}
            </div>
          }
        >
          <CurrencyList
            currencies={currencies}
            loading={loadingCurrencies}
            onEdit={handleEditCurrency}
            onToggleStatus={handleToggleStatus}
            isAdmin={isAdmin()}
          />
        </Card>
      )}

      {/* Exchange Rates Tab */}
      {activeTab === 'rates' && (
        <Card
          title={t('currencies.currentRates')}
          action={
            <div className="flex space-x-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={fetchExchangeRates}
                disabled={loadingRates}
              >
                <ArrowPathIcon className={`h-4 w-4 mr-1 ${loadingRates ? 'animate-spin' : ''}`} />
                {t('common.refresh')}
              </Button>
              {isAdmin() && exchangeRates.length > 0 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setBulkRateModalOpen(true)}
                >
                  <PencilSquareIcon className="h-4 w-4 mr-1" />
                  {t('currencies.bulkEdit') || 'Bulk Edit'}
                </Button>
              )}
              {isAdmin() && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleAddRate}
                >
                  <PlusIcon className="h-4 w-4 mr-1" />
                  {t('currencies.setExchangeRate')}
                </Button>
              )}
            </div>
          }
        >
          <ExchangeRateList
            rates={exchangeRates}
            loading={loadingRates}
          />
        </Card>
      )}

      {/* Currency Form Modal */}
      <CurrencyForm
        isOpen={currencyModalOpen}
        onClose={() => {
          setCurrencyModalOpen(false);
          setEditingCurrency(null);
        }}
        onSubmit={handleCurrencySubmit}
        currency={editingCurrency}
        loading={savingCurrency}
      />

      {/* Exchange Rate Form Modal */}
      <ExchangeRateForm
        isOpen={rateModalOpen}
        onClose={() => setRateModalOpen(false)}
        onSubmit={handleRateSubmit}
        currencies={currencies}
        loading={savingRate}
      />

      {/* Bulk Rate Update Modal */}
      <BulkRateUpdateModal
        isOpen={bulkRateModalOpen}
        onClose={() => setBulkRateModalOpen(false)}
        rates={exchangeRates}
        currencies={currencies}
        onSuccess={fetchExchangeRates}
      />
    </div>
  );
};

export default CurrenciesPage;
