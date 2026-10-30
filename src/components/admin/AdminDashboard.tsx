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

// Represents a room type returned by the room-management API.
interface RoomType {
    id: string;
    accommodation_id: string;
    name: string;
    description: string | null;
    capacity: number;
    price_per_night: string;
    total_units: number;
    is_active: boolean;
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
    // Tracks whether the saved login session is being verified.
    const [activeSection, setActiveSection] = useState<AdminSection>('Dashboard');
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [branches, setBranches] = useState<Accommodation[]>([]);

    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');
    // Controls the Add Branch form.
    const [showBranchForm, setShowBranchForm] = useState(false);
    // Stores the ID of the branch currently being edited.
    // null value means we are creating a new branch.
    const [editingBranchId, setEditingBranchId] = useState<string | null>(null);

    // Stores the branch details entered by the administrator.
    const [branchForm, setBranchForm] = useState({
        name: '', description: '',
        address: '', city: '', country: 'South Africa', star_rating: ''
    });

    // Stores room types belonging to the selected hotel branch.
    const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);

    // Tracks which branch the administrator is viewing.
    const [selectedBranchId, setSelectedBranchId] = useState('');

    // Tracks room-loading progress and errors.
    const [isLoadingRooms, setIsLoadingRooms] = useState(false);
    const [roomError, setRoomError] = useState('');

    // Stores the ID of the room type currently being edited.
    // null means the form is used to create a new room type.
    const [editingRoomTypeId, setEditingRoomTypeId] = useState<string | null>(null);

    // Tracks form submission and displays feedback.
    const [isSavingBranch, setIsSavingBranch] = useState(false);
    const [branchMessage, setBranchMessage] = useState('');
    const [branchError, setBranchError] = useState(false);

    // Controls whether the add/edit room form is visible.
    const [showRoomForm, setShowRoomForm] = useState(false);

    // Stores the room form field values.
    const [roomForm, setRoomForm] = useState({
        name: "", description: "", capacity: "2",
        price_per_night: "", total_units: "1"
    });

    // Tracks whether a room is being saved.
    const [isSavingRoom, setIsSavingRoom] = useState(false);

    // Stores success or error feedback for the room form.
    const [roomFormMessage, setRoomFormMessage] = useState("");
    const [roomFormError, setRoomFormError] = useState(false);

    // Opens the room form and fills it with the selected room's details.
    const startEditingRoomType = (room: RoomType) => {
        setEditingRoomTypeId(room.id);

        // Populate the form with the existing room values.
        setRoomForm({
            name: room.name, description: room.description ?? "",
            capacity: String(room.capacity), price_per_night: String(room.price_per_night),
            total_units: String(room.total_units)
        });

        // Clear previous feedback before editing.
        setRoomFormMessage("");
        setRoomFormError(false);

        // Display the form in edit mode.
        setShowRoomForm(true);
    };




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
                const branchResponse = await fetch(`${API_BASE_URL}/api/accommodations?page=1&limit=100`,
                    { headers: { Authorization: `Bearer ${authToken}` }, signal: controller.signal });

                const branchResult = (await branchResponse.json()) as ApiResponse<Accommodation[]>;

                if (!branchResponse.ok || !branchResult.success) {
                    throw new Error(branchResult.message || 'Unable to load hotel branches.');
                }
                setBranches(branchResult.data);

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
        return (<main className="admin-loading" role="status">Verifying administrator access…</main>);
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

    // Opens the branch form and fills it with the selected branch's details.
    const startEditingBranch = (branch: Accommodation) => {
        setEditingBranchId(branch.id);
        setBranchForm({
            name: branch.name, description: branch.description ?? '',
            address: branch.address, city: branch.city, country: branch.country,
            star_rating: branch.star_rating ?? ''
        });

        setBranchMessage('');
        setBranchError(false);
        setErrorMessage('');
        setShowBranchForm(true);
    };


    const handleCreateBranch = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        setIsSavingBranch(true);
        setBranchMessage('');
        setBranchError(false);

        const payload = {
            name: branchForm.name.trim(), description: branchForm.description.trim() || null,
            address: branchForm.address.trim(), city: branchForm.city.trim(),
            country: branchForm.country.trim(), star_rating: branchForm.star_rating
                ? Number(branchForm.star_rating) : null
        };

        // Editing uses PUT; creating a new branch uses POST.
        const isEditing = editingBranchId !== null;

        const url = isEditing ? `${API_BASE_URL}/api/accommodations/${editingBranchId}`
            : `${API_BASE_URL}/api/accommodations`;

        try {
            const response = await fetch(url, {
                method: isEditing ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
                body: JSON.stringify(payload)
            });

            const result: ApiResponse<Accommodation> = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || `Unable to ${isEditing ? 'update' : 'create'} the hotel branch.`);
            }

            if (isEditing) {
                // Update only the branch that was edited.
                setBranches((currentBranches) =>
                    currentBranches.map((branch) =>
                        branch.id === result.data.id
                            ? { ...branch, ...result.data } : branch));

                setBranchMessage('Hotel branch updated successfully.');
            } else {
                // Add the newly created branch to the list.
                setBranches((currentBranches) => [...currentBranches, result.data,
                ]);
                setBranchMessage('Hotel branch created successfully.');
            }

            // Reset the form after a successful save.
            setBranchForm({
                name: '', description: '', address: '', city: '', country: 'South Africa',
                star_rating: ''
            });

            setEditingBranchId(null);
            setShowBranchForm(false);
        } catch (error) {
            setBranchError(true);

            setBranchMessage(error instanceof Error ? error.message
                : 'An unexpected error occurred while saving the branch.');
        } finally {
            setIsSavingBranch(false);
        }
    };


    const handleCreateRoomType = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!selectedBranchId) {
            setRoomFormError(true);
            setRoomFormMessage('Please select a hotel branch first.');
            return;
        }

        setIsSavingRoom(true);
        setRoomFormMessage('');
        setRoomFormError(false);

        const payload = {
            name: roomForm.name.trim(), description: roomForm.description.trim() || null,
            capacity: Number(roomForm.capacity), price_per_night: Number(roomForm.price_per_night),
            total_units: Number(roomForm.total_units)
        };

        const isEditing = editingRoomTypeId !== null;
        const url = isEditing ? `${API_BASE_URL}/api/rooms/${editingRoomTypeId}` : `${API_BASE_URL}/api/rooms`;

        try {
            const response = await fetch(url, {
                method: isEditing ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
                body: JSON.stringify(isEditing ? payload : { ...payload, accommodation_id: selectedBranchId })
            });

            const result: ApiResponse<RoomType> = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || `Unable to ${isEditing ? 'update' : 'create'} the room type.`);
            }

            if (isEditing) {
                setRoomTypes((currentRooms) => currentRooms.map((room) =>
                    room.id === result.data.id ? result.data : room)
                    .sort((a, b) => a.name.localeCompare(b.name))
                );

                setRoomFormMessage('Room type updated successfully.');
            } else {
                setRoomTypes((currentRooms) => [...currentRooms, result.data].sort((a, b) =>
                    a.name.localeCompare(b.name))
                );
                setRoomFormMessage('Room type created successfully.');
            }

            setRoomForm({ name: '', description: '', capacity: '2', price_per_night: '', total_units: '1' });
            setEditingRoomTypeId(null);
            setShowRoomForm(false);
        } catch (error) {
            setRoomFormError(true);
            setRoomFormMessage(error instanceof Error ? error.message : 'An unexpected error occurred while saving the room type.');
        } finally {
            setIsSavingRoom(false);
        }
    };




    // Loads active room types for the selected hotel branch.
    const handleViewRooms = async (branch: Accommodation) => {
        setSelectedBranchId(branch.id);
        setRoomTypes([]);
        setRoomError('');
        setIsLoadingRooms(true);

        try {
            const response = await fetch(`${API_BASE_URL}/api/rooms/branches/${branch.id}`,
                { method: 'GET', headers: { Authorization: `Bearer ${authToken}` } });

            const result: ApiResponse<RoomType[]> = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || 'Unable to load room types.');
            }

            setRoomTypes(result.data);
        } catch (error) {
            setRoomError(error instanceof Error ? error.message : 'An unexpected error occurred while loading room types.');
        } finally {
            setIsLoadingRooms(false);
        }
    };

    // Deactivates a hotel branch after administrator confirmation.
    // The backend preserves the branch record and its booking history.
    const handleDeactivateBranch = async (branch: Accommodation) => {
        const confirmed = window.confirm(
            `Are you sure you want to deactivate "${branch.name}"? This branch will no longer appear in the public hotel listings.`);

        if (!confirmed) {
            return;
        }

        setErrorMessage('');
        setBranchMessage('');
        setBranchError(false);

        try {
            const response = await fetch(`${API_BASE_URL}/api/accommodations/${branch.id}`,
                { method: 'DELETE', headers: { Authorization: `Bearer ${authToken}` } });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || 'Unable to deactivate the hotel branch.');
            }

            // Remove the deactivated branch from the active branch list.
            setBranches((currentBranches) =>
                currentBranches.filter((item) => item.id !== branch.id));

            setBranchMessage(`${branch.name} has been deactivated successfully.`);
        } catch (error) {
            setBranchError(true);

            setBranchMessage(error instanceof Error ? error.message
                : 'An unexpected error occurred while deactivating the branch.');
        }
    };

    // Deactivates a room type without permanently deleting it.
    const handleDeactivateRoomType = async (roomTypeId: string) => {
        // Ask the admin to confirm before deactivating the room.
        const confirmed = window.confirm("Are you sure you want to deactivate this room?");

        if (!confirmed) {
            return;
        }

        setRoomFormMessage("");
        setRoomFormError(false);

        try {
            const response = await fetch(`${API_BASE_URL}/api/rooms/${roomTypeId}`,
                { method: "DELETE", headers: { Authorization: `Bearer ${authToken}` } }
            );

            const result: ApiResponse<RoomType> = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || "Failed to deactivate room type.");
            }

            // Remove the deactivated room from the currently displayed active rooms.
            setRoomTypes((currentRooms) => currentRooms.filter((room) => room.id !== roomTypeId));
            setRoomFormMessage("Room type deactivated successfully.");
            setRoomFormError(false);

            // Close the edit form if this room was being edited.
            if (editingRoomTypeId === roomTypeId) {
                setShowRoomForm(false);
                setEditingRoomTypeId(null);
            }
        } catch (error) {
            setRoomFormError(true);
            setRoomFormMessage(error instanceof Error ? error.message
                : "An unexpected error occurred while deactivating the room type.");
        }
    };

    // Reactivates a previously deactivated room type.
    const handleActivateRoomType = async (roomTypeId: string) => {
        const confirmed = window.confirm("Are you sure you want to activate this room type?");

        if (!confirmed) {
            return;
        }

        setRoomFormMessage("");
        setRoomFormError(false);

        try {
            const response = await fetch(`${API_BASE_URL}/api/rooms/${roomTypeId}/activate`,
                { method: "PATCH", headers: { Authorization: `Bearer ${authToken}` } });

            const result: ApiResponse<RoomType> = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || "Failed to activate room type.");
            }

            // Update the room's status in the existing room list.
            setRoomTypes((currentRooms) =>
                currentRooms.map((room) => room.id === roomTypeId ? result.data : room));

            setRoomFormMessage("Room type activated successfully.");
            setRoomFormError(false);
        } catch (error) {
            setRoomFormError(true);
            setRoomFormMessage(error instanceof Error ? error.message
                : "An unexpected error occurred while activating the room type.");
        }
    };

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
            {/* header section */}
            <section className="admin-main-panel">
                <header className="admin-topbar">
                    <div>
                        <p className="admin-breadcrumb">Admin / {activeSection}</p>
                        <h1> {activeSection === 'Dashboard' ? 'Bookings overview' : activeSection === 'Branches & Rooms'
                            ? 'Branch & Room Management' : activeSection}</h1>
                    </div>

                    <button type="button" className="admin-customer-link" onClick={onReturnToHotels}>Return to hotels</button>
                </header>
                {/* dashboad */}
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

                        {/* Branch form */}
                        {showBranchForm && (
                            <form className="admin-branch-form" onSubmit={handleCreateBranch}>
                                <h3>{editingBranchId ? 'Edit hotel branch' : 'New hotel branch'}</h3>

                                <label>Branch name * <input value={branchForm.name} onChange={(event) =>
                                    setBranchForm({ ...branchForm, name: event.target.value })}
                                    minLength={2} maxLength={150} required />
                                </label>

                                <label>Street address * <input value={branchForm.address} onChange={(event) =>
                                    setBranchForm({ ...branchForm, address: event.target.value })
                                } minLength={2} maxLength={255} required />
                                </label>

                                <div className="admin-form-grid">
                                    <label>City * <input value={branchForm.city} onChange={(event) =>
                                        setBranchForm({ ...branchForm, city: event.target.value })}
                                        minLength={2} maxLength={100} required />
                                    </label>

                                    <label>Country * <input value={branchForm.country} onChange={(event) =>
                                        setBranchForm({ ...branchForm, country: event.target.value })}
                                        minLength={2} maxLength={100} required />
                                    </label>

                                    <label>Star rating <select value={branchForm.star_rating} onChange={(event) =>
                                        setBranchForm({ ...branchForm, star_rating: event.target.value })}>
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
                                    setBranchForm({ ...branchForm, description: event.target.value })}
                                    maxLength={2000} rows={3} />
                                </label>

                                <button type="submit" className="admin-save-button" disabled={isSavingBranch}> {isSavingBranch
                                    ? 'Saving...' : editingBranchId ? 'Save changes' : 'Save branch'}
                                </button>
                            </form>
                        )}

                        <div className="admin-branch-list">
                            {branches.length === 0 ? (
                                <p className="admin-empty-message">No active hotel branches were returned.</p>
                            ) : (
                                branches.map((branch) => (
                                    <article className="admin-branch-row" key={branch.id}>
                                        <div>
                                            <strong>{branch.name} </strong>
                                            <span>{branch.city}, {branch.country}</span>
                                            <span style={{ color: 'green' }}>Active</span>
                                        </div>

                                        <div className="admin-branch-actions">
                                            <button type="button" className="admin-edit-button"
                                                onClick={() => handleViewRooms(branch)}>View</button>
                                            <button type="button" className="admin-edit-button"
                                                onClick={() => startEditingBranch(branch)}>Edit</button>
                                            <button type="button" className="admin-deactivate-button"
                                                onClick={() => handleDeactivateBranch(branch)}>De-activate</button>
                                        </div>
                                    </article>
                                ))
                            )}
                        </div>

                        {selectedBranchId && (
                            <section className="admin-rooms-section">
                                <div className="admin-card-heading">
                                    <h2>Room types -{' '} {branches.find((branch) => branch.id === selectedBranchId)?.name}</h2>
                                    {/* Add Room Type button */}
                                    <button type="button" className="admin-add-button" onClick={() => {
                                        setEditingRoomTypeId(null);
                                        setRoomForm({ name: "", description: "", capacity: "2", price_per_night: "", total_units: "1" });
                                        setRoomFormMessage("");
                                        setRoomFormError(false);
                                        setShowRoomForm((previous) => !previous);
                                    }}>{showRoomForm ? 'Cancel' : '+ Add Room'}</button>
                                </div>

                                {/* Create or edit room form */}
                                {showRoomForm && (
                                    <form className="admin-branch-form" onSubmit={handleCreateRoomType}>
                                        <h3>{editingRoomTypeId ? "Edit room type" : "New room type"}</h3>

                                        <div className="admin-form-grid">
                                            <label>Room name
                                                <input type="text" value={roomForm.name} onChange={(event) =>
                                                    setRoomForm({ ...roomForm, name: event.target.value })} required
                                                    minLength={2} maxLength={150} placeholder="e.g. Standard Room" />
                                            </label>

                                            <label>Description
                                                <textarea value={roomForm.description} onChange={(event) =>
                                                    setRoomForm({ ...roomForm, description: event.target.value })}
                                                    maxLength={2000} placeholder="Describe the room" />
                                            </label>

                                            <label>Capacity
                                                <input type="number" value={roomForm.capacity} onChange={(event) =>
                                                    setRoomForm({ ...roomForm, capacity: event.target.value })}
                                                    min="1" step="1" required />
                                            </label>

                                            <label>Price per night (ZAR)
                                                <input type="number" value={roomForm.price_per_night} onChange={(event) =>
                                                    setRoomForm({ ...roomForm, price_per_night: event.target.value })}
                                                    min="0.01" step="0.01" required placeholder="850.00" />
                                            </label>

                                            <label>Total units
                                                <input type="number" value={roomForm.total_units} onChange={(event) =>
                                                    setRoomForm({ ...roomForm, total_units: event.target.value })}
                                                    min="1" step="1" required />
                                            </label>
                                        </div>

                                        <div className="admin-form-actions">
                                            <button type="button" className="admin-deactivate-button" onClick={() => {
                                                setShowRoomForm(false);
                                                setEditingRoomTypeId(null);
                                                setRoomFormMessage("");
                                                setRoomFormError(false);
                                            }}>Cancel</button><> </>

                                            <button type="submit" className="admin-save-button" disabled={isSavingRoom}>
                                                {isSavingRoom ? "Saving..." : editingRoomTypeId ? "Save " : "Save room"}
                                            </button>

                                        </div>
                                        {roomFormMessage && (<p className={roomFormError ? "admin-error" : "admin-success"}>
                                            {roomFormMessage}</p>)}
                                    </form>
                                )}

                                {isLoadingRooms && (<p role="status">Loading room types...</p>)}

                                {roomError && (<p className="admin-form-error" role="alert">{roomError}</p>)}

                                {!isLoadingRooms && !roomError && roomTypes.length === 0 && (
                                    <p className="admin-empty-message">No active room types were found for this branch.</p>)}

                                {!isLoadingRooms && !roomError && roomTypes.length > 0 && (
                                    <div className="admin-room-list">
                                        {roomTypes.map((room) => (
                                            <article className="admin-room-row" key={room.id}>
                                                <div className="admin-room-details">
                                                    <strong>{room.name}</strong>
                                                    <span>{room.description || 'No description available'}</span>
                                                    <span>Capacity: {room.capacity} guests</span>
                                                </div>

                                                <div className="price-unit-group">
                                                    <strong>
                                                        {Number(room.price_per_night).toLocaleString('en-ZA', { style: 'currency', currency: 'ZAR' })}
                                                    </strong>
                                                    <span>{room.total_units} units</span>
                                                </div>

                                                {/* Column 3: Action buttons on the far right */}
                                                <div className="admin-room-actions">
                                                    <button type="button" className="admin-edit-button"
                                                        onClick={() => startEditingRoomType(room)}>Edit</button>
                                                    {room.is_active ? (
                                                        <button type="button" className="admin-deactivate-button"
                                                            onClick={() => handleDeactivateRoomType(room.id)}>Deactivate</button>
                                                    ) : (
                                                        <button type="button" className="admin-save-button"
                                                            onClick={() => handleActivateRoomType(room.id)}>Activate</button>
                                                    )}
                                                </div>
                                            </article>
                                        ))}
                                    </div>
                                )}
                            </section>
                        )}

                    </section>
                )}

                {activeSection === 'Reservations' && (
                    <section className="admin-content-card">
                        <h2>Reservations</h2>
                        <p>The administrator reservation list needs admin permissions.</p>
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
