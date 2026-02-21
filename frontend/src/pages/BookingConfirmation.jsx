import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { bookingAPI, showAPI } from '../services/api';

const BookingConfirmation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedSeats, show } = location.state || {};
  
  const [booking, setBooking] = useState(null);
  const [timeLeft, setTimeLeft] = useState(5 * 60); // 5 minutes in seconds
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const hasLockedRef = useRef(false); // Prevent double locking

  useEffect(() => {
    if (!selectedSeats || selectedSeats.length === 0) {
      navigate('/shows');
      return;
    }

    // Lock seats when component mounts (only once)
    // Prevent double call in React StrictMode
    if (!hasLockedRef.current && !booking && !loading) {
      hasLockedRef.current = true;
      lockSeats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!booking || confirmed) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          // Auto cancel when timer expires
          const bookingId = booking.bookingId || booking.booking?.id;
          if (bookingId) {
            bookingAPI.cancel(bookingId).then(() => {
              navigate(`/shows/${show?.id || ''}`, { 
                state: { message: 'Booking expired. Please try again.' } 
              });
            }).catch(err => {
              console.error('Failed to auto-cancel:', err);
            });
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [booking, confirmed, navigate, show]);

  const lockSeats = React.useCallback(async () => {
    // Prevent multiple simultaneous calls
    if (hasLockedRef.current && booking) {
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await bookingAPI.lockSeats({ seatIds: selectedSeats });
      setBooking(response.data);
      // Calculate time left based on lockedTill if available
      if (response.data.seat?.lockedTill || response.data.seats?.[0]?.lockedTill) {
        const lockedTill = new Date(response.data.seat?.lockedTill || response.data.seats[0].lockedTill);
        const now = new Date();
        const diff = Math.max(0, Math.floor((lockedTill - now) / 1000));
        setTimeLeft(diff);
      }
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Failed to lock seats';
      setError(errorMessage);
      
      // Clear selected seats from sessionStorage since they couldn't be locked
      if (show?.id) {
        sessionStorage.removeItem(`selectedSeats_${show.id}`);
      }
      
      // Reset the ref so user can try again if they come back
      hasLockedRef.current = false;
      
      setTimeout(() => {
        navigate(`/shows/${show?.id || ''}`, {
          state: {
            error: errorMessage,
            clearSelection: true
          }
        });
      }, 3000); // Give user time to read the error message
    } finally {
      setLoading(false);
    }
  }, [selectedSeats, show, navigate]);

  const handleConfirm = async () => {
    if (!booking) return;

    setLoading(true);
    setError('');
    try {
      const bookingId = booking.bookingId || booking.booking?.id;
      await bookingAPI.confirm(bookingId);
      setConfirmed(true);
      setTimeout(() => {
        navigate('/bookings');
      }, 2000);
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to confirm booking');
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!booking) {
      navigate(`/shows/${show?.id || ''}`);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const bookingId = booking.bookingId || booking.booking?.id;
      await bookingAPI.cancel(bookingId);
      navigate(`/shows/${show?.id || ''}`);
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to cancel booking');
      setLoading(false);
    }
  };


  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const [seatNumbers, setSeatNumbers] = useState([]);

  useEffect(() => {
    // Fetch seat details to get seat numbers
    if (selectedSeats && selectedSeats.length > 0 && show) {
      fetchSeatDetails();
    }
  }, [selectedSeats, show]);

  const fetchSeatDetails = async () => {
    try {
      const response = await showAPI.getSeats(show.id, { page: 1, limit: 1000 });
      const allSeats = response.data.data || [];
      const selectedSeatDetails = allSeats.filter(seat => selectedSeats.includes(seat.id));
      setSeatNumbers(selectedSeatDetails.map(seat => seat.seatNumber).sort((a, b) => a - b));
    } catch (error) {
      console.error('Error fetching seat details:', error);
    }
  };

  if (loading && !booking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Locking seats...</p>
        </div>
      </div>
    );
  }

  if (confirmed) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-green-500 text-6xl mb-4">✓</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Booking Confirmed!</h2>
          <p className="text-gray-600 mb-4">Your booking has been successfully confirmed.</p>
          <p className="text-sm text-gray-500">Redirecting to your bookings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Confirm Your Booking</h1>
          
          {show && (
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">{show.event?.name}</h2>
              <p className="text-gray-600">Venue: {show.venue?.name}</p>
            </div>
          )}

          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Selected Seats</h3>
            <div className="flex flex-wrap gap-2">
              {seatNumbers.length > 0 ? (
                seatNumbers.map((seatNumber) => (
                  <span
                    key={seatNumber}
                    className="bg-primary-100 text-primary-800 px-3 py-1 rounded-full text-sm font-medium"
                  >
                    Seat {seatNumber}
                  </span>
                ))
              ) : (
                selectedSeats?.map((seatId, index) => (
                  <span
                    key={seatId}
                    className="bg-primary-100 text-primary-800 px-3 py-1 rounded-full text-sm font-medium"
                  >
                    Seat {index + 1}
                  </span>
                ))
              )}
            </div>
            <p className="text-sm text-gray-600 mt-2">
              {selectedSeats?.length} seat{selectedSeats?.length !== 1 ? 's' : ''} selected
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
              {error}
            </div>
          )}

          {booking && (
            <div className="mb-6">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-yellow-800">Time Remaining</span>
                  <span className={`text-2xl font-bold ${
                    timeLeft < 60 ? 'text-red-600' : 'text-yellow-800'
                  }`}>
                    {formatTime(timeLeft)}
                  </span>
                </div>
                <p className="text-xs text-yellow-700">
                  Please confirm your booking before the timer expires
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <p className="text-sm text-gray-600 mb-1">Booking ID</p>
                <p className="text-sm font-mono text-gray-900">
                  {booking.bookingId || booking.booking?.id}
                </p>
              </div>
            </div>
          )}

          <div className="flex space-x-4">
            <button
              onClick={handleCancel}
              disabled={loading}
              className="flex-1 bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-300 transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading || !booking || timeLeft === 0}
              className="flex-1 bg-primary-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : 'Confirm Booking'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookingConfirmation;

