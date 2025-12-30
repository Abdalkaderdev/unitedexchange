import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="lg:pl-64 rtl:lg:pl-0 rtl:lg:pr-64 flex flex-col min-h-screen">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>

        <footer className="py-4 px-6 text-center text-sm text-gray-500 border-t border-gray-200">
          &copy; {new Date().getFullYear()} United Exchange. All rights reserved.
        </footer>
      </div>
    </div>
  );
};

export default Layout;
