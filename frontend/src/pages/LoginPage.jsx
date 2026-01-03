import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Button, Input } from '../components/common';
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const LoginPage = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm();

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const result = await login(data.username, data.password);
      if (result.success) {
        toast.success(t('common.success'));
        navigate('/');
      } else {
        toast.error(result.message || t('auth.invalidCredentials'));
      }
    } catch (error) {
      toast.error(error.response?.data?.message || t('auth.invalidCredentials'));
    } finally {
      setLoading(false);
    }
  };

  const languages = [
    { code: 'en', name: 'EN' },
    { code: 'ar', name: 'AR' },
    { code: 'ku', name: 'KU' }
  ];

  const changeLanguage = (code) => {
    i18n.changeLanguage(code);
    document.documentElement.dir = code === 'en' ? 'ltr' : 'rtl';
    document.documentElement.lang = code;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-600 to-primary-900 dark:from-gray-800 dark:to-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      {/* Language & Theme Switcher */}
      <div className="absolute top-4 right-4 rtl:right-auto rtl:left-4 flex items-center space-x-2 rtl:space-x-reverse">
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg bg-white/20 text-white hover:bg-white/30 transition-colors"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? (
            <SunIcon className="h-5 w-5" />
          ) : (
            <MoonIcon className="h-5 w-5" />
          )}
        </button>
        {languages.map((lang) => (
          <button
            key={lang.code}
            onClick={() => changeLanguage(lang.code)}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              i18n.language === lang.code
                ? 'bg-white text-primary-600 dark:bg-gray-700 dark:text-white'
                : 'bg-white/20 text-white hover:bg-white/30'
            }`}
          >
            {lang.name}
          </button>
        ))}
      </div>

      <div className="max-w-md w-full">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl dark:shadow-gray-900/50 p-8">
          {/* Logo/Title */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-primary-600 dark:text-primary-400 mb-2">
              {t('common.appName')}
            </h1>
            <p className="text-gray-500 dark:text-gray-400">{t('auth.loginSubtitle')}</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <Input
              label={t('auth.username')}
              type="text"
              autoComplete="username"
              {...register('username', {
                required: t('validation.required')
              })}
              error={errors.username?.message}
            />

            <Input
              label={t('auth.password')}
              type="password"
              autoComplete="current-password"
              {...register('password', {
                required: t('validation.required')
              })}
              error={errors.password?.message}
            />

            <Button
              type="submit"
              loading={loading}
              className="w-full"
            >
              {t('auth.login')}
            </Button>
          </form>

          {/* Demo Credentials */}
          <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center mb-2">Demo Credentials</p>
            <div className="text-xs text-gray-600 dark:text-gray-300 space-y-1">
              <p><strong>Admin:</strong> admin / admin123</p>
              <p><strong>Employee:</strong> employee / employee123</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
