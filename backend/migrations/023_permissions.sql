-- Migration: Role-Based Permissions System
-- Date: 2025-01-01

-- Update users table to support new roles
ALTER TABLE users MODIFY role ENUM('admin', 'manager', 'teller', 'viewer') NOT NULL DEFAULT 'teller';

-- Create permissions table
CREATE TABLE IF NOT EXISTS permissions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255) NULL,
  category VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_permissions_category (category)
);

-- Create role_permissions table
CREATE TABLE IF NOT EXISTS role_permissions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  role ENUM('admin', 'manager', 'teller', 'viewer') NOT NULL,
  permission_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_role_permission (role, permission_id),
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

-- Seed default permissions
INSERT INTO permissions (code, name, description, category) VALUES
-- Transaction permissions
('transactions.view', 'View Transactions', 'View transaction list and details', 'transactions'),
('transactions.create', 'Create Transactions', 'Create new exchange transactions', 'transactions'),
('transactions.edit', 'Edit Transactions', 'Edit transaction details', 'transactions'),
('transactions.cancel', 'Cancel Transactions', 'Cancel existing transactions', 'transactions'),
('transactions.delete', 'Delete Transactions', 'Permanently delete transactions', 'transactions'),
('transactions.export', 'Export Transactions', 'Export transaction data', 'transactions'),

-- Customer permissions
('customers.view', 'View Customers', 'View customer list and details', 'customers'),
('customers.create', 'Create Customers', 'Add new customers', 'customers'),
('customers.edit', 'Edit Customers', 'Edit customer information', 'customers'),
('customers.delete', 'Delete Customers', 'Delete customers', 'customers'),
('customers.block', 'Block Customers', 'Block/unblock customers', 'customers'),
('customers.vip', 'Manage VIP Status', 'Set/remove VIP status', 'customers'),

-- Currency permissions
('currencies.view', 'View Currencies', 'View currencies and exchange rates', 'currencies'),
('currencies.manage', 'Manage Currencies', 'Add/edit currencies', 'currencies'),
('currencies.rates', 'Manage Exchange Rates', 'Set exchange rates', 'currencies'),

-- Reports permissions
('reports.view', 'View Reports', 'View basic reports', 'reports'),
('reports.daily', 'Daily Reports', 'Access daily reports', 'reports'),
('reports.monthly', 'Monthly Reports', 'Access monthly reports', 'reports'),
('reports.closing', 'Closing Reports', 'Generate closing reports', 'reports'),
('reports.export', 'Export Reports', 'Export report data', 'reports'),
('reports.builder', 'Report Builder', 'Use custom report builder', 'reports'),

-- Audit permissions
('audit.view', 'View Audit Logs', 'View audit trail', 'audit'),
('audit.export', 'Export Audit Logs', 'Export audit data', 'audit'),

-- Cash drawer permissions
('cash_drawer.view', 'View Cash Drawers', 'View cash drawer balances', 'cash_drawer'),
('cash_drawer.manage', 'Manage Cash Drawers', 'Create/edit cash drawers', 'cash_drawer'),
('cash_drawer.deposit', 'Deposit', 'Make deposits to drawers', 'cash_drawer'),
('cash_drawer.withdraw', 'Withdraw', 'Make withdrawals from drawers', 'cash_drawer'),
('cash_drawer.reconcile', 'Reconcile', 'Reconcile cash drawers', 'cash_drawer'),

-- Shift permissions
('shifts.view', 'View Shifts', 'View shift history', 'shifts'),
('shifts.manage', 'Manage Shifts', 'Start/end/handover shifts', 'shifts'),

-- User management permissions
('users.view', 'View Users', 'View user list', 'users'),
('users.create', 'Create Users', 'Add new users', 'users'),
('users.edit', 'Edit Users', 'Edit user information', 'users'),
('users.delete', 'Delete Users', 'Delete users', 'users'),
('users.permissions', 'Manage Permissions', 'Manage role permissions', 'users'),

-- Settings permissions
('settings.view', 'View Settings', 'View system settings', 'settings'),
('settings.manage', 'Manage Settings', 'Edit system settings', 'settings');

-- Assign default permissions to roles

-- Admin gets all permissions
INSERT INTO role_permissions (role, permission_id)
SELECT 'admin', id FROM permissions;

-- Manager gets most permissions except user management and settings
INSERT INTO role_permissions (role, permission_id)
SELECT 'manager', id FROM permissions
WHERE category NOT IN ('users', 'settings')
   OR code IN ('users.view');

-- Teller gets basic operational permissions
INSERT INTO role_permissions (role, permission_id)
SELECT 'teller', id FROM permissions
WHERE code IN (
  'transactions.view', 'transactions.create', 'transactions.edit',
  'customers.view', 'customers.create', 'customers.edit',
  'currencies.view',
  'reports.view', 'reports.daily',
  'cash_drawer.view', 'cash_drawer.deposit', 'cash_drawer.withdraw',
  'shifts.view', 'shifts.manage'
);

-- Viewer gets read-only permissions
INSERT INTO role_permissions (role, permission_id)
SELECT 'viewer', id FROM permissions
WHERE code IN (
  'transactions.view',
  'customers.view',
  'currencies.view',
  'reports.view',
  'cash_drawer.view',
  'shifts.view'
);
