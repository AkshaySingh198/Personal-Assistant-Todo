import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { User, Bell, Calendar, ShieldCheck, CheckCircle } from 'lucide-react';

const Profile = ({ API_URL, user, onUserUpdated }) => {
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [dob, setDob] = useState('');
  const [agentChoice, setAgentChoice] = useState(user?.agentChoice || 'Ayra');
  const [habit, setHabit] = useState('');
  const [reminderPreference, setReminderPreference] = useState(user?.reminderPreference || 'morning');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');
  const [success, setSuccess] = useState('');
  const [isLinkingGoogle, setIsLinkingGoogle] = useState(false);
  const [googleLinked, setGoogleLinked] = useState(false);

  useEffect(() => {
    // Load full profile details from backend
    const fetchProfile = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/auth/profile`, { withCredentials: true });
        setName(res.data.name);
        setEmail(res.data.email);
        setAgentChoice(res.data.agentChoice);
        setReminderPreference(res.data.reminderPreference);
        setHabit(res.data.habit || '');
        if (res.data.dob) {
          setDob(res.data.dob.split('T')[0]);
        }
        setGoogleLinked(!!res.data.googleTokens);
      } catch (err) {
        console.error(err);
      }
    };
    fetchProfile();

    // Check URL parameters for successful Google OAuth link
    const params = new URLSearchParams(window.location.search);
    if (params.get('linked') === 'success') {
      setSuccess('Google Calendar successfully linked!');
      setGoogleLinked(true);
    } else if (params.get('linked') === 'error') {
      setStatus('Failed to link Google Calendar.');
    }
  }, [API_URL, user]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setStatus('');
    setSuccess('');

    try {
      const payload = { name, email, agentChoice, habit, reminderPreference };
      if (password) payload.password = password;

      const res = await axios.put(`${API_URL}/api/auth/profile`, payload, { withCredentials: true });
      localStorage.setItem('user', JSON.stringify(res.data));
      onUserUpdated(res.data);
      setSuccess('Profile updated successfully!');
      setPassword('');
    } catch (err) {
      setStatus(err.response?.data?.message || 'Failed to update profile.');
    }
  };

  // Web Push Opt-In
  const handleEnablePush = async () => {
    setStatus('');
    setSuccess('');
    
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus("Push notifications are not supported on this browser.");
      return;
    }

    try {
      // 1. Request permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus("Notification permissions were denied.");
        return;
      }

      // 2. Register Service Worker
      // sw.js is located in the public folder so it will be served from root /sw.js
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log("Service Worker registered:", registration);

      // 3. Get Public VAPID Key from backend
      // We will generate the subscription with the application server key
      // First let's check if the .env file's public VAPID key is accessible or configure a fallback
      // Since public VAPID is set on the backend, let's fetch it via a configuration endpoint or read it
      // Let's create an endpoint on the backend or we can fetch a public configuration.
      // Wait, we can generate a simple endpoint /api/integrations/vapid-public-key.
      // Wait, to keep it simple, we can just fetch it from a backend route! 
      // Let's see: did we create a route for vapid key? Let's check api.js... No, but we can easily add it,
      // or we can just fetch the configuration inside a profile controller or return it during auth.
      // Let's add a quick VAPID key request or we can make a custom request to a simple public route!
      // Let's write the fetch first:
      const vapidRes = await axios.get(`${API_URL}/api/auth/profile`, { withCredentials: true }); // It returns user profiles, but let's assume we can fetch key.
      
      // Wait, let's write a route in backend api.js to return the VAPID key so the frontend can retrieve it!
      // Yes! That's very clean. Let's do a request to GET /api/auth/vapid-key
      // Let's assume we retrieve it from there. We'll add this route to backend/routes/api.js soon.
      let publicKey;
      try {
        const keyRes = await axios.get(`${API_URL}/api/auth/vapid-key`, { withCredentials: true });
        publicKey = keyRes.data.publicKey;
      } catch (err) {
        console.error("Vapid Key route not implemented yet, using default fallback key if any.");
      }

      if (!publicKey) {
        setStatus("Could not retrieve notification keys from server.");
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });

      // 4. Save to backend
      await axios.post(`${API_URL}/api/auth/subscription`, { subscription }, { withCredentials: true });
      setSuccess("Push notifications enabled successfully!");
    } catch (error) {
      console.error("Error setting up push notifications:", error);
      setStatus("Error setting up push notifications.");
    }
  };

  const handleTestPush = async () => {
    setStatus('');
    setSuccess('');
    try {
      const res = await axios.post(`${API_URL}/api/auth/test-push`, {}, { withCredentials: true });
      setSuccess(res.data.message || "Test push notification sent!");
    } catch (err) {
      console.error(err);
      setStatus(err.response?.data?.message || "Failed to send test push notification. Make sure you enable notifications first.");
    }
  };

  // Google OAuth redirect
  const handleLinkGoogle = async () => {
    setIsLinkingGoogle(true);
    setStatus('');
    setSuccess('');

    try {
      const res = await axios.get(`${API_URL}/api/integrations/google/auth`, { withCredentials: true });
      if (res.data.url) {
        window.location.href = res.data.url; // Redirect to Google OAuth Consent Page
      }
    } catch (err) {
      console.error(err);
      setStatus("Failed to start Google link flow.");
    } finally {
      setIsLinkingGoogle(false);
    }
  };

  // Base64 helper
  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '2rem', marginBottom: '24px' }}>Settings & Profile</h2>

      {status && (
        <div style={{ color: 'var(--accent-red)', background: 'var(--accent-red-glow)', border: '1px solid var(--accent-red)', padding: '12px', borderRadius: 'var(--radius-sm)', marginBottom: '20px' }}>
          {status}
        </div>
      )}

      {success && (
        <div style={{ color: 'var(--accent-teal)', background: 'var(--accent-teal-glow)', border: '1px solid var(--accent-teal)', padding: '12px', borderRadius: 'var(--radius-sm)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle size={18} />
          {success}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '30px' }}>
        {/* Form update */}
        <div className="glass-panel">
          <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <User size={18} /> Profile Settings
          </h3>
          <form onSubmit={handleUpdateProfile}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input type="text" className="form-control" value={name} onChange={e => setName(e.target.value)} required />
            </div>
            
            <div className="form-group">
              <label className="form-label">Email</label>
              <input type="email" className="form-control" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>

            <div className="form-group">
              <label className="form-label">Date of Birth</label>
              <input type="date" className="form-control" value={dob} onChange={e => setDob(e.target.value)} />
            </div>

            <div className="form-group">
              <label className="form-label">AI Agent Name</label>
              <select className="form-control" value={agentChoice} onChange={e => setAgentChoice(e.target.value)}>
                <option value="Ayra">Ayra (Logical & Structured)</option>
                <option value="Jordan">Jordan (Energetic & Dynamic)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Daily Habit Goal</label>
              <input type="text" className="form-control" value={habit} onChange={e => setHabit(e.target.value)} />
            </div>

            <div className="form-group">
              <label className="form-label">Daily Check-In Time</label>
              <select className="form-control" value={reminderPreference} onChange={e => setReminderPreference(e.target.value)}>
                <option value="morning">Morning (7:00 AM)</option>
                <option value="night">Night (10:00 PM)</option>
                <option value="none">Disabled</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">New Password (leave blank to keep current)</label>
              <input type="password" className="form-control" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Save Changes</button>
          </form>
        </div>

        {/* Integration Card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Notifications Card */}
          <div className="glass-panel">
            <h3 style={{ fontSize: '1.2rem', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bell size={18} /> Push Notifications
            </h3>
            <p style={{ fontSize: '0.85rem', marginBottom: '16px' }}>
              Receive alerts for daily check-ins and high-priority alarms with repeating snoozes.
            </p>
            <button className="btn btn-secondary" onClick={handleEnablePush} style={{ width: '100%', marginBottom: '10px' }}>
              Enable Daily Check-Ins
            </button>
            <button className="btn btn-primary" onClick={handleTestPush} style={{ width: '100%', background: 'var(--accent-teal-glow)', borderColor: 'var(--accent-teal)', color: 'var(--accent-teal)' }}>
              Send Test Notification
            </button>
          </div>

          {/* Google Calendar Card */}
          <div className="glass-panel">
            <h3 style={{ fontSize: '1.2rem', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={18} /> Google Calendar
            </h3>
            <p style={{ fontSize: '0.85rem', marginBottom: '16px' }}>
              Link your Google Calendar to aggregate all events into your voice assistant dashboard.
            </p>
            {googleLinked ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', background: 'rgba(16,185,129,0.1)', color: 'var(--accent-teal)', borderRadius: 'var(--radius-sm)', fontWeight: 600, fontSize: '0.9rem', justifyContent: 'center' }}>
                <ShieldCheck size={18} /> Google Calendar Connected
              </div>
            ) : (
              <button 
                className="btn btn-primary" 
                onClick={handleLinkGoogle} 
                style={{ width: '100%' }}
                disabled={isLinkingGoogle}
              >
                {isLinkingGoogle ? 'Linking...' : 'Connect Google Calendar'}
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default Profile;
export { Profile };
