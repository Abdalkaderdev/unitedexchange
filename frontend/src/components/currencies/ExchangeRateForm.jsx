import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { Modal, Input, Select, Button } from '../common';

const ExchangeRateForm = ({
  isOpen,
  onClose,
  onSubmit,
  currencies,
  loading
}) => {
  const { t } = useTranslation();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors }
  } = useForm({
    defaultValues: {
      from_currency_id: '',
      to_currency_id: '',
      buy_rate: '',
      sell_rate: ''
    }
  });

  const fromCurrencyId = watch('from_currency_id');
  const toCurrencyId = watch('to_currency_id');

  useEffect(() => {
    if (!isOpen) {
      reset({
        from_currency_id: '',
        to_currency_id: '',
        buy_rate: '',
        sell_rate: ''
      });
    }
  }, [isOpen, reset]);

  const handleFormSubmit = (data) => {
    onSubmit({
      from_currency_id: parseInt(data.from_currency_id, 10),
      to_currency_id: parseInt(data.to_currency_id, 10),
      buy_rate: parseFloat(data.buy_rate),
      sell_rate: parseFloat(data.sell_rate)
    });
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const currencyOptions = currencies
    .filter(c => c.isActive)
    .map(c => ({
      value: c.id.toString(),
      label: `${c.code} - ${c.name}`
    }));

  const fromCurrencyOptions = currencyOptions.filter(
    option => option.value !== toCurrencyId
  );

  const toCurrencyOptions = currencyOptions.filter(
    option => option.value !== fromCurrencyId
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t('currencies.setExchangeRate')}
      size="md"
    >
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
        <Select
          label={t('currencies.fromCurrency')}
          options={fromCurrencyOptions}
          placeholder={t('currencies.selectCurrency')}
          {...register('from_currency_id', {
            required: t('currencies.fromCurrencyRequired')
          })}
          error={errors.from_currency_id?.message}
        />

        <Select
          label={t('currencies.toCurrency')}
          options={toCurrencyOptions}
          placeholder={t('currencies.selectCurrency')}
          {...register('to_currency_id', {
            required: t('currencies.toCurrencyRequired'),
            validate: (value) =>
              value !== fromCurrencyId || t('currencies.differentCurrencies')
          })}
          error={errors.to_currency_id?.message}
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label={t('currencies.buyRate')}
            type="number"
            step="0.0001"
            min="0"
            {...register('buy_rate', {
              required: t('currencies.buyRateRequired'),
              min: {
                value: 0,
                message: t('currencies.ratePositive')
              },
              validate: (value) =>
                parseFloat(value) > 0 || t('currencies.ratePositive')
            })}
            error={errors.buy_rate?.message}
            placeholder="0.0000"
          />

          <Input
            label={t('currencies.sellRate')}
            type="number"
            step="0.0001"
            min="0"
            {...register('sell_rate', {
              required: t('currencies.sellRateRequired'),
              min: {
                value: 0,
                message: t('currencies.ratePositive')
              },
              validate: (value) =>
                parseFloat(value) > 0 || t('currencies.ratePositive')
            })}
            error={errors.sell_rate?.message}
            placeholder="0.0000"
          />
        </div>

        <p className="text-sm text-gray-500">
          {t('currencies.rateExplanation')}
        </p>

        <div className="flex justify-end space-x-3 pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={loading}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={loading}
          >
            {t('currencies.setRate')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default ExchangeRateForm;
