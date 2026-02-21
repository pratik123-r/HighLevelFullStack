import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Shows from './pages/Shows';
import ShowDetail from './pages/ShowDetail';
import BookingConfirmation from './pages/BookingConfirmation';
import MyBookings from './pages/MyBookings';
import AdminDashboard from './pages/admin/Dashboard';
import AdminVenues from './pages/admin/Venues';
import AdminEvents from './pages/admin/Events';
import AdminShows from './pages/admin/Shows';
import AdminUsers from './pages/admin/Users';
import AdminBookings from './pages/admin/Bookings';
import AdminAuditLogs from './pages/admin/AuditLogs';

const PrivateRoute = ({ children, requireAdmin = false, requireUser = false }) => {
  const { isAuthenticated, isAdmin, isUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  if (requireUser && !isUser) {
    return <Navigate to="/admin" replace />;
  }

  return children;
};

const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
      
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="shows" element={<Shows />} />
        <Route path="shows/:id" element={<ShowDetail />} />
        <Route 
          path="booking/confirm" 
          element={
            <PrivateRoute requireUser>
              <BookingConfirmation />
            </PrivateRoute>
          } 
        />
        <Route 
          path="bookings" 
          element={
            <PrivateRoute requireUser>
              <MyBookings />
            </PrivateRoute>
          } 
        />
        
        {/* Admin Routes */}
        <Route 
          path="admin" 
          element={
            <PrivateRoute requireAdmin>
              <AdminDashboard />
            </PrivateRoute>
          } 
        />
        <Route 
          path="admin/venues" 
          element={
            <PrivateRoute requireAdmin>
              <AdminVenues />
            </PrivateRoute>
          } 
        />
        <Route 
          path="admin/events" 
          element={
            <PrivateRoute requireAdmin>
              <AdminEvents />
            </PrivateRoute>
          } 
        />
        <Route 
          path="admin/shows" 
          element={
            <PrivateRoute requireAdmin>
              <AdminShows />
            </PrivateRoute>
          } 
        />
        <Route 
          path="admin/users" 
          element={
            <PrivateRoute requireAdmin>
              <AdminUsers />
            </PrivateRoute>
          } 
        />
        <Route 
          path="admin/bookings" 
          element={
            <PrivateRoute requireAdmin>
              <AdminBookings />
            </PrivateRoute>
          } 
        />
        <Route 
          path="admin/audit-logs" 
          element={
            <PrivateRoute requireAdmin>
              <AdminAuditLogs />
            </PrivateRoute>
          } 
        />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}

export default App;

