import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { format } from 'date-fns';

const PortalDashboardPage = () => {
    const [transactions, setTransactions] = useState([]);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    const token = localStorage.getItem('customerToken');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const config = {
                    headers: { Authorization: `Bearer ${token}` }
                };

                // Fetch Profile
                const profileRes = await axios.get('/api/portal/profile', config);
                setProfile(profileRes.data.data);

                // Fetch Transactions
                const txRes = await axios.get('/api/portal/transactions', config);
                setTransactions(txRes.data.data); // Assuming pagination structure, data.data might need adjustment based on controller response
            } catch (error) {
                console.error("Failed to fetch portal data", error);
            } finally {
                setLoading(false);
            }
        };

        if (token) fetchData();
    }, [token]);

    if (loading) return <div className="p-8 text-center">Loading dashboard...</div>;

    return (
        <div className="space-y-6">
            {/* Stats Card */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">Account Overview</h3>
                    <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-3">
                        <div className="px-4 py-5 bg-gray-50 shadow rounded-lg overflow-hidden sm:p-6">
                            <dt className="text-sm font-medium text-gray-500 truncate">Total Transactions</dt>
                            <dd className="mt-1 text-3xl font-semibold text-gray-900">{profile?.total_transactions || 0}</dd>
                        </div>
                        <div className="px-4 py-5 bg-gray-50 shadow rounded-lg overflow-hidden sm:p-6">
                            <dt className="text-sm font-medium text-gray-500 truncate">Total Volume</dt>
                            <dd className="mt-1 text-3xl font-semibold text-gray-900">{parseFloat(profile?.total_volume || 0).toLocaleString()}</dd>
                        </div>
                        <div className="px-4 py-5 bg-gray-50 shadow rounded-lg overflow-hidden sm:p-6">
                            <dt className="text-sm font-medium text-gray-500 truncate">Status</dt>
                            <dd className="mt-1 text-lg font-semibold text-green-600">Active</dd>
                        </div>
                    </div>
                </div>
            </div>

            {/* Recent Transactions Table */}
            <div className="flex flex-col">
                <div className="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
                    <div className="py-2 align-middle inline-block min-w-full sm:px-6 lg:px-8">
                        <div className="shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
                            <div className="px-4 py-3 bg-white border-b border-gray-200">
                                <h3 className="text-lg leading-6 font-medium text-gray-900">Recent Transactions</h3>
                            </div>
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transaction #</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">You Sent</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">You Received</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rate</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {transactions.map((tx) => (
                                        <tr key={tx.uuid}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {format(new Date(tx.createdAt), 'MMM d, yyyy HH:mm')}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                {tx.transactionNumber}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {tx.amountIn} {tx.currencyIn.code}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                                                {tx.amountOut} {tx.currencyOut.code}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {tx.exchangeRate}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${tx.status === 'completed' ? 'bg-green-100 text-green-800' :
                                                        tx.status === 'cancelled' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                                                    }`}>
                                                    {tx.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {transactions.length === 0 && (
                                        <tr>
                                            <td colSpan="6" className="px-6 py-4 text-center text-gray-500 text-sm">
                                                No transactions found.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PortalDashboardPage;
