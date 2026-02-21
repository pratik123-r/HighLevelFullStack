import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { showAPI, eventAPI, venueAPI, adminAPI } from '../../services/api';

const Dashboard = () => {
  const [stats, setStats] = useState({
    shows: 0,
    events: 0,
    venues: 0,
    users: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [showsRes, eventsRes, venuesRes, usersRes] = await Promise.all([
        showAPI.getAvailable({ page: 1, limit: 1 }),
        eventAPI.getAll({ page: 1, limit: 1 }),
        venueAPI.getAll({ page: 1, limit: 1 }),
        adminAPI.getAllUsers({ page: 1, limit: 1 }),
      ]);

      setStats({
        shows: showsRes.data.total || 0,
        events: eventsRes.data.total || 0,
        venues: venuesRes.data.total || 0,
        users: usersRes.data.total || 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [

  ];

  return (
    <div className="px-4 py-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Admin Dashboard</h1>
        
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="h-8 bg-gray-200 rounded w-1/4"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {statCards.map((card, index) => (
              <Link
                key={index}
                to={card.link}
                className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition"
              >
                <div className={`${card.color} w-12 h-12 rounded-lg flex items-center justify-center mb-4`}>
                  <span className="text-white text-2xl font-bold">{card.value}</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-700">{card.title}</h3>
              </Link>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link
            to="/admin/venues"
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition"
          >
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Manage Venues</h3>
            <p className="text-gray-600">Create and manage venues</p>
          </Link>
          
          <Link
            to="/admin/events"
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition"
          >
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Manage Events</h3>
            <p className="text-gray-600">Create and manage events</p>
          </Link>
          
          <Link
            to="/admin/shows"
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition"
          >
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Manage Shows</h3>
            <p className="text-gray-600">Create and manage shows</p>
          </Link>
          
          <Link
            to="/admin/users"
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition"
          >
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Manage Users</h3>
            <p className="text-gray-600">View and manage users</p>
          </Link>
          
          <Link
            to="/admin/bookings"
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition"
          >
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Manage Bookings</h3>
            <p className="text-gray-600">View and manage all bookings</p>
          </Link>
          
          <Link
            to="/admin/audit-logs"
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition"
          >
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Audit Logs</h3>
            <p className="text-gray-600">View system audit logs</p>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

