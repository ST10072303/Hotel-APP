import { useState, type FormEvent } from 'react';
import './AuthModal.css';

// Defines which authentication form is displayed.
type AuthMode = 'login' | 'register';

// Keep the API address consistent with the rest of the frontend.
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

// Describes the authentication response returned by the backend.
interface AuthResponse {
  success: boolean;
  message: string;
  data?: {token: string;
    user: {id: string; full_name: string; email: string; role: 'customer' | 'admin'};
  };
}

// Props allow the parent component to control the modal and authentication.
interface AuthModalProps {
  onClose: () => void;
  onAuthenticated: (token: string) => void;
}

// Authentication modal for customer login and registration.
export const AuthModal = ({onClose, onAuthenticated}: AuthModalProps) => {
  // Tracks whether the login or registration form is active.
  const [mode, setMode] = useState<AuthMode>('login');

  // Stores the values entered into the form.
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Controls the loading state and error feedback.
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Switch between login and registration forms.
  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setErrorMessage('');
    setPassword('');
    setConfirmPassword('');
  }

  // Validate the form and submit the authentication request.
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage('');

    // Validate the full name when registering.
    if (mode === 'register' && fullName.trim().length < 2) {
      setErrorMessage('Please enter your full name.');
      return;
    }

    // Validate the password length.
    if (password.length < (mode === 'register' ? 8 : 1)) {
      setErrorMessage(mode === 'register' ? 'Your password must contain at least 8 characters.'
      : 'Please enter your password.');
      return;
    }

    // Ensure password confirmation matches during registration.
    if (mode === 'register' && password !== confirmPassword) {
      setErrorMessage('Your passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Select the appropriate backend authentication endpoint.
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';

      // Prepare the request body expected by the backend.
      const requestBody = mode === 'login' ? { email: email.trim(), password }
          : {full_name: fullName.trim(), email: email.trim(), password};

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(requestBody)});

      const result = (await response.json()) as AuthResponse;

      // Display backend validation and authentication errors.
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Authentication failed.');
      }

      // Ensure the backend returned a token before continuing.
      if (!result.data?.token) {
        throw new Error('The server did not return an authentication token.');
      }

      // Pass the token to the parent component.
      onAuthenticated(result.data.token);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to connect to the authentication service.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="auth-modal-backdrop"
      onMouseDown={(event) => {
        // Close only when the backdrop itself is clicked.
        if (event.target === event.currentTarget && !isSubmitting) {
          onClose();
        }
      }}>
      <section className="auth-modal" role="dialog" aria-modal="true"
        aria-labelledby="auth-modal-title">
        {/* Welcome panel shown on the left on desktop and at the top on mobile. */}
        <aside className="auth-welcome-panel">
          <div className="auth-welcome-card">
            <p className="auth-modal-brand">MIAMI HOTELS</p>

            <div className="auth-welcome-copy">
              <h2>{mode === 'login' ? 'Welcome back.' : 'Welcome aboard.'}</h2>

              <p>{mode === 'login' ? 'Sign in to manage bookings, save favourite branches and review your stays.'
                  : 'Create an account to book your next stay and keep your favourite branches close.'}</p>
            </div>

            <p className="auth-welcome-tagline">Your stay, made simple.</p>
          </div>
        </aside>

        {/* Authentication form panel. */}
        <div className="auth-form-panel">
          <button type="button" className="auth-modal-close" onClick={onClose}
            disabled={isSubmitting} aria-label="Close authentication modal">&times;</button>

          <div className="auth-modal-heading">
            <h1 id="auth-modal-title">{mode === 'login' ? 'Sign in to your account' : 'Create your account'}</h1>

            <p>{mode === 'login' ? 'Access your bookings and favourite branches.' : 'Register to make your next stay easier.'}</p>
          </div>

          {/* Login and registration tabs. */}
          <div className="auth-mode-switch" role="group" aria-label="Authentication mode">
            <button type="button" className={mode === 'login' ? 'auth-mode-active' : ''}
              onClick={() => switchMode('login')} aria-pressed={mode === 'login'} disabled={isSubmitting}>Sign in</button>

            <button type="button" className={mode === 'register' ? 'auth-mode-active' : ''} onClick={() => 
              switchMode('register')} aria-pressed={mode === 'register'} disabled={isSubmitting}>Create account</button>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {mode === 'register' && (
              <label className="auth-field">
                <span>Full name</span>
                <input type="text" autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)}
                  placeholder="Enter your full name" minLength={2} maxLength={150} required disabled={isSubmitting}/>
              </label>)}

            <label className="auth-field">
              <span>Email address</span>
              <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com" maxLength={255} required disabled={isSubmitting}/>
            </label>

            <label className="auth-field">
              <span>Password</span>
              <input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password} onChange={(event) => setPassword(event.target.value)} placeholder={
                mode === 'register' ? 'At least 8 characters' : 'Enter your password'}
                minLength={mode === 'register' ? 8 : 1} maxLength={72} required disabled={isSubmitting}/></label>

            {mode === 'register' && (
              <label className="auth-field">
                <span>Confirm password</span>
                <input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) =>
                  setConfirmPassword(event.target.value)} placeholder="Re-enter your password" minLength={8}
                  maxLength={72} required disabled={isSubmitting}/></label>
            )}

            {errorMessage && (<p className="auth-feedback auth-error" role="alert">{errorMessage}</p>)}
            <button type="submit" className="auth-submit-button" disabled={isSubmitting}>
              {isSubmitting ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
          </form>

          <p className="auth-switch-prompt"> {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button type="button" onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}disabled={isSubmitting}>
              {mode === 'login' ? 'Sign up' : 'Sign in'} </button></p>
        </div>
      </section>
    </div>
  );
};