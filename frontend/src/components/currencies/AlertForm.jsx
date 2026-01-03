/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Button, Select, Input } from '../common';
import currencyService from '../../services/currencyService';

const AlertForm = ({ isOpen, onClose, onSubmit, loading, currencies }) => {
    const { t } = useTranslation();
    const [formData, setFormData] = useState({
        fromCurrencyId: '',
        toCurrencyId: '',
        condition: 'above',
        targetRate: ''
    });

    // Reset form handled by parent key prop


    const currencyOptions = currencies.map(c => ({
        value: c.id.toString(),
        label: `${c.code} - ${c.name}`
    }));

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit(formData);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={t('currencies.createAlert') || 'Create Rate Alert'}
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <Select
                        label={t('currencies.fromCurrency') || 'From Currency'}
                        options={currencyOptions}
                        value={formData.fromCurrencyId}
                        onChange={(e) => setFormData({ ...formData, fromCurrencyId: e.target.value })}
                        required
                    />
                    <Select
                        label={t('currencies.toCurrency') || 'To Currency'}
                        options={currencyOptions}
                        value={formData.toCurrencyId}
                        onChange={(e) => setFormData({ ...formData, toCurrencyId: e.target.value })}
                        required
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <Select
                        label={t('common.condition') || 'Condition'}
                        options={[
                            { value: 'above', label: t('currencies.above') || 'Above (>)' },
                            { value: 'below', label: t('currencies.below') || 'Below (<)' }
                        ]}
                        value={formData.condition}
                        onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                        required
                    />
                    <Input
                        label={t('currencies.targetRate') || 'Target Rate'}
                        type="number"
                        step="0.000001"
                        value={formData.targetRate}
                        onChange={(e) => setFormData({ ...formData, targetRate: e.target.value })}
                        required
                    />
                </div>

                <div className="flex justify-end gap-3 mt-6">
                    <Button variant="secondary" onClick={onClose} type="button">
                        {t('common.cancel')}
                    </Button>
                    <Button type="submit" loading={loading}>
                        {t('common.create')}
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

export default AlertForm;
