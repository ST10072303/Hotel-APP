import { useEffect, useState } from 'react';
import './App.css';

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
  policies: {id: string; policy_type: string; title: string; description: string;}[];
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
function formatPrice(price: string | null): string {
  if (price === null || price === '') {
    return 'Check dates for price';
  }

  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR',
    maximumFractionDigits: 0}).format(Number(price));
}

function App() {
  // Branches returned by the existing backend.
  const [branches, setBranches] = useState<Accommodation[]>([]);

  // These states help us give feedback while the API request is running or when something goes wrong.
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  // Search input and destination submitted by the user are separate
  // means we don't send a request for every character typed
  const [destination, setDestination] = useState('');
  const [submittedDestination, setSubmittedDestination] = useState('');

  // Changing this value lets the user retry a failed API request.
  const [retryCount, setRetryCount] = useState(0);

  // Values used by the search form
  // Date availability filtering
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guestsAndRooms, setGuestsAndRooms] = useState('2 guests • 1 room');

  // State for loading and displaying details when "View rooms" is clicked.
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [branchDetails, setBranchDetails] = useState<AccommodationDetails | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState('');

  // Load the branches from the backend.
  // This runs when the page first opens and when a new search is submitted.
  useEffect(() => {const controller = new AbortController();
    async function loadBranches() {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const params = new URLSearchParams();

        // The current API searches accommodation names and cities.
        // If user enters "Polokwane, Limpopo", use "Polokwane"
        // the request matches the fields currently supported by the API.
        const searchTerm = submittedDestination.split(',')[0].trim();

        if (searchTerm) {
          params.set('search', searchTerm);
        }

        // Ask for up to 100 results, using the API's supported page limit.
        params.set('page', '1');
        params.set('limit', '50');

        const queryString = params.toString();
        const url = `${API_BASE_URL}/api/accommodations?${queryString}`;

        const response = await fetch(url, {signal: controller.signal});

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
  function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedDestination(destination.trim());
  }

  // Load room information from the existing detail endpoint
  async function handleViewRooms(branchId: string) {
    // Clicking the same branch again closes its details.
    if (selectedBranchId === branchId) {
      setSelectedBranchId(null);
      setBranchDetails(null);
      setDetailsError('');
      return;
    }

    setSelectedBranchId(branchId);
    setBranchDetails(null);
    setDetailsError('');
    setIsLoadingDetails(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/accommodations/${branchId}`);

      if (!response.ok) {
        throw new Error(`Unable to load branch details (${response.status}).`);
      }

      const result = (await response.json()) as AccommodationDetailsResponse;

      setBranchDetails(result.data);
    } catch (error) {
      setDetailsError(error instanceof Error ? error.message : 'Unable to load room details.');
    } finally {
      setIsLoadingDetails(false);
    }
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="site-header">
        <a className="brand" href="#home" aria-label="Miami Hotels home">Miami Hotels</a>

        <nav className="desktop-navigation" aria-label="Main navigation">
          <a href="#branches">Branches</a>
          <a href="#favourites" title="Favourites feature to be added">Favourites</a>
          <a href="#bookings" title="My bookings feature to be added">My Bookings</a>
          <a href="#sign-in" title="Sign-in screen to be added">Sign in</a>
        </nav>

        {/* The profile circle */}
        <button className="profile-avatar" type="button" aria-label="Open profile (to be added)"
          title="Profile feature to be added">Me</button>
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
                  placeholder="Choose branch or province"/>
              </label>

              <label className="form-field">
                <span>Check-in</span>
                <input type="date" value={checkIn} onChange={(event) => setCheckIn(event.target.value)}
                  aria-label="Check-in date"/>
              </label>

              <label className="form-field">
                <span>Check-out</span>
                <input type="date" min={checkIn || undefined} value={checkOut} onChange={(event) => 
                setCheckOut(event.target.value)} aria-label="Check-out date"/>
              </label>

              <label className="form-field guests-field">
                <span>Guests &amp; rooms</span>
                <select value={guestsAndRooms} onChange={(event) => setGuestsAndRooms(event.target.value)}>
                  <option>1 guest • 1 room</option>
                  <option>2 guests • 1 room</option>
                  <option>3 guests • 1 room</option>
                  <option>4 guests • 1 room</option>
                  <option>2 guests • 2 rooms</option>
                  <option>4 guests • 2 rooms</option>
                </select>
              </label>

              <button className="primary-button search-button" type="submit">Search</button>
            </form>
          </div>
        </section>

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
              <button className="secondary-button" type="button" onClick={() =>
               {setDestination(''); setSubmittedDestination('');}}>View all branches</button>
            </div>
          )}

          {!isLoading && !errorMessage && branches.length > 0 && (
            <div className="branch-grid">
              {branches.map((branch) => (
                <article className="branch-card" key={branch.id}>
                  <img className="branch-image" src={branch.image_url ||'https://placehold.co/800x500?text=Miami+Hotels'}
                    alt={`${branch.name} branch`} loading="lazy"onError={(event) => {
                      // Show a fallback image if the saved image URL fails.
                      event.currentTarget.onerror = null;
                      event.currentTarget.src = 'https://placehold.co/800x500?text=Miami+Hotels';}}/>

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

                  {/* Expanded details from GET /api/accommodations/:id. */}
                  {selectedBranchId === branch.id && (
                    <div className="branch-details">
                      {isLoadingDetails && (<p role="status">Loading branch details…</p>)}

                      {detailsError && (<p className="error-text" role="alert">{detailsError}</p>)}

                      {branchDetails && !isLoadingDetails && (
                        <>
                          <p><strong>Address:</strong> {branchDetails.address},{' '}{branchDetails.city}</p>
                          {branchDetails.description && (<p>{branchDetails.description}</p>)}

                          <h4>Available room types</h4>
                          {branchDetails.room_types.length === 0 ? (
                            <p>No room types are listed for this branch yet.</p>
                          ) : (
                            <ul className="room-list">
                              {branchDetails.room_types.map((room) => (
                                <li key={room.id}>
                                  <span>
                                    <strong>{room.name}</strong>
                                    <small>Up to {room.capacity} guests</small>
                                  </span>
                                  <span className="room-price">{formatPrice(room.price_per_night)} / night</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}

          {/* View all branches control on mobile */}
          {branches.length > 0 && (
            <button className="secondary-button view-all-button" type="button" onClick={() => {
                setDestination(''); setSubmittedDestination('');}}>View all branches</button>
          )}
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
    </div>
  );
}

export default App;
