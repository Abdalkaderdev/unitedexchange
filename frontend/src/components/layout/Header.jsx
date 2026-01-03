import React, { Fragment, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Menu, Transition } from '@headlessui/react';
import { useAuth } from '../../contexts/AuthContext';
import {
  Bars3Icon,
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
  LanguageIcon,
  SunIcon,
  MoonIcon
} from '@heroicons/react/24/outline';
import { useTheme } from '../../contexts/ThemeContext';

import ClosingWizard from '../operations/ClosingWizard';

const languages = [
  { code: 'en', name: 'English', dir: 'ltr' },
  { code: 'ar', name: 'العربية', dir: 'rtl' },
  { code: 'ku', name: 'کوردی', dir: 'rtl' }
];

const Header = ({ onMenuClick }) => {
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [closingWizardOpen, setClosingWizardOpen] = useState(false);

  const changeLanguage = (langCode) => {
    i18n.changeLanguage(langCode);
    const lang = languages.find(l => l.code === langCode);
    document.documentElement.dir = lang?.dir || 'ltr';
    document.documentElement.lang = langCode;
  };

  const handleLogout = async () => {
    if (loggingOut) return;

    setLoggingOut(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Logout error:', error);
      // Even if logout API fails, still navigate to login
      navigate('/login', { replace: true });
    } finally {
      setLoggingOut(false);
    }
  };

  const currentLanguage = languages.find(l => l.code === i18n.language) || languages[0];

  return (
    <header className="sticky top-0 z-30 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 transition-colors">
      <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
        {/* Menu button */}
        <button
          onClick={onMenuClick}
          className="p-2 text-gray-500 dark:text-gray-400 rounded-lg lg:hidden hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <Bars3Icon className="h-6 w-6" />
        </button>

        {/* Spacer for desktop */}
        <div className="hidden lg:block">
          {/* Ops Actions */}
          <button
            onClick={() => setClosingWizardOpen(true)}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            {t('closing.closeDay')}
          </button>
        </div>

        {/* Right side */}
        <div className="flex items-center space-x-4 rtl:space-x-reverse">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 text-gray-500 rounded-lg hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
            title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          >
            {theme === 'light' ? (
              <MoonIcon className="h-5 w-5" />
            ) : (
              <SunIcon className="h-5 w-5" />
            )}
          </button>

          {/* Language Switcher */}
          <Menu as="div" className="relative">
            <Menu.Button className="flex items-center p-2 text-gray-500 rounded-lg hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700">
              <LanguageIcon className="h-5 w-5 mr-1 rtl:mr-0 rtl:ml-1" />
              <span className="text-sm font-medium">{currentLanguage.code.toUpperCase()}</span>
            </Menu.Button>
            <Transition
              as={Fragment}
              enter="transition ease-out duration-100"
              enterFrom="transform opacity-0 scale-95"
              enterTo="transform opacity-100 scale-100"
              leave="transition ease-in duration-75"
              leaveFrom="transform opacity-100 scale-100"
              leaveTo="transform opacity-0 scale-95"
            >
              <Menu.Items className="absolute right-0 rtl:right-auto rtl:left-0 mt-2 w-48 origin-top-right bg-white dark:bg-gray-800 rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 dark:ring-gray-700 focus:outline-none">
                <div className="py-1">
                  {languages.map((lang) => (
                    <Menu.Item key={lang.code}>
                      {({ active }) => (
                        <button
                          onClick={() => changeLanguage(lang.code)}
                          className={`${active ? 'bg-gray-100 dark:bg-gray-700' : ''
                            } ${i18n.language === lang.code ? 'text-primary-600 dark:text-primary-400 font-medium' : 'text-gray-700 dark:text-gray-300'
                            } block w-full text-left rtl:text-right px-4 py-2 text-sm`}
                        >
                          {lang.name}
                        </button>
                      )}
                    </Menu.Item>
                  ))}
                </div>
              </Menu.Items>
            </Transition>
          </Menu>

          {/* User Menu */}
          <Menu as="div" className="relative">
            <Menu.Button className="flex items-center p-2 text-gray-500 dark:text-gray-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
              <UserCircleIcon className="h-6 w-6" />
              <span className="ml-2 rtl:ml-0 rtl:mr-2 text-sm font-medium text-gray-700 dark:text-gray-300 hidden sm:block">
                {user?.fullName}
              </span>
            </Menu.Button>
            <Transition
              as={Fragment}
              enter="transition ease-out duration-100"
              enterFrom="transform opacity-0 scale-95"
              enterTo="transform opacity-100 scale-100"
              leave="transition ease-in duration-75"
              leaveFrom="transform opacity-100 scale-100"
              leaveTo="transform opacity-0 scale-95"
            >
              <Menu.Items className="absolute right-0 rtl:right-auto rtl:left-0 mt-2 w-48 origin-top-right bg-white dark:bg-gray-800 rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 dark:ring-gray-700 focus:outline-none">
                <div className="py-1">
                  <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{user?.fullName}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{user?.email}</p>
                    <p className="text-xs text-primary-600 dark:text-primary-400 capitalize">{user?.role}</p>
                  </div>
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        onClick={handleLogout}
                        disabled={loggingOut}
                        className={`${active ? 'bg-gray-100 dark:bg-gray-700' : ''
                          } flex items-center w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 ${loggingOut ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                      >
                        <ArrowRightOnRectangleIcon className="h-5 w-5 mr-2 rtl:mr-0 rtl:ml-2" />
                        {loggingOut ? t('common.loading') : t('auth.logout')}
                      </button>
                    )}
                  </Menu.Item>
                </div>
              </Menu.Items>
            </Transition>
          </Menu>
        </div>
      </div>

      {/* Closing Wizard Modal */}
      <ClosingWizard
        isOpen={closingWizardOpen}
        onClose={() => setClosingWizardOpen(false)}
        drawerId={2} // HARDCODED for now to Main Drawer (ID 2 usually) or we need context
      />
    </header>
  );
};

export default Header;
