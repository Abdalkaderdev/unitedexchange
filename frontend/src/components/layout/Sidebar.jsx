import React from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import {
  HomeIcon,
  CurrencyDollarIcon,
  ArrowsRightLeftIcon,
  DocumentChartBarIcon,
  UsersIcon,
  ClockIcon,
  UserGroupIcon,
  BanknotesIcon,
  CalendarDaysIcon,
  WrenchScrewdriverIcon,
  ClipboardDocumentListIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';

const Sidebar = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();

  const navigation = [
    { name: t('nav.dashboard'), href: '/', icon: HomeIcon },
    { name: t('nav.transactions'), href: '/transactions', icon: ArrowsRightLeftIcon },
    { name: t('nav.currencies'), href: '/currencies', icon: CurrencyDollarIcon },
    { name: t('currencies.rateHistory'), href: '/rate-history', icon: ClockIcon },
    { name: t('nav.customers'), href: '/customers', icon: UserGroupIcon },
    { name: t('nav.cashDrawers'), href: '/cash-drawers', icon: BanknotesIcon },
    { name: t('nav.shifts'), href: '/shifts', icon: CalendarDaysIcon },
    { name: t('nav.reports'), href: '/reports', icon: DocumentChartBarIcon },
    { name: t('nav.reportBuilder'), href: '/report-builder', icon: WrenchScrewdriverIcon },
  ];

  const adminNavigation = [
    { name: t('nav.users'), href: '/users', icon: UsersIcon },
    { name: t('nav.permissions') || 'Permissions', href: '/permissions', icon: ShieldCheckIcon },
    { name: t('nav.auditLogs') || 'Audit Logs', href: '/audit-logs', icon: ClipboardDocumentListIcon },
  ];

  const NavItem = ({ item }) => (
    <NavLink
      to={item.href}
      onClick={onClose}
      className={({ isActive }) =>
        `flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${isActive
          ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
        }`
      }
    >
      <item.icon className="h-5 w-5 mr-3 rtl:mr-0 rtl:ml-3" />
      {item.name}
    </NavLink>
  );

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 rtl:left-auto rtl:right-0 z-50 h-full w-64 bg-white dark:bg-gray-800 border-r rtl:border-r-0 rtl:border-l border-gray-200 dark:border-gray-700 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${isOpen ? 'translate-x-0 rtl:-translate-x-0' : '-translate-x-full rtl:translate-x-full'
          }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-center h-16 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <h1 className="text-xl font-bold text-primary-600 dark:text-primary-400">
              {t('common.appName')}
            </h1>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto bg-white dark:bg-gray-800">
            {navigation.map((item) => (
              <NavItem key={item.href} item={item} />
            ))}

            {isAdmin() && (
              <>
                <div className="pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
                  <p className="px-4 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    Admin
                  </p>
                </div>
                {adminNavigation.map((item) => (
                  <NavItem key={item.href} item={item} />
                ))}
              </>
            )}
          </nav>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
