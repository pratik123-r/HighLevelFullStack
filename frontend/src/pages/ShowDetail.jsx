import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { showAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const ShowDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isAdmin } = useAuth();
  const [show, setShow] = useState(null);
  const [seats, setSeats] = useState([]);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seatsLoading, setSeatsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchShow();
    fetchSeats();
    
    // Check if we're returning from confirmation page with an error
    if (location.state?.error) {
      setError(location.state.error);
      // Clear the state to prevent showing error on next navigation
      window.history.replaceState({}, document.title);
    }
    
    // Clear selection if requested (e.g., from failed lock attempt)
    if (location.state?.clearSelection) {
      setSelectedSeats([]);
      sessionStorage.removeItem(`selectedSeats_${id}`);
      // Clear the state
      window.history.replaceState({}, document.title);
    }
  }, [id, location.state]);

  // Restore and validate selected seats after seats are loaded
  useEffect(() => {
    if (seats.length === 0) return;

    // Don't restore if we're coming back from a failed lock attempt
    if (location.state?.clearSelection) {
      return;
    }

    // Restore selected seats from sessionStorage
    const savedSeats = sessionStorage.getItem(`selectedSeats_${id}`);
    if (savedSeats) {
      try {
        const parsed = JSON.parse(savedSeats);
        // Filter out seats that are now booked or locked
        const validSeats = parsed.filter(seatId => {
          const seat = seats.find(s => s.id === seatId);
          return seat && seat.status !== 'BOOKED' && !seat.isLocked;
        });
        
        if (validSeats.length !== parsed.length) {
          // Some seats are no longer available, clear selection
          setSelectedSeats([]);
          sessionStorage.removeItem(`selectedSeats_${id}`);
          if (!location.state?.error) {
            setError('Some previously selected seats are no longer available. Please select again.');
          }
        } else {
          setSelectedSeats(validSeats);
        }
      } catch (e) {
        console.error('Error restoring selected seats:', e);
        sessionStorage.removeItem(`selectedSeats_${id}`);
      }
    }
  }, [seats, id, location.state]);

  // Save selected seats to sessionStorage whenever they change
  useEffect(() => {
    if (selectedSeats.length > 0) {
      sessionStorage.setItem(`selectedSeats_${id}`, JSON.stringify(selectedSeats));
    } else {
      sessionStorage.removeItem(`selectedSeats_${id}`);
    }
  }, [selectedSeats, id]);

  const fetchShow = async () => {
    try {
      const response = await showAPI.getById(id);
      setShow(response.data);
    } catch (error) {
      console.error('Error fetching show:', error);
      setError('Failed to load show details');
    } finally {
      setLoading(false);
    }
  };

  const fetchSeats = async () => {
    setSeatsLoading(true);
    try {
      const response = await showAPI.getSeats(id, { page: 1, limit: 1000 });
      const fetchedSeats = response.data.data || [];
      // Sort seats by seat number
      const sortedSeats = [...fetchedSeats].sort((a, b) => Number(a.seatNumber) - Number(b.seatNumber));
      setSeats(sortedSeats);
      
      // Clear selected seats if they are now locked or booked
      setSelectedSeats(prev => {
        const validSeats = prev.filter(seatId => {
          const seat = fetchedSeats.find(s => s.id === seatId);
          return seat && seat.status !== 'BOOKED' && !seat.isLocked;
        });
        
        if (validSeats.length !== prev.length) {
          // Update sessionStorage if seats were removed
          if (validSeats.length > 0) {
            sessionStorage.setItem(`selectedSeats_${id}`, JSON.stringify(validSeats));
          } else {
            sessionStorage.removeItem(`selectedSeats_${id}`);
          }
        }
        
        return validSeats;
      });
    } catch (error) {
      console.error('Error fetching seats:', error);
    } finally {
      setSeatsLoading(false);
    }
  };

  const MAX_SELECTED_SEATS = 5;

  const toggleSeat = (seatId) => {
    // Admins cannot book seats
    if (isAdmin) {
      setError('Admins cannot book seats. Please use a user account.');
      return;
    }

    const seat = seats.find(s => s.id === seatId);
    // Check if seat is booked or locked (using isLocked field from API)
    if (seat.status === 'BOOKED' || seat.isLocked) {
      return;
    }

    setSelectedSeats(prev => {
      if (prev.includes(seatId)) {
        return prev.filter(id => id !== seatId);
      } else {
        // Limit to max 5 seats
        if (prev.length >= MAX_SELECTED_SEATS) {
          setError(`You can select a maximum of ${MAX_SELECTED_SEATS} seats`);
          return prev;
        }
        return [...prev, seatId];
      }
    });
  };

  const handleNext = () => {
    // Require authentication when proceeding to confirmation
    if (!isAuthenticated) {
      navigate('/login', { 
        state: { 
          returnTo: `/shows/${id}`,
          message: 'Please login to continue with your booking'
        } 
      });
      return;
    }

    if (selectedSeats.length === 0) {
      setError('Please select at least one seat');
      return;
    }

    if (selectedSeats.length > MAX_SELECTED_SEATS) {
      setError(`You can select a maximum of ${MAX_SELECTED_SEATS} seats`);
      return;
    }

    setError('');
    // Navigate to confirmation page with selected seats and show data
    navigate('/booking/confirm', {
      state: {
        selectedSeats,
        show,
      }
    });
  };


  const getSeatStatus = (seat) => {
    if (seat.status === 'BOOKED') return 'booked';
    if (seat.isLocked) return 'locked';
    if (selectedSeats.includes(seat.id)) return 'selected';
    return 'available';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!show) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">Show not found</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">{show.event?.name}</h1>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-gray-600">Venue</p>
              <p className="text-lg font-semibold">{show.event?.venue?.name || 'N/A'}</p>
            </div>
            <div>
              <p className="text-gray-600">Status</p>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                show.status === 'AVAILABLE' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {show.status}
              </span>
            </div>
            <div>
              <p className="text-gray-600">Total Seats</p>
              <p className="text-lg font-semibold">{show.totalSeats}</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {isAdmin && (
          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded mb-4">
            <p className="font-semibold">Admin Account</p>
            <p className="text-sm">Admins cannot book seats. Please use a user account to make bookings.</p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Select Seats</h2>
          
          {seatsLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-8 md:grid-cols-12 lg:grid-cols-16 gap-2 mb-6">
                {seats.map((seat) => {
                  const status = getSeatStatus(seat);
                  return (
                    <button
                      key={seat.id}
                      onClick={() => toggleSeat(seat.id)}
                      disabled={status === 'booked' || status === 'locked' || isAdmin}
                      className={`
                        aspect-square rounded text-xs font-medium transition
                        ${status === 'available' ? 'bg-green-100 hover:bg-green-200 text-green-800' : ''}
                        ${status === 'selected' ? 'bg-primary-600 text-white' : ''}
                        ${status === 'booked' ? 'bg-red-300 text-red-800 cursor-not-allowed' : ''}
                        ${status === 'locked' ? 'bg-yellow-300 text-yellow-800 cursor-not-allowed' : ''}
                        ${isAdmin ? 'cursor-not-allowed opacity-50' : ''}
                      `}
                      title={isAdmin ? 'Admins cannot book seats' : `Seat ${seat.seatNumber} - ${status}`}
                    >
                      {seat.seatNumber}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between mb-6 p-4 bg-gray-50 rounded">
                <div className="flex items-center space-x-6">
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-green-100 rounded"></div>
                    <span className="text-sm">Available</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-primary-600 rounded"></div>
                    <span className="text-sm">Selected</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-red-300 rounded"></div>
                    <span className="text-sm">Booked</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-yellow-300 rounded"></div>
                    <span className="text-sm">Locked</span>
                  </div>
                </div>
                {selectedSeats.length > 0 && !isAdmin && (
                  <div className="flex items-center space-x-4">
                    <p className="text-lg font-semibold">
                      {selectedSeats.length} seat{selectedSeats.length !== 1 ? 's' : ''} selected
                    </p>
                    {selectedSeats.length >= MAX_SELECTED_SEATS && (
                      <p className="text-sm text-yellow-600 font-medium">
                        Maximum {MAX_SELECTED_SEATS} seats reached
                      </p>
                    )}
                  </div>
                )}
              </div>

              {selectedSeats.length > 0 && !isAdmin && (
                <div>
                  {!isAuthenticated && (
                    <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-2 rounded mb-3 text-sm">
                      <p>Please login to proceed with your booking</p>
                    </div>
                  )}
                  <div className="flex space-x-3">
                    <button
                      onClick={() => {
                        setSelectedSeats([]);
                        sessionStorage.removeItem(`selectedSeats_${id}`);
                        setError('');
                      }}
                      className="flex-1 bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-300 transition"
                    >
                      Clear Selection
                    </button>
                    <button
                      onClick={handleNext}
                      className="flex-1 bg-primary-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-700 transition"
                    >
                      {isAuthenticated ? 'Next' : 'Login to Continue'} ({selectedSeats.length})
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShowDetail;

