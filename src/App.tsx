import { useEffect, useRef, useState, type FormEvent } from 'react';
import './App.css';
import { AuthModal } from './components/auth/AuthModal';
import { MyBookings } from './components/bookings/MyBookings';
import { AdminDashboard } from './components/admin/AdminDashboard';

// The API currently returns one object for each hotel/branch.
interface Accommodation {
  id: string;
  name: string;
  description: string | null;
  address: string;
  city: string;
  country: string;
  star_rating: string | null;
  minimum_price: string | null;
  image_url: string | null;
}

// These types describe the additional information returned by
// GET /api/accommodations/:id when someone clicks "View rooms".
interface RoomType {
  id: string;
  name: string;
  description: string | null;
  capacity: number;
  price_per_night: string;
  total_units: number;
}

interface AccommodationDetails extends Accommodation {
  room_types: RoomType[];
  amenities: { id: string; name: string; description: string | null }[];
  policies: { id: string; policy_type: string; title: string; description: string; }[];
}

interface AccommodationListResponse {
  success: boolean;
  data: Accommodation[];
  count: number;
}

interface AccommodationDetailsResponse {
  success: boolean;
  data: AccommodationDetails;
}

// Keep the backend address in one place.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

// Format prices as South African rand, for example R 1200
function formatPrice(price: string | number | null): string {
  if (price === null || price === '') {
    return 'Check dates for price';
  }

  const numericPrice = Number(price);

  // Avoid displaying invalid numeric values as a price.
  if (!Number.isFinite(numericPrice)) {
    return 'Price unavailable';
  }

  return new Intl.NumberFormat('en-ZA', {
    style: 'currency', currency: 'ZAR',
    maximumFractionDigits: 0
  }).format(Number(price));
}

function App() {
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  // Controls whether the login and registration modal is visible.
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Restores the authentication token for the current browser tab.
  const [authToken, setAuthToken] = useState<string | null>(() => {
    return sessionStorage.getItem('authToken');
  });
  // Tracks the latest branch-details request.
  const detailsRequestId = useRef(0);

  // Branches returned by the existing backend.
  const [branches, setBranches] = useState<Accommodation[]>([]);

  // Controls whether the customer sees the hotel search or their bookings.
  const [showMyBookings, setShowMyBookings] = useState(false);

  // These states help us give feedback while the API request is running or when something goes wrong.
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  // Search input and destination submitted by the user are separate
  // means we don't send a request for every character typed
  const [destination, setDestination] = useState('');
  const [submittedDestination, setSubmittedDestination] = useState('');

  // Stores validation messages for the hotel search form.
  const [searchError, setSearchError] = useState('');

  // Changing this value lets the user retry a failed API request.
  const [retryCount, setRetryCount] = useState(0);

  // Values used by the search form
  // Date availability filtering
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  // Stores the number of guests and rooms separately for future booking requests.
  const [guests, setGuests] = useState(2);
  const [rooms, setRooms] = useState(1);

  // State for loading and displaying details when "View rooms" is clicked.
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [branchDetails, setBranchDetails] = useState<AccommodationDetails | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState('');

  // Stores the ID of the room type selected by the customer.
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  // Finds the room type selected by the customer.
  const selectedRoom = branchDetails?.room_types.find((room) => room.id === selectedRoomId);

  // Tracks whether a booking request is being submitted.
  const [isBooking, setIsBooking] = useState(false);

  // Stores success or error feedback for the booking process.
  const [bookingMessage, setBookingMessage] = useState('');

  // Identifies whether the booking feedback represents an error.
  const [bookingError, setBookingError] = useState(false);

  // Calculates the number of nights between check-in and check-out.
  const stayNights = checkIn && checkOut ? Math.round(
    (new Date(`${checkOut}T00:00:00`).getTime() -
      new Date(`${checkIn}T00:00:00`).getTime()) / (1000 * 60 * 60 * 24)) : 0;

  // Calculates the estimated cost for all requested rooms.
  const estimatedTotal = selectedRoom && guests <= selectedRoom.capacity && stayNights > 0 &&
    rooms > 0 ? Number(selectedRoom.price_per_night) * rooms * stayNights : 0;

  // Formats the guest and room selection for display.
  const guestsAndRooms = `${guests} ${guests === 1 ? 'guest' : 'guests'} • ` +
    `${rooms} ${rooms === 1 ? 'room' : 'rooms'}`;

  // Checks whether the selected room can accommodate all requested guests.
  const exceedsRoomCapacity = selectedRoom !== undefined && guests > selectedRoom.capacity;

  // Saves the token after a successful login or registration.
  async function handleAuthenticated(token: string) {
    sessionStorage.setItem('authToken', token);
    setAuthToken(token);
    setIsAuthModalOpen(false);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Unable to verify your account.');
      }

      // Only administrators are redirected to the admin area.
      setShowAdminDashboard(result.data.role === 'admin');
    } catch {
      sessionStorage.removeItem('authToken');
      setAuthToken(null);
      setShowAdminDashboard(false);
    }
  }
  // Signs the current user/admin out of this browser session.
  function handleSignOut() {
    sessionStorage.removeItem('authToken');
    setAuthToken(null);
    setShowAdminDashboard(false);
    setShowMyBookings(false);
  }
  // Submits a booking to the authenticated booking API.
  async function handleBooking() {
    // A customer must be signed in before submitting a booking.
    if (!authToken) {
      setBookingMessage('Please sign in before booking a room.');
      setBookingError(true);
      setIsAuthModalOpen(true);
      return;
    }

    // A branch and room type must be selected.
    if (!branchDetails || !selectedRoom) {
      setBookingMessage('Please select a hotel branch and room type.');
      setBookingError(true);
      return;
    }

    // Validate the selected dates before sending the request.
    if (!checkIn || !checkOut || stayNights <= 0) {
      setBookingMessage('Please select valid check-in and check-out dates.');
      setBookingError(true);
      return;
    }

    // Ensure the selected room can accommodate the guests.
    if (guests > selectedRoom.capacity) {
      setBookingMessage('Please select a room that accommodates all guests.');
      setBookingError(true);
      return;
    }

    setIsBooking(true);
    setBookingMessage('');
    setBookingError(false);

    try {
      const response = await fetch(`${API_BASE_URL}/api/bookings`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          accommodation_id: branchDetails.id, room_type_id: selectedRoom.id,
          check_in: checkIn, check_out: checkOut, guest_count: guests, quantity: rooms
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || result.error || `Booking failed (${response.status}).`);
      }

      setBookingMessage(result.message || 'Your booking request was submitted successfully.');
      setBookingError(false);
    } catch (error) {
      setBookingMessage(error instanceof Error ? error.message : 'Unable to submit your booking. Please try again.');
      setBookingError(true);
    } finally {
      setIsBooking(false);
    }
  }

  // Restores the authenticated user's session after a page refresh.
  useEffect(() => {
    const restoreSession = async () => {
      const savedToken = sessionStorage.getItem('authToken');

      // No saved session exists, so show the normal customer app.
      if (!savedToken) {
        setIsRestoringSession(false);
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/me`,
          { method: 'GET', headers: { Authorization: `Bearer ${savedToken}` } });

        if (!response.ok) {
          throw new Error('Your session has expired. Please log in again.');
        }

        const result = await response.json();

        if (!result.success || !result.data) {
          throw new Error('Unable to restore your session.');
        }

        // Restore the token and determine which dashboard to display.
        setAuthToken(savedToken);
        setShowAdminDashboard(result.data.role === 'admin');
      } catch (error) {
        console.error('Session restoration failed:', error);

        sessionStorage.removeItem('authToken');
        setAuthToken(null);
        setShowAdminDashboard(false);
      } finally {
        setIsRestoringSession(false);
      }
    };

    void restoreSession();
  }, []);

  //  Clears the selected room if the guest count changes and the room can no longer accommodate the guests.
  useEffect(() => {
    if (selectedRoom && guests > selectedRoom.capacity) {
      setSelectedRoomId(null);
    }
  }, [guests, selectedRoom]);


  // Load the branches from the backend.
  // This runs when the page first opens and when a new search is submitted.
  useEffect(() => {
    const controller = new AbortController();
    async function loadBranches() {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const params = new URLSearchParams();

        // The current API searches accommodation names and cities.
        // If user enters "Polokwane" the request matches the fields supported by the API.
        const searchTerm = submittedDestination.split(',')[0].trim();

        if (searchTerm) {
          params.set('search', searchTerm);
        }

        // Ask for up to 100 results, using the API's supported page limit.
        params.set('page', '1');
        params.set('limit', '100');

        const queryString = params.toString();
        const url = `${API_BASE_URL}/api/accommodations?${queryString}`;
        const response = await fetch(url, { signal: controller.signal });

        if (!response.ok) {
          throw new Error(`The server returned status ${response.status}.`);
        }

        const result = (await response.json()) as AccommodationListResponse;

        if (!result.success || !Array.isArray(result.data)) {
          throw new Error('Unexpected error occured.');
        }

        setBranches(result.data);
      } catch (error) {
        // Ignore requests cancelled
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : 'Unable to load hotel branches.');
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }
    void loadBranches();

    // Abort an old request when a new search starts.
    return () => controller.abort();
  }, [submittedDestination, retryCount]);

  // Submit the destination search
  // Validates the search form before requesting hotel branches.
  function handleSearch(event: FormEvent<HTMLFormElement>) {
    // Prevent the browser from refreshing the page.
    event.preventDefault();

    // Clear any previous validation message.
    setSearchError('');

    // A destination is required to search for hotel branches.
    if (!destination.trim()) {
      setSearchError('Please enter a destination or city.');
      return;
    }

    // Both dates must be selected.
    if (!checkIn || !checkOut) {
      setSearchError('Please select your check-in and check-out dates.');
      return;
    }

    // Convert the selected dates to timestamps for comparison.
    const checkInDate = new Date(`${checkIn}T00:00:00`);
    const checkOutDate = new Date(`${checkOut}T00:00:00`);

    // Check-out must be after check-in.
    if (checkOutDate <= checkInDate) {
      setSearchError('Check-out must be after check-in.');
      return;
    }

    // Prevent a check-in date from the past.
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (checkInDate < today) {
      setSearchError('Check-in cannot be in the past.');
      return;
    }

    // Update the destination used by the existing API request.
    // Apply the destination to the existing accommodation search.
    setSubmittedDestination(destination.trim());
  }

  // Load room information from the existing detail endpoint
  async function handleViewRooms(branchId: string) {
    // Give this request a unique ID so older requests cannot overwrite it.
    const requestId = ++detailsRequestId.current;

    // Open the modal and reset the previous branch's information.
    setSelectedBranchId(branchId);
    setBranchDetails(null);
    setDetailsError('');
    setSelectedRoomId(null);
    setIsLoadingDetails(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/accommodations/${branchId}`);

      if (!response.ok) {
        throw new Error(`Unable to load branch details (${response.status}).`);
      }

      const result = (await response.json()) as AccommodationDetailsResponse;

      // Ignore the response if a newer request has started.
      if (requestId !== detailsRequestId.current) return;

      setBranchDetails(result.data);
    } catch (error) {
      // Ignore errors from an outdated request.
      if (requestId !== detailsRequestId.current) return;

      setDetailsError(error instanceof Error ? error.message : 'Unable to load room details.');
    } finally {
      // Only the current request should stop the loading indicator.
      if (requestId === detailsRequestId.current) {
        setIsLoadingDetails(false);
      }
    }
  }

  // Close the modal and invalidates any outstanding request.
  function closeBranchModal() {
    detailsRequestId.current += 1;
    setSelectedBranchId(null);
    setBranchDetails(null);
    setDetailsError('');
    setIsLoadingDetails(false);
    setSelectedRoomId(null);
  }

  if (isRestoringSession) {
    return (
      <div className="session-loading">Restoring your session...</div>
    );
  }

  return (
    <div className="app">
      {showAdminDashboard && authToken ? (
        <AdminDashboard authToken={authToken} onSignOut={handleSignOut}
          onReturnToHotels={() => setShowAdminDashboard(false)} />
      ) : (
        <>
          {/* Keep the existing customer header, main content and footer here. */}

          {/* Header */}
          <header className="site-header">
            <a className="brand" href="#home" aria-label="Miami Hotels home">Miami Hotels</a>

            <nav className="desktop-navigation" aria-label="Main navigation">
              <a href="#branches">Branches</a>
              <a href="#favourites" title="Favourites feature to be added">Favourites</a>
              <a href="#bookings" onClick={() => {
                if (!authToken) {
                  setIsAuthModalOpen(true);
                  return;
                }
                setShowMyBookings(true);
              }}>My Bookings</a>
              <button type="button" className="auth-nav-button" onClick={() => {
                if (authToken) {
                  handleSignOut();
                } else {
                  setIsAuthModalOpen(true);
                }
              }}>{authToken ? 'Sign out' : 'Sign in'}</button>
            </nav>

            {/* The profile circle */}
            <button className="profile-avatar" type="button" aria-label={authToken ? 'Sign out' : 'Open sign-in'}
              title={authToken ? 'Sign out' : 'Sign in'} onClick={() => {
                if (authToken) {
                  handleSignOut();
                } else {
                  setIsAuthModalOpen(true);
                }
              }}>{authToken ? 'Out' : 'Me'}</button>
          </header>

          <main id="home">
            {/* Hero section */}
            <section className="hero">

              <div className="hero-content">
                <h1>Find your next stay across South Africa</h1>
                <p>Explore our branches, compare rooms and book with confidence.</p>

                {/* fields sit in one row on desktop and wrap into rows on smaller screens. */}
                <form className="search-form" onSubmit={handleSearch}>
                  <label className="form-field destination-field">
                    <span>Destination / province</span>
                    <input type="text" value={destination} onChange={(event) => setDestination(event.target.value)}
                      placeholder="Choose branch or province" />
                  </label>

                  <label className="form-field">
                    <span>Check-in</span>
                    <input type="date" min={new Date().toLocaleDateString('en-CA')} value={checkIn} onChange={(event) =>
                      setCheckIn(event.target.value)} aria-label="Check-in date" />
                  </label>

                  <label className="form-field">
                    <span>Check-out</span>
                    <input type="date" min={checkIn || new Date().toLocaleDateString('en-CA')} value={checkOut} onChange={(event) =>
                      setCheckOut(event.target.value)} aria-label="Check-out date" />
                  </label>


                  <label className="form-field guests-field">
                    <span>Guests &amp; rooms</span>
                    <select value={guestsAndRooms} onChange={(event) => {
                      // Read the selected option and separate its guest and room counts.
                      const selectedOption = event.target.value;
                      const guestMatch = selectedOption.match(/^(\d+)\s+guests?/);
                      const roomMatch = selectedOption.match(/(\d+)\s+rooms?$/);

                      // Update each value only when the matching number is found.
                      if (guestMatch) {
                        setGuests(Number(guestMatch[1]));
                      }

                      if (roomMatch) {
                        setRooms(Number(roomMatch[1]));
                      }
                    }}>
                      <option value="1 guest • 1 room">1 guest • 1 room</option>
                      <option value="2 guests • 1 room">2 guests • 1 room</option>
                      <option value="3 guests • 1 room">3 guests • 1 room</option>
                      <option value="4 guests • 1 room">4 guests • 1 room</option>
                      <option value="2 guests • 2 rooms">2 guests • 2 rooms</option>
                      <option value="4 guests • 2 rooms">4 guests • 2 rooms</option>
                    </select>
                  </label>

                  <button className="primary-button search-button" type="submit">Search</button>
                  {/* Shows validation feedback when the search details are invalid. */}
                  {searchError && (<p className="search-error" role="alert">{searchError}</p>)}
                </form>
              </div>
            </section>
            {showMyBookings ? (
              <MyBookings authToken={authToken!} onBackToHotels={() => setShowMyBookings(false)} />
            ) : (<></>)}
            {/* Branches are loaded from PostgreSQL through the existing API */}
            <section className="branches-section" id="branches">
              <div className="section-heading">
                <h2>Explore our branches</h2>
                <p>Find a Miami Hotels branch for your next stay.</p>
              </div>

              {isLoading && (
                <p className="status-message" role="status">Loading hotel branches…</p>
              )}

              {!isLoading && errorMessage && (
                <div className="error-message" role="alert">
                  <p>Unable to load hotel listings.</p>
                  <p>{errorMessage}</p>
                  <button className="secondary-button" type="button" onClick={() => setRetryCount((count) => count + 1)}>Try again</button>
                </div>
              )}

              {!isLoading && !errorMessage && branches.length === 0 && (
                <div className="empty-message">
                  <h3>No branches found</h3>
                  <p>Try another destination or clear your search.</p>
                  <button className="secondary-button" type="button" onClick={() => { setDestination(''); setSubmittedDestination(''); }}>View all branches</button>
                </div>
              )}

              {!isLoading && !errorMessage && branches.length > 0 && (
                <div className="branch-grid">
                  {branches.map((branch) => (
                    <article className="branch-card" key={branch.id}>
                      <img className="branch-image" src={branch.image_url || 'https://placehold.co/800x500?text=Miami+Hotels'}
                        alt={`${branch.name} branch`} loading="lazy" onError={(event) => {
                          // Show a fallback image if the saved image URL fails.
                          event.currentTarget.onerror = null;
                          event.currentTarget.src = 'https://placehold.co/800x500?text=Miami+Hotels';
                        }} />

                      <div className="branch-card-content">
                        <h3>{branch.name}</h3>
                        <p className="branch-location">{branch.city}, {branch.country}</p>

                        <p className="branch-price">
                          {branch.minimum_price ? `From ${formatPrice(branch.minimum_price)} / night`
                            : 'Check dates for price'}</p>

                        <div className="branch-card-footer">
                          <span className="branch-rating">
                            <span aria-hidden="true">★</span>{' '} {branch.star_rating ?
                              Number(branch.star_rating).toFixed(1) : 'Not rated'}</span>

                          <button className="text-button" type="button" onClick={() => void handleViewRooms(branch.id)}
                            aria-expanded={selectedBranchId === branch.id}>{selectedBranchId === branch.id ?
                              'Hide details' : 'View rooms'}</button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}

              {/* Branch details modal */}
              {selectedBranchId !== null && (
                <div className="branch-modal-backdrop" onMouseDown={(event) => {
                  // Close only when the backdrop itself is clicked.
                  if (event.target === event.currentTarget) {
                    closeBranchModal();
                  }
                }}>

                  <section className="branch-modal" role="dialog" aria-modal="true" aria-labelledby="branch-modal-title">
                    <div className="branch-modal-header">
                      <div>
                        <h3 id="branch-modal-title">{branchDetails?.name ?? 'Hotel branch details'}</h3>
                        <p>Explore the branch and its room types.</p>
                      </div>

                      <button type="button" className="branch-modal-close" onClick={closeBranchModal}
                        aria-label="Close branch details">&times;</button>
                    </div>

                    <div className="branch-modal-content">
                      {isLoadingDetails && (<p role="status">Loading branch details…</p>)}
                      {detailsError && (<p className="error-text" role="alert">{detailsError}</p>)}
                      {branchDetails && !isLoadingDetails && (
                        <>
                          <p><strong>Address:</strong>{' '}
                            {branchDetails.address}, {branchDetails.city}</p>
                          {branchDetails.description && (<p>{branchDetails.description}</p>)}

                          <h4>Available room types</h4>
                          {branchDetails.room_types.length === 0 ? (
                            <p>No room types are listed for this branch yet.</p>
                          ) : (
                            <ul className="room-list">{branchDetails.room_types.map((room) => {
                              const isSelected = selectedRoomId === room.id;

                              return (
                                <li key={room.id} className={isSelected ? 'room-card room-card-selected' : 'room-card'}
                                  aria-label={`${room.name}${isSelected ? ', selected' : ''}`}>
                                  <span><strong>{room.name}</strong><small>Up to {room.capacity} guests</small></span>

                                  {isSelected && (<span className="room-selection-status" role="status">Selected</span>)}
                                  <span className="room-price">{formatPrice(room.price_per_night)} / night</span>

                                  <button type="button" className="select-room-button" onClick={() => setSelectedRoomId(room.id)}
                                    aria-pressed={isSelected} disabled={guests > room.capacity} title={guests > room.capacity
                                      ? `This room accommodates up to ${room.capacity} guests` : 'Select this room type'}>
                                    {guests > room.capacity ? 'Exceeds Guest Capacity' : isSelected ? 'Room Selected' : 'Select Room'}
                                  </button>
                                </li>
                              );
                            })}
                            </ul>
                          )}

                          {/* Booking summary appears after a room type is selected. */}
                          {selectedRoom && (
                            <section className="booking-summary">
                              <h4>Your stay summary</h4>

                              <div className="booking-summary-row">
                                <span>Hotel branch</span>
                                <strong>{branchDetails.name}</strong>
                              </div>

                              <div className="booking-summary-row">
                                <span>Room type</span>
                                <strong>{selectedRoom.name}</strong>
                              </div>
                              {/* Warns the customer if the selected room is too small. */}
                              {exceedsRoomCapacity && (<p className="error-text" role="alert">This room accommodates up to {selectedRoom.capacity} guests.
                                You have selected {guests} guests. Please choose a suitable room type.</p>)}

                              <div className="booking-summary-row">
                                <span>Check-in</span>
                                <strong>{checkIn || 'Not selected'}</strong>
                              </div>

                              <div className="booking-summary-row">
                                <span>Check-out</span>
                                <strong>{checkOut || 'Not selected'}</strong>
                              </div>

                              <div className="booking-summary-row">
                                <span>Guests and rooms</span>
                                <strong>{guestsAndRooms}</strong>
                              </div>

                              {/* Reminds the customer to complete the stay dates. */}
                              {(!checkIn || !checkOut || stayNights <= 0) && (<p className="booking-summary-note" role="status">Select valid check-in
                                and check-out dates to calculate your estimated stay total.</p>)}


                              <div className="booking-summary-row">
                                <span>Price per room / night</span>
                                <strong>{formatPrice(selectedRoom.price_per_night)}</strong>
                              </div>

                              {stayNights > 0 && (
                                <>
                                  <div className="booking-summary-row">
                                    <span>Length of stay</span>
                                    <strong>{stayNights} {stayNights === 1 ? 'night' : 'nights'}</strong>
                                  </div>

                                  <div className="booking-summary-total">
                                    <span>Estimated total</span>
                                    <strong>{formatPrice(estimatedTotal)}</strong>
                                  </div>
                                </>
                              )}
                              <p className="booking-summary-note">This is an estimate, not a confirmed reservation.
                                Final pricing and room availability must be verified before booking.</p>
                              {/* Booking submission feedback */}
                              {bookingMessage && (<p className={bookingError ? 'error-text' : 'booking-success-message'}
                                role={bookingError ? 'alert' : 'status'}>{bookingMessage}</p>)}

                              {/* Submit the selected room booking */}
                              <button type="button" className="primary-button" onClick={() => void handleBooking()}
                                disabled={isBooking || isLoadingDetails || !checkIn || !checkOut || stayNights <= 0 ||
                                  exceedsRoomCapacity}>{isBooking ? 'Submitting booking…' : 'Book this room'}</button>
                            </section>
                          )}
                        </>
                      )}
                    </div>
                  </section>
                </div>
              )}

              {/* View all branches control on mobile */}
              {branches.length > 0 && (<button className="secondary-button view-all-button" type="button" onClick={() => {
                setDestination(''); setSubmittedDestination('');
              }}>View all branches</button>)}
            </section>

            {/* benefits section */}
            <section className="why-stay-section" id="why-us">
              <h2>Why stay with us?</h2>
              <p>Comfortable rooms <span>•</span> On-site dining <span>•</span>{' '}
                Convenient locations <span>•</span> Friendly service</p>
            </section>
          </main>

          <footer className="site-footer">
            <nav aria-label="Footer navigation">
              <a href="#contact">Contact</a>
              <span>•</span>
              <a href="#help">Help</a>
              <span>•</span>
              <a href="#terms">Terms</a>
              <span>•</span>
              <a href="#privacy">Privacy</a>
            </nav>
          </footer>
        </>
      )}

      {isAuthModalOpen && (<AuthModal onClose={() => setIsAuthModalOpen(false)} onAuthenticated={handleAuthenticated} />)}
    </div>
  );
}

export default App;
