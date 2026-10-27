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
    description: string | null;
    address: string;
    city: string;
    country: string;
    star_rating: string | null;
    is_active?: boolean;
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

export function AdminDashboard({ authToken, onSignOut, onReturnToHotels }: AdminDashboardProps) {
    const [activeSection, setActiveSection] = useState<AdminSection>('Dashboard');
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [branches, setBranches] = useState<Accommodation[]>([]);
   
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');
    // Controls the Add Branch form.
    const [showBranchForm, setShowBranchForm] = useState(false);

    // Stores the branch details entered by the administrator.
    const [branchForm, setBranchForm] = useState({
        name: '', description: '',
        address: '', city: '', country: 'South Africa', star_rating: ''
    });

    // Tracks form submission and displays feedback.
    const [isSavingBranch, setIsSavingBranch] = useState(false);
    const [branchMessage, setBranchMessage] = useState('');
    const [branchError, setBranchError] = useState(false);

    // Verify the session with the backend before loading admin information.
    useEffect(() => {
        const controller = new AbortController();

        async function loadAdminData() {
            setIsLoading(true);
            setErrorMessage('');

            try {
                const profileResponse = await fetch(`${API_BASE_URL}/api/auth/me`,
                    { headers: { Authorization: `Bearer ${authToken}` }, signal: controller.signal }
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
                    { headers: { Authorization: `Bearer ${authToken}` }, signal: controller.signal }
                );

                const branchResult = (await branchResponse.json()) as ApiResponse<Accommodation[]>;

                if (!branchResponse.ok || !branchResult.success) {
                    throw new Error(branchResult.message || 'Unable to load hotel branches.');
                }

                setBranches(branchResult.data);

                // The existing customer booking endpoint is not an admin report.
                // We will connect the reservations overview after adding a suitable
                // admin-only reporting endpoint on the backend.
                
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

    async function handleCreateBranch(
        event: React.FormEvent<HTMLFormElement>,
    ) {
        event.preventDefault();
        setBranchMessage('');
        setBranchError(false);

        if (!branchForm.name.trim() || !branchForm.address.trim() ||
            !branchForm.city.trim() || !branchForm.country.trim()) {
            setBranchMessage('Please complete all required fields.');
            setBranchError(true);
            return;
        }

        setIsSavingBranch(true);

        try {
            const response = await fetch(`${API_BASE_URL}/api/accommodations`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
                    body: JSON.stringify({
                        name: branchForm.name.trim(),
                        description: branchForm.description.trim() || null,
                        address: branchForm.address.trim(),
                        city: branchForm.city.trim(),
                        country: branchForm.country.trim(),
                        star_rating: branchForm.star_rating
                            ? Number(branchForm.star_rating)
                            : null
                    })
                }
            );

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(
                    result.message || 'Unable to create the hotel branch.',
                );
            }

            // Add the newly created branch to the displayed list.
            const createdBranch = result.data as Accommodation;
            setBranches((currentBranches) => [...currentBranches, createdBranch]);
            setBranchMessage('Hotel branch created successfully.');
            setBranchError(false);

            // Reset the form after a successful save.
            setBranchForm({
                name: '', description: '', address: '', city: '',
                country: 'South Africa', star_rating: ''
            });

            setShowBranchForm(false);
        } catch (error) {
            setBranchMessage(error instanceof Error ? error.message : 'Unable to create the hotel branch.');
            setBranchError(true);
        } finally {
            setIsSavingBranch(false);
        }
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

                    </>
                )}

                {activeSection === 'Branches & Rooms' && (
                    <section className="admin-content-card">

                        <div className="admin-card-heading">
                            <div>
                                <h2>Hotel branches</h2>
                                <p>Manage the hotel branches operated by Miami Hotels.</p>
                            </div>

                            <button type="button" className="admin-add-button" onClick={() => {
                                    setBranchMessage('');
                                    setBranchError(false);
                                    setShowBranchForm((visible) => !visible);
                                }}>{showBranchForm ? 'Cancel' : '+ Add branch'}</button>
                        </div>

                        {branchMessage && (
                            <p className={branchError ? 'admin-form-error' : 'admin-form-success'}
                                role={branchError ? 'alert' : 'status'}>{branchMessage}</p>
                        )}

                        {showBranchForm && (
                            <form className="admin-branch-form" onSubmit={handleCreateBranch}>
                                <h3>New hotel branch</h3>

                                <label>Branch name * <input value={branchForm.name} onChange={(event) =>
                                        setBranchForm({ ...branchForm, name: event.target.value })}
                                        minLength={2} maxLength={150} required/>
                                </label>

                                <label>Street address * <input value={branchForm.address} onChange={(event) =>
                                        setBranchForm({ ...branchForm, address: event.target.value })
                                        }minLength={2} maxLength={255}required/>
                                </label>

                                <div className="admin-form-grid">
                                    <label>City * <input value={branchForm.city} onChange={(event) =>
                                        setBranchForm({ ...branchForm, city: event.target.value })}
                                        minLength={2} maxLength={100} required/>
                                    </label>

                                    <label>Country * <input value={branchForm.country} onChange={(event) =>
                                        setBranchForm({ ...branchForm, country: event.target.value })}
                                        minLength={2} maxLength={100} required/>
                                    </label>

                                    <label>Star rating <select value={branchForm.star_rating} onChange={(event) =>
                                            setBranchForm({...branchForm, star_rating: event.target.value})}>
                                            <option value="">Not rated</option>
                                            <option value="1">1 star</option>
                                            <option value="2">2 stars</option>
                                            <option value="3">3 stars</option>
                                            <option value="4">4 stars</option>
                                            <option value="5">5 stars</option>
                                        </select>
                                    </label>
                                </div>

                                <label>Description<textarea value={branchForm.description} onChange={(event) =>
                                        setBranchForm({...branchForm, description: event.target.value})}
                                        maxLength={2000} rows={3}/>
                                </label>

                                <button type="submit" className="admin-add-button" disabled={isSavingBranch}>
                                    {isSavingBranch ? 'Saving branch…' : 'Save branch'}</button>
                            </form>
                        )}

                        <div className="admin-branch-list">
                            {branches.length === 0 ? (
                                <p className="admin-empty-message">No active hotel branches were returned.</p>
                            ) : (
                                branches.map((branch) => (
                                    <article className="admin-branch-row" key={branch.id}>
                                        <div>
                                            <strong>{branch.name}</strong>
                                            <span>{branch.city}, {branch.country}</span>
                                        </div>
                                        <span className="admin-status-active">Active</span>
                                    </article>
                                ))
                            )}
                        </div>
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
