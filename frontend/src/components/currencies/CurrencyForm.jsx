import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { Modal, Input, Button } from '../common';

const CurrencyForm = ({ isOpen, onClose, onSubmit, currency, loading }) => {
  const { t } = useTranslation();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm({
    defaultValues: {
      code: '',
      name: '',
      symbol: ''
    }
  });

  useEffect(() => {
    if (currency) {
      reset({
        code: currency.code || '',
        name: currency.name || '',
        symbol: currency.symbol || ''
      });
    } else {
      reset({
        code: '',
        name: '',
        symbol: ''
      });
    }
  }, [currency, reset, isOpen]);

  const handleFormSubmit = (data) => {
    onSubmit({
      ...data,
      code: data.code.toUpperCase()
    });
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={currency ? t('currencies.editCurrency') : t('currencies.addCurrency')}
      size="md"
    >
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
        <Input
          label={t('currencies.code')}
          {...register('code', {
            required: t('currencies.codeRequired'),
            minLength: {
              value: 3,
              message: t('currencies.codeLength')
            },
            maxLength: {
              value: 3,
              message: t('currencies.codeLength')
            },
            pattern: {
              value: /^[A-Za-z]{3}$/,
              message: t('currencies.codePattern')
            }
          })}
          error={errors.code?.message}
          placeholder="USD"
          maxLength={3}
          disabled={!!currency}
          className="uppercase"
        />

        <Input
          label={t('currencies.name')}
          {...register('name', {
            required: t('currencies.nameRequired'),
            minLength: {
              value: 2,
              message: t('currencies.nameMinLength')
            },
            maxLength: {
              value: 100,
              message: t('currencies.nameMaxLength')
            }
          })}
          error={errors.name?.message}
          placeholder={t('currencies.namePlaceholder')}
        />

        <Input
          label={t('currencies.symbol')}
          {...register('symbol', {
            required: t('currencies.symbolRequired'),
            maxLength: {
              value: 5,
              message: t('currencies.symbolMaxLength')
            }
          })}
          error={errors.symbol?.message}
          placeholder="$"
          maxLength={5}
        />

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
            {currency ? t('common.save') : t('common.create')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default CurrencyForm;
