import { useEffect, useState } from 'react';
import './AdminDashboard.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

interface AdminDashboardProps {
  authToken: string;
  onSignOut: () => void;
  onReturnToHotels: () => void;
}

interface Accommodation {
  id: string;
  name: string;
  city: string;
  country: string;
  is_active?: boolean;
}

interface Booking {
  id?: string;
  booking_reference?: string;
  full_name?: string;
  guest_name?: string;
  accommodation_name?: string;
  check_in?: string;
  check_out?: string;
  status?: string;
}

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  role: 'customer' | 'admin';
}

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

type AdminSection = 'Dashboard' | 'Branches & Rooms' | 'Reservations' | 'Payments';

export function AdminDashboard({authToken, onSignOut, onReturnToHotels}: AdminDashboardProps) {
  const [activeSection, setActiveSection] = useState<AdminSection>('Dashboard');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [branches, setBranches] = useState<Accommodation[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  // Verify the session with the backend before loading admin information.
  useEffect(() => {
    const controller = new AbortController();

    async function loadAdminData() {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const profileResponse = await fetch(`${API_BASE_URL}/api/auth/me`,
          {headers: {Authorization: `Bearer ${authToken}`}, signal: controller.signal}
        );

        const profileResult = (await profileResponse.json()) as ApiResponse<UserProfile>;

        if (!profileResponse.ok || !profileResult.success) {
          throw new Error(profileResult.message || 'Unable to verify your account.');
        }

        // A customer should not be allowed into the admin interface.
        if (profileResult.data.role !== 'admin') {
          throw new Error('Administrator access is required.');
        }

        setProfile(profileResult.data);

        // Load active hotel branches using the existing API.
        const branchResponse = await fetch(
          `${API_BASE_URL}/api/accommodations?page=1&limit=100`,
          {headers: {Authorization: `Bearer ${authToken}`}, signal: controller.signal}
        );

        const branchResult = (await branchResponse.json()) as ApiResponse<Accommodation[]>;

        if (!branchResponse.ok || !branchResult.success) {
          throw new Error(branchResult.message || 'Unable to load hotel branches.');
        }

        setBranches(branchResult.data);

        // The existing customer booking endpoint is not an admin report.
        // We will connect the reservations overview after adding a suitable
        // admin-only reporting endpoint on the backend.
        setBookings([]);
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : 'Unable to load the admin dashboard.');
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadAdminData();

    return () => controller.abort();
  }, [authToken]);

  const navigationItems: AdminSection[] = ['Dashboard', 'Branches & Rooms', 'Reservations', 'Payments'];

  if (isLoading) {
    return (
      <main className="admin-loading" role="status">Verifying administrator access…</main>
    );
  }

  if (errorMessage || profile?.role !== 'admin') {
    return (
      <main className="admin-access-error">
        <h1>Admin access unavailable</h1>
        <p role="alert">{errorMessage || 'Administrator access is required.'}</p>
        <div className="admin-error-actions">
          <button type="button" onClick={onReturnToHotels}>Return to hotels</button>
          <button type="button" onClick={onSignOut}>Sign out</button>
        </div>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span className="admin-brand-kicker">MIAMI HOTELS</span>
          <h2>HOTEL ADMIN</h2>
          <p>Management portal</p>
        </div>

        <nav className="admin-navigation" aria-label="Admin navigation">
          {navigationItems.map((item) => (
            <button type="button" key={item} className={activeSection === item
                  ? 'admin-nav-item admin-nav-item-active' : 'admin-nav-item'}
              onClick={() => setActiveSection(item)}
              aria-current={activeSection === item ? 'page' : undefined}>{item}</button>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <span>{profile.full_name}</span>
          <button type="button" onClick={onSignOut}>Sign out</button>
        </div>
      </aside>

      <section className="admin-main-panel">
        <header className="admin-topbar">
          <div>
            <p className="admin-breadcrumb">Admin / {activeSection}</p>
            <h1> {activeSection === 'Dashboard' ? 'Bookings overview' : activeSection === 'Branches & Rooms'
                  ? 'Branch & Room Management' : activeSection}</h1>
          </div>

          <button type="button" className="admin-customer-link" onClick={onReturnToHotels}>Return to hotels</button>
        </header>

        {activeSection === 'Dashboard' && (
          <>
            <section className="admin-stat-grid" aria-label="Booking summary">
              <article className="admin-stat-card">
                <span>Hotel branches</span>
                <strong>{branches.length}</strong>
              </article>

              <article className="admin-stat-card">
                <span>Upcoming bookings</span>
                <strong>—</strong>
              </article>

              <article className="admin-stat-card">
                <span>Pending reservations</span>
                <strong>—</strong>
              </article>
            </section>

            <section className="admin-content-card">
              <div className="admin-card-heading">
                <div>
                  <h2>Recent reservations</h2>
                  <p>Reservation information will appear here when the admin report API is connected.</p>
                </div>
              </div>

              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Guest / Reference</th>
                      <th>Branch</th>
                      <th>Dates</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.length === 0 && (
                      <tr>
                        <td colSpan={4} className="admin-empty-cell">
                          Reservation reporting is not connected yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {activeSection === 'Branches & Rooms' && (
          <section className="admin-content-card">
            <div className="admin-card-heading">
              <div>
                <h2>Hotel branches</h2>
                <p>Active branches currently returned by the hotel API.</p>
              </div>
              <span className="admin-count-pill">
                {branches.length} branches
              </span>
            </div>

            {branches.length === 0 ? (
              <p className="admin-empty-message">No active hotel branches were returned.</p>
            ) : (
              <div className="admin-branch-list">
                {branches.map((branch) => (
                  <article className="admin-branch-row" key={branch.id}>
                    <div>
                      <strong>{branch.name}</strong>
                      <span>
                        {branch.city}, {branch.country}
                      </span>
                    </div>
                    <span className="admin-status-active">Active</span>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {activeSection === 'Reservations' && (
          <section className="admin-content-card">
            <h2>Reservations</h2>
            <p>The administrator reservation list needs a dedicated, admin-protected backend endpoint.</p>
          </section>
        )}

        {activeSection === 'Payments' && (
          <section className="admin-content-card">
            <h2>Payments</h2>
            <p>Payment reporting will be added after the reservation management feature.</p>
          </section>
        )}
      </section>
    </main>
  );
}
