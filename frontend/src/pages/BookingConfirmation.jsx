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
  const [queueInfo, setQueueInfo] = useState(null); // { queuePosition, totalInQueue, batchSize } when waiting in queue
  const hasLockedRef = useRef(false); // Prevent double locking
  const pollIntervalRef = useRef(null);

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
    // Prevent multiple simultaneous calls when we already have a booking
    if (hasLockedRef.current && booking) {
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await bookingAPI.lockSeats({ seatIds: selectedSeats });
      if (response.status === 202 && response.data?.queued) {
        setQueueInfo({
          queuePosition: response.data.queuePosition,
          totalInQueue: response.data.totalInQueue,
          batchSize: response.data.batchSize ?? 1000,
        });
        setLoading(false);
        return;
      }
      setQueueInfo(null);
      setBooking(response.data);
      if (response.data.seats?.[0]?.lockedTill) {
        const lockedTill = new Date(response.data.seats[0].lockedTill);
        const now = new Date();
        const diff = Math.max(0, Math.floor((lockedTill - now) / 1000));
        setTimeLeft(diff);
      }
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Failed to lock seats';
      setError(errorMessage);
      if (show?.id) {
        sessionStorage.removeItem(`selectedSeats_${show.id}`);
      }
      hasLockedRef.current = false;
      setTimeout(() => {
        navigate(`/shows/${show?.id || ''}`, {
          state: { error: errorMessage, clearSelection: true },
        });
      }, 3000);
    } finally {
      setLoading(false);
    }
  }, [selectedSeats, show, navigate, booking]);

  // Poll queue position when waiting; when inBatch, retry lock
  useEffect(() => {
    if (!queueInfo || !show?.id || !selectedSeats?.length) return;

    const poll = async () => {
      try {
        const { data } = await bookingAPI.getQueuePosition(show.id);
        setQueueInfo(prev => prev ? { ...prev, queuePosition: data.position, totalInQueue: data.totalInQueue } : null);
        if (data.inBatch) {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          setLoading(true);
          try {
            const response = await bookingAPI.lockSeats({ seatIds: selectedSeats });
            if (response.status === 202 && response.data?.queued) {
              setQueueInfo({ queuePosition: response.data.queuePosition, totalInQueue: response.data.totalInQueue, batchSize: response.data.batchSize ?? 1000 });
              setLoading(false);
              pollIntervalRef.current = setInterval(poll, 2500);
              return;
            }
            setQueueInfo(null);
            setBooking(response.data);
            if (response.data.seats?.[0]?.lockedTill) {
              const lockedTill = new Date(response.data.seats[0].lockedTill);
              setTimeLeft(Math.max(0, Math.floor((lockedTill - Date.now()) / 1000)));
            }
          } catch (err) {
            setError(err.response?.data?.error || 'Failed to lock seats');
            setQueueInfo(null);
          } finally {
            setLoading(false);
          }
        }
      } catch (e) {
        console.error('Queue position poll error:', e);
      }
    };

    pollIntervalRef.current = setInterval(poll, 2500);
    poll();
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [queueInfo, show?.id, selectedSeats]);

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

  if (loading && !booking && !queueInfo) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Locking seats...</p>
        </div>
      </div>
    );
  }

  if (queueInfo && !booking) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 px-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 text-amber-600 mb-6">
            <svg className="w-8 h-8 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">You're in the queue</h2>
          <p className="text-gray-600 mb-6">
            Only the first <strong>{queueInfo.batchSize}</strong> users can book at a time. When it's your turn, you'll proceed automatically.
          </p>
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-500 mb-1">Your position</p>
            <p className="text-4xl font-bold text-primary-600">{queueInfo.queuePosition}</p>
            <p className="text-sm text-gray-500 mt-1">of {queueInfo.totalInQueue} waiting</p>
          </div>
          {loading && (
            <p className="text-sm text-amber-600 font-medium">Securing your seats...</p>
          )}
          {!loading && (
            <p className="text-sm text-gray-500">Please wait. This page will update when it's your turn.</p>
          )}
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
              <p className="text-gray-600">Venue: {show.event?.venue?.name || 'N/A'}</p>
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

