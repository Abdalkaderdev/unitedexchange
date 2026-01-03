import React from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';

const PortalLayout = () => {
    const navigate = useNavigate();

    const handleLogout = () => {
        // Clear customer token
        localStorage.removeItem('customerToken');
        navigate('/portal/login');
    };

    return (
        <div className="min-h-screen bg-gray-50 font-sans">
            {/* Simple Header */}
            <header className="bg-white shadow">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex items-center">
                            <Link to="/portal/dashboard" className="flex-shrink-0 flex items-center">
                                <span className="text-2xl font-bold text-blue-600">United Exchange</span>
                                <span className="ml-2 text-sm text-gray-500 border-l pl-2 border-gray-300">Customer Portal</span>
                            </Link>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-sm text-gray-600">Welcome</span>
                            <button
                                onClick={handleLogout}
                                className="text-sm text-red-600 hover:text-red-800 font-medium"
                            >
                                Sign out
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                <Outlet />
            </main>

            {/* Simple Footer */}
            <footer className="bg-white border-t border-gray-200 mt-auto">
                <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
                    <p className="text-center text-sm text-gray-500">
                        &copy; {new Date().getFullYear()} United Exchange.
                    </p>
                </div>
            </footer>
        </div>
    );
};

export default PortalLayout;
