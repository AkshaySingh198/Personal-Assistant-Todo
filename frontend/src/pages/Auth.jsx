import React, { useState } from 'react';
import axios from 'axios';

const Auth = ({ onAuthSuccess, API_URL }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [showLocalSignup, setShowLocalSignup] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [dob, setDob] = useState('');
  const [agentChoice, setAgentChoice] = useState('Ayra');
  const [habit, setHabit] = useState('');
  const [reminderPreference, setReminderPreference] = useState('morning');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const payload = isLogin 
        ? { email, password } 
        : { name, email, password, dob, agentChoice, habit, reminderPreference };
      
      const res = await axios.post(`${API_URL}${endpoint}`, payload, { withCredentials: true });
      
      // Store user details in localStorage
      localStorage.setItem('user', JSON.stringify(res.data));
      onAuthSuccess(res.data, !isLogin); // (userData, shouldGoToOnboarding)
    } catch (err) {
      setError(err.response?.data?.message || 'Authentication failed. Please try again.');
    }
  };

  const handleGoogleAuth = async () => {
    setError('');
    try {
      const res = await axios.get(`${API_URL}/api/auth/google`);
      if (res.data && res.data.url) {
        window.location.href = res.data.url;
      } else {
        setError('Failed to obtain Google login link.');
      }
    } catch (err) {
      console.error(err);
      setError('Could not connect to Google authentication.');
    }
  };

  const toggleAuthMode = () => {
    setIsLogin(!isLogin);
    setShowLocalSignup(false);
    setError('');
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: '20px' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '450px' }}>
        <h2 style={{ fontSize: '2rem', marginBottom: '10px', textAlign: 'center' }}>
          {isLogin ? 'Welcome Back' : (showLocalSignup ? 'Create Account' : 'Join Us')}
        </h2>
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '24px' }}>
          {isLogin 
            ? 'Log in to manage your AI assistant' 
            : (showLocalSignup ? 'Get started with your personal voice assistant' : 'Choose how you want to sign up')}
        </p>

        {error && (
          <div style={{ background: 'var(--accent-red-glow)', border: '1px solid var(--accent-red)', padding: '12px', borderRadius: 'var(--radius-sm)', color: 'var(--accent-red)', marginBottom: '20px', fontSize: '0.9rem' }}>
            {error}
          </div>
        )}

        {isLogin ? (
          // LOGIN VIEW
          <>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input 
                  type="email" 
                  className="form-control" 
                  placeholder="john@example.com" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <input 
                  type="password" 
                  className="form-control" 
                  placeholder="••••••••" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  required 
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }}>
                Log In
              </button>
            </form>

            <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              <div style={{ flexGrow: 1, height: '1px', background: 'var(--glass-border)' }}></div>
              <span style={{ padding: '0 10px' }}>OR</span>
              <div style={{ flexGrow: 1, height: '1px', background: 'var(--glass-border)' }}></div>
            </div>

            <button 
              type="button" 
              onClick={handleGoogleAuth} 
              className="btn btn-secondary" 
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px 14px' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>
          </>
        ) : (
          // SIGNUP VIEWS
          <>
            {!showLocalSignup ? (
              // SIGNUP OPTIONS SELECTOR
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <button 
                  type="button" 
                  onClick={handleGoogleAuth} 
                  className="btn" 
                  style={{
                    width: '100%',
                    padding: '16px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--glass-border)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    textAlign: 'center'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--accent-purple)';
                    e.currentTarget.style.background = 'rgba(192, 132, 252, 0.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--glass-border)';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                  }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                  </svg>
                  <span style={{ fontWeight: 600, fontSize: '1rem', color: '#ffffff' }}>Sign Up with Google Mail</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Instantly link calendar and create your account</span>
                </button>

                <button 
                  type="button" 
                  onClick={() => setShowLocalSignup(true)} 
                  className="btn" 
                  style={{
                    width: '100%',
                    padding: '16px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--glass-border)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    textAlign: 'center'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--accent-purple)';
                    e.currentTarget.style.background = 'rgba(192, 132, 252, 0.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--glass-border)';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                  }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent-purple)' }}>
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                  <span style={{ fontWeight: 600, fontSize: '1rem', color: '#ffffff' }}>Sign Up with Email</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Use password and set your custom agent choice</span>
                </button>
              </div>
            ) : (
              // LOCAL SIGNUP FORM
              <>
                <form onSubmit={handleSubmit}>
                  <div className="form-group">
                    <label className="form-label">Full Name</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="John Doe" 
                      value={name} 
                      onChange={(e) => setName(e.target.value)} 
                      required 
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <input 
                      type="email" 
                      className="form-control" 
                      placeholder="john@example.com" 
                      value={email} 
                      onChange={(e) => setEmail(e.target.value)} 
                      required 
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Password</label>
                    <input 
                      type="password" 
                      className="form-control" 
                      placeholder="••••••••" 
                      value={password} 
                      onChange={(e) => setPassword(e.target.value)} 
                      required 
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Date of Birth</label>
                    <input 
                      type="date" 
                      className="form-control" 
                      value={dob} 
                      onChange={(e) => setDob(e.target.value)} 
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Choose AI Assistant Agent</label>
                    <select 
                      className="form-control" 
                      value={agentChoice} 
                      onChange={(e) => setAgentChoice(e.target.value)}
                    >
                      <option value="Ayra">Ayra (Logical & Structured)</option>
                      <option value="Jordan">Jordan (Energetic & Dynamic)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Daily Habit Goal (Optional)</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="e.g., read 15 pages, drink 3L water" 
                      value={habit} 
                      onChange={(e) => setHabit(e.target.value)} 
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Daily Planning Reminder Preference</label>
                    <select 
                      className="form-control" 
                      value={reminderPreference} 
                      onChange={(e) => setReminderPreference(e.target.value)}
                    >
                      <option value="morning">Morning (7:00 AM)</option>
                      <option value="night">Night (10:00 PM)</option>
                      <option value="none">No reminder</option>
                    </select>
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }}>
                    Register
                  </button>
                </form>

                <div style={{ marginTop: '15px', textAlign: 'center' }}>
                  <button 
                    type="button" 
                    onClick={() => setShowLocalSignup(false)} 
                    style={{ background: 'none', border: 'none', color: 'var(--accent-purple)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
                  >
                    ← Back to sign up options
                  </button>
                </div>
              </>
            )}
          </>
        )}

        <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '0.9rem' }}>
          <span style={{ color: 'var(--text-secondary)' }}>
            {isLogin ? "Don't have an account? " : "Already have an account? "}
          </span>
          <button 
            type="button" 
            onClick={toggleAuthMode} 
            style={{ background: 'none', border: 'none', color: 'var(--accent-purple)', cursor: 'pointer', fontWeight: 600 }}
          >
            {isLogin ? 'Sign Up' : 'Log In'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;
