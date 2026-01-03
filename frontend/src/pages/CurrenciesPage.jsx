import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { PlusIcon, ArrowPathIcon, PencilSquareIcon, BellIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../contexts/AuthContext';
import currencyService from '../services/currencyService';
import rateAlertService from '../services/rateAlertService';
import { Button, Card } from '../components/common';
import CurrencyList from '../components/currencies/CurrencyList';
import CurrencyForm from '../components/currencies/CurrencyForm';
import ExchangeRateList from '../components/currencies/ExchangeRateList';
import ExchangeRateForm from '../components/currencies/ExchangeRateForm';
import { BulkRateUpdateModal } from '../components/currencies';
import AlertList from '../components/currencies/AlertList';
import AlertForm from '../components/currencies/AlertForm';

const CurrenciesPage = () => {
  const { t } = useTranslation();
  const { isAdmin } = useAuth(); // Assume all users can set alerts, or check if restricted

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

  // Rate Alerts state
  const [alerts, setAlerts] = useState([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [alertModalOpen, setAlertModalOpen] = useState(false);
  const [savingAlert, setSavingAlert] = useState(false);

  // Fetch currencies
  const fetchCurrencies = useCallback(async () => {
    try {
      setLoadingCurrencies(true);
      const response = await currencyService.getCurrencies();
      setCurrencies(response.success ? response.data : []);
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
      const response = await currencyService.getExchangeRates();
      setExchangeRates(response.success ? response.data : []);
    } catch (error) {
      toast.error(t('currencies.fetchRatesError'));
      console.error('Error fetching exchange rates:', error);
    } finally {
      setLoadingRates(false);
    }
  }, [t]);

  // Fetch alerts
  const fetchAlerts = useCallback(async () => {
    try {
      setLoadingAlerts(true);
      const data = await rateAlertService.getAlerts();
      setAlerts(data || []);
    } catch (error) {
      toast.error(t('currencies.fetchAlertsError') || 'Failed to fetch alerts');
      console.error('Error fetching alerts:', error);
    } finally {
      setLoadingAlerts(false);
    }
  }, [t]);

  // Initial data fetch
  useEffect(() => {
    fetchCurrencies();
    fetchExchangeRates();
    if (activeTab === 'alerts') {
      fetchAlerts();
    }
  }, [fetchCurrencies, fetchExchangeRates, activeTab, fetchAlerts]);

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
        isActive: !currency.isActive
      });
      toast.success(
        currency.isActive
          ? t('currencies.deactivateSuccess')
          : t('currencies.activateSuccess')
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

  // Handle alert submit
  const handleAlertSubmit = async (data) => {
    try {
      setSavingAlert(true);
      await rateAlertService.createAlert(data);
      toast.success(t('currencies.alertCreated') || 'Alert created successfully');
      setAlertModalOpen(false);
      fetchAlerts();
    } catch (error) {
      toast.error(error.response?.data?.message || t('common.error'));
      console.error('Error creating alert:', error);
    } finally {
      setSavingAlert(false);
    }
  };

  // Handle alert delete
  const handleAlertDelete = async (uuid) => {
    try {
      await rateAlertService.deleteAlert(uuid);
      toast.success(t('currencies.alertDeleted') || 'Alert deleted');
      fetchAlerts();
    } catch (error) {
      toast.error(t('common.error'));
      console.error('Error deleting alert:', error);
    }
  };

  // Tab configuration
  const tabs = [
    { id: 'currencies', label: t('currencies.currencies') },
    { id: 'rates', label: t('currencies.exchangeRates') },
    { id: 'alerts', label: t('currencies.rateAlerts') || 'Rate Alerts' }
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
              className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === tab.id
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

      {/* Rate Alerts Tab */}
      {activeTab === 'alerts' && (
        <Card
          title={t('currencies.yourAlerts') || 'Your Alerts'}
          action={
            <div className="flex space-x-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={fetchAlerts}
                disabled={loadingAlerts}
              >
                <ArrowPathIcon className={`h-4 w-4 mr-1 ${loadingAlerts ? 'animate-spin' : ''}`} />
                {t('common.refresh')}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setAlertModalOpen(true)}
              >
                <BellIcon className="h-4 w-4 mr-1" />
                {t('common.create') || 'Create Alert'}
              </Button>
            </div>
          }
        >
          <AlertList
            alerts={alerts}
            loading={loadingAlerts}
            onDelete={handleAlertDelete}
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

      {/* Alert Form Modal */}
      <AlertForm
        key={alertModalOpen ? 'open' : 'closed'}
        isOpen={alertModalOpen}
        onClose={() => setAlertModalOpen(false)}
        onSubmit={handleAlertSubmit}
        currencies={currencies}
        loading={savingAlert}
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
