import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Button from './Button';
import Input from './Input';
import Select from './Select';
import filterPresetService from '../../services/filterPresetService';
import toast from 'react-hot-toast';
import {
  FunnelIcon,
  BookmarkIcon,
  TrashIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

const AdvancedFilters = ({
  resourceType,
  filters,
  filterConfig,
  onFilterChange,
  onApply,
  onReset,
  isOpen,
  onToggle
}) => {
  const { t } = useTranslation();
  const [presets, setPresets] = useState([]);
  const [selectedPreset, setSelectedPreset] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  useEffect(() => {
    if (resourceType) {
      fetchPresets();
    }
  }, [resourceType]);

  const fetchPresets = async () => {
    try {
      const response = await filterPresetService.getPresets(resourceType);
      if (response.success) {
        setPresets(response.data || []);
        // Apply default preset if exists
        const defaultPreset = response.data?.find(p => p.isDefault);
        if (defaultPreset && Object.values(filters).every(v => !v)) {
          applyPreset(defaultPreset);
        }
      }
    } catch (error) {
      console.error('Failed to fetch presets');
    }
  };

  const applyPreset = (preset) => {
    if (preset.filters) {
      Object.entries(preset.filters).forEach(([key, value]) => {
        onFilterChange(key, value);
      });
      setSelectedPreset(preset.uuid);
    }
  };

  const handlePresetSelect = (uuid) => {
    if (!uuid) {
      setSelectedPreset('');
      return;
    }
    const preset = presets.find(p => p.uuid === uuid);
    if (preset) {
      applyPreset(preset);
    }
  };

  const handleSavePreset = async () => {
    if (!presetName.trim()) {
      toast.error(t('common.required'));
      return;
    }

    try {
      const response = await filterPresetService.createPreset({
        name: presetName,
        resourceType,
        filters,
        isDefault
      });

      if (response.success) {
        toast.success(t('common.saved'));
        setShowSaveModal(false);
        setPresetName('');
        setIsDefault(false);
        fetchPresets();
      }
    } catch (error) {
      toast.error(t('common.error'));
    }
  };

  const handleDeletePreset = async (uuid, e) => {
    e.stopPropagation();
    if (!window.confirm(t('common.confirmDelete'))) return;

    try {
      const response = await filterPresetService.deletePreset(uuid);
      if (response.success) {
        toast.success(t('common.deleted'));
        if (selectedPreset === uuid) {
          setSelectedPreset('');
        }
        fetchPresets();
      }
    } catch (error) {
      toast.error(t('common.error'));
    }
  };

  const handleReset = () => {
    setSelectedPreset('');
    onReset();
  };

  const activeFiltersCount = Object.values(filters).filter(v => v !== '' && v !== null && v !== undefined).length;

  const renderFilterField = (config) => {
    const { key, type, label, options, placeholder } = config;
    const value = filters[key] || '';

    switch (type) {
      case 'text':
        return (
          <Input
            key={key}
            label={label}
            value={value}
            onChange={(e) => onFilterChange(key, e.target.value)}
            placeholder={placeholder}
          />
        );
      case 'select':
        return (
          <Select
            key={key}
            label={label}
            value={value}
            onChange={(e) => onFilterChange(key, e.target.value)}
            options={options}
          />
        );
      case 'date':
        return (
          <Input
            key={key}
            label={label}
            type="date"
            value={value}
            onChange={(e) => onFilterChange(key, e.target.value)}
          />
        );
      case 'number':
        return (
          <Input
            key={key}
            label={label}
            type="number"
            value={value}
            onChange={(e) => onFilterChange(key, e.target.value)}
            placeholder={placeholder}
          />
        );
      case 'dateRange':
        return (
          <div key={key} className="grid grid-cols-2 gap-2">
            <Input
              label={config.startLabel || t('reports.startDate')}
              type="date"
              value={filters[config.startKey] || ''}
              onChange={(e) => onFilterChange(config.startKey, e.target.value)}
            />
            <Input
              label={config.endLabel || t('reports.endDate')}
              type="date"
              value={filters[config.endKey] || ''}
              onChange={(e) => onFilterChange(config.endKey, e.target.value)}
            />
          </div>
        );
      case 'amountRange':
        return (
          <div key={key} className="grid grid-cols-2 gap-2">
            <Input
              label={config.minLabel || t('filters.minAmount')}
              type="number"
              value={filters[config.minKey] || ''}
              onChange={(e) => onFilterChange(config.minKey, e.target.value)}
              placeholder="0"
            />
            <Input
              label={config.maxLabel || t('filters.maxAmount')}
              type="number"
              value={filters[config.maxKey] || ''}
              onChange={(e) => onFilterChange(config.maxKey, e.target.value)}
              placeholder="0"
            />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Filter Header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          <FunnelIcon className="h-5 w-5 text-gray-500" />
          <span className="font-medium text-gray-700">{t('common.filter')}</span>
          {activeFiltersCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-primary-100 text-primary-700 rounded-full">
              {activeFiltersCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {presets.length > 0 && (
            <select
              className="text-sm border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              value={selectedPreset}
              onChange={(e) => handlePresetSelect(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            >
              <option value="">{t('filters.selectPreset') || 'Select preset...'}</option>
              {presets.map((preset) => (
                <option key={preset.uuid} value={preset.uuid}>
                  {preset.name} {preset.isDefault && '(default)'}
                </option>
              ))}
            </select>
          )}
          {isOpen ? (
            <ChevronUpIcon className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDownIcon className="h-5 w-5 text-gray-400" />
          )}
        </div>
      </div>

      {/* Filter Content */}
      {isOpen && (
        <div className="px-4 pb-4 border-t border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 pt-4">
            {filterConfig.map(renderFilterField)}
          </div>

          {/* Filter Actions */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <Button onClick={onApply}>
                <FunnelIcon className="h-4 w-4 mr-1" />
                {t('common.filter')}
              </Button>
              <Button variant="secondary" onClick={handleReset}>
                <XMarkIcon className="h-4 w-4 mr-1" />
                {t('common.reset') || 'Reset'}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => setShowSaveModal(true)}
                disabled={activeFiltersCount === 0}
              >
                <BookmarkIcon className="h-4 w-4 mr-1" />
                {t('filters.savePreset') || 'Save Preset'}
              </Button>
              {selectedPreset && (
                <Button
                  variant="danger"
                  onClick={(e) => handleDeletePreset(selectedPreset, e)}
                >
                  <TrashIcon className="h-4 w-4 mr-1" />
                  {t('common.delete')}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Save Preset Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">{t('filters.savePreset') || 'Save Filter Preset'}</h3>
            <Input
              label={t('common.name')}
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder={t('filters.presetNamePlaceholder') || 'My filter preset'}
            />
            <label className="flex items-center gap-2 mt-3">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-600">{t('filters.setAsDefault') || 'Set as default'}</span>
            </label>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="secondary" onClick={() => setShowSaveModal(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleSavePreset}>
                {t('common.save')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedFilters;
