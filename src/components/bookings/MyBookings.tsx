import { useEffect, useState } from 'react';
import './MyBookings.css';

// Represents a room included in a booking.
interface BookingRoom {
  room_type_id: string;
  room_name: string;
  quantity: number;
  price_per_night: string | number;
}

// Represents a booking returned by the backend API.
interface Booking {
  id: string;
  booking_reference: string;
  check_in: string;
  check_out: string;
  guest_count: number;
  total_amount: string | number;
  currency: string;
  status: string;
  special_requests: string | null;
  accommodation_name: string;
  accommodation_address: string;
  accommodation_city: string;
  rooms: BookingRoom[];
}

// Represents the API response structure.
interface MyBookingsResponse {
  success: boolean;
  count: number;
  data: Booking[];
  message?: string;
}

interface MyBookingsProps {
  authToken: string;
  onBackToHotels: () => void;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export const MyBookings = ({ authToken, onBackToHotels }: MyBookingsProps) => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  // Tracks which booking is currently being cancelled.
  const [cancellingBookingId, setCancellingBookingId] = useState<string | null>(null);

  // Displays cancellation success or error messages.
  const [cancellationMessage, setCancellationMessage] = useState('');
  const [cancellationError, setCancellationError] = useState(false);

  useEffect(() => {
    // Prevent making an API request without an authentication token.
    if (!authToken) {
      setBookings([]);
      setErrorMessage('Please sign in to view your bookings.');
      setIsLoading(false);
      return;
    }

    // Prevent state updates if the component unmounts during the request.
    const controller = new AbortController();

    async function loadBookings() {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const response = await fetch(`${API_BASE_URL}/api/bookings`, {
          method: 'GET', headers: { Authorization: `Bearer ${authToken}` },
          signal: controller.signal});

        const result = (await response.json()) as MyBookingsResponse;

        if (!response.ok || !result.success) {
          throw new Error(result.message || 'Unable to load your bookings.');
        }

        setBookings(result.data);
      } catch (error) {
        // Ignore cancellation when the component unmounts or the token changes.
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }

        setErrorMessage(
          error instanceof Error ? error.message : 'An unexpected error occurred while loading bookings.');
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadBookings();

    return () => controller.abort();
  }, [authToken]);

  // Format the booking amount using the currency returned by the API.
  function formatPrice(amount: string | number, currency: string) {
    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount)) {
      return `${currency} ${amount}`;
    }

    try {
      return new Intl.NumberFormat('en-ZA', {style: 'currency', currency}).format(numericAmount);
    } catch {
      return `${currency} ${numericAmount.toFixed(2)}`;
    }
  }

  // Convert API date values to a readable date.
  function formatDate(date: string) {
    const dateOnly = date.slice(0, 10);
    const [year, month, day] = dateOnly.split('-').map(Number);

    return new Date(year, month - 1, day).toLocaleDateString('en-ZA', {
      day: 'numeric', month: 'short', year: 'numeric'});
  }

  // Cancels a pending booking belonging to the authenticated customer.
  async function handleCancelBooking(booking: Booking) {
    // Ask the customer to confirm before changing the booking.
    const confirmed = window.confirm(`Are you sure you want to cancel booking ${booking.booking_reference}?`);

    if (!confirmed) {
      return;
    }

    setCancellingBookingId(booking.id);
    setCancellationMessage('');
    setCancellationError(false);

    try {
      // Send the cancellation request to the protected backend endpoint.
      const response = await fetch(`${API_BASE_URL}/api/bookings/${encodeURIComponent(booking.id)}`,
        {method: 'DELETE', headers: {Authorization: `Bearer ${authToken}`}});

      const result = (await response.json()) as {success: boolean, message?: string};

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Unable to cancel this booking.');
      }

      // Update the displayed booking immediately after successful cancellation.
      setBookings((currentBookings) =>
        currentBookings.map((currentBooking) =>
          currentBooking.id === booking.id ? { ...currentBooking, status: 'cancelled' } : currentBooking));

      setCancellationMessage(
        result.message || 'Booking cancelled successfully.');
    } catch (error) {
      setCancellationError(true);

      setCancellationMessage(
      error instanceof Error ? error.message : 'An unexpected error occurred while cancelling the booking.');
    } finally {
      setCancellingBookingId(null);
    }
  }

  if (isLoading) {
    return (
      <section className="my-bookings">
        <h2>My Bookings</h2>
        <p role="status">Loading your bookings...</p>
      </section>
    );
  }

  if (errorMessage) {
    return (
      <section className="my-bookings">
        <h2>My Bookings</h2>
        <p className="my-bookings-error" role="alert">{errorMessage}</p>
      </section>
    );
  }

  return (
    <section className="my-bookings">
      <button type="button" className="back-to-hotels-button"
        onClick={onBackToHotels}>Back to Hotels</button>
      <header className="my-bookings-header">
        <h2>My Bookings</h2>
        <p>View your hotel reservations and booking details.</p>
      </header>

      {bookings.length === 0 ? (
        <div className="my-bookings-empty">
          <h3>No bookings yet</h3>
          <p>When you book a room, your reservation will appear here.</p>
        </div>
      ) : (
        <div className="my-bookings-list">
          {bookings.map((booking) => (
            <article className="booking-card" key={booking.id}>
              <div className="booking-card-header">

                <div>
                  <h3>{booking.accommodation_name}</h3>
                  <p>{booking.accommodation_address} {booking.accommodation_city
                    ? `, ${booking.accommodation_city}` : ''} </p>
                </div>

                <span className={`booking-status booking-status-${booking.status.toLowerCase()}`}>
                  {booking.status.replace(/_/g, ' ')}</span>
              </div>

              <div className="booking-reference">
                <span>Booking reference</span>
                <strong>{booking.booking_reference}</strong>
              </div>

              <div className="booking-details-grid">
                <div>
                  <span>Check-in</span>
                  <strong>{formatDate(booking.check_in)}</strong>
                </div>

                <div>
                  <span>Check-out</span>
                  <strong>{formatDate(booking.check_out)}</strong>
                </div>

                <div>
                  <span>Guests</span>
                  <strong>{booking.guest_count}</strong>
                </div>

                <div>
                  <span>Total amount</span>
                  <strong>{formatPrice(booking.total_amount, booking.currency)}</strong>
                </div>
              </div>

              <div className="booking-rooms">
                <h4>Room details</h4>

                {booking.rooms.map((room, index) => (
                  <div className="booking-room-row" key={`${room.room_type_id}-${index}`}>
                    <span>{room.room_name} × {room.quantity}</span>
                    <span>{formatPrice(room.price_per_night, booking.currency)}{' / night'}
                    </span>
                  </div>))}
              </div>

              {booking.special_requests && (
                <div className="booking-special-requests">
                  <h4>Special requests</h4>
                  <p>{booking.special_requests}</p>
                </div>)}

              {booking.status.toLowerCase() === 'pending' && (
                <>
                  <p className="booking-payment-note">Your booking is pending. Payment has not yet been confirmed.</p>
                  <button type="button" className="cancel-booking-button" onClick={() => void handleCancelBooking(booking)}
                    disabled={cancellingBookingId !== null}> {cancellingBookingId === booking.id
                      ? 'Cancelling...' : 'Cancel Booking'}</button>
                </>
              )}
            </article>
          ))}
        </div>
      )}
      {cancellationMessage && (
        <p className={cancellationError ? 'my-bookings-error' : 'cancellation-success-message'}
          role={cancellationError ? 'alert' : 'status'}>{cancellationMessage}</p>
      )}
    </section>
  );
}
