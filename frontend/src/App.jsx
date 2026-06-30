import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { LayoutDashboard, Calendar as CalendarIcon, User, LogOut, CheckCircle2, ListTodo, Award, Sparkles, Sun, Moon } from 'lucide-react';
import Auth from './pages/Auth';
import Onboarding from './pages/Onboarding';
import VoiceAssistant from './components/VoiceAssistant';
import TasksList from './components/TasksList';
import CalendarFeed from './components/CalendarFeed';
import Profile from './pages/Profile';

const API_URL = window.location.origin === 'http://localhost:5173'
  ? 'http://localhost:5000'
  : window.location.origin;

function App() {
  const [user, setUser] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [tasks, setTasks] = useState([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'dark';
  });

  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // Register Service Worker and listen for PLAY_SOUND messages
  useEffect(() => {
    const handleServiceWorkerMessage = (event) => {
      if (event.data && event.data.type === 'PLAY_SOUND') {
        console.log("Playing notification sound:", event.data.soundUrl);
        const audio = new Audio(event.data.soundUrl);
        audio.play().catch(err => {
          console.warn("Audio autoplay blocked by browser policy. Interaction required.", err);
        });
      }
    };

    if ('serviceWorker' in navigator) {
      // Register service worker on mount to ensure it's up to date and active
      navigator.serviceWorker.register('/sw.js')
        .then(reg => {
          console.log("Service Worker registered on app mount:", reg.scope);
          // Force check for updates
          reg.update();
        })
        .catch(err => console.error("SW registration failed on mount:", err));

      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
      return () => {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
      };
    }
  }, []);

  // Check auth status on mount (including Google OAuth redirects)
  useEffect(() => {
    const checkAuth = async () => {
      const params = new URLSearchParams(window.location.search);
      
      // 1. Check if returning from a successful Google OAuth login/signup redirect
      if (params.get('oauth') === 'success') {
        const isNew = params.get('new') === 'true';
        try {
          const res = await axios.get(`${API_URL}/api/auth/profile`, { withCredentials: true });
          localStorage.setItem('user', JSON.stringify(res.data));
          setUser(res.data);
          if (isNew || !res.data.onboardingAnswers || !res.data.onboardingAnswers.usualDay) {
            setShowOnboarding(true);
          }
          // Clean parameters from address bar
          window.history.replaceState({}, document.title, window.location.pathname);
          setLoading(false);
          return;
        } catch (err) {
          console.error("OAuth profile fetch failed:", err);
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      } else if (params.get('oauth') === 'error') {
        alert("Google authentication failed. Please try again.");
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      // 2. Standard LocalStorage check
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        try {
          const res = await axios.get(`${API_URL}/api/auth/profile`, { withCredentials: true });
          setUser(res.data);
          if (!res.data.onboardingAnswers || !res.data.onboardingAnswers.usualDay) {
            setShowOnboarding(true);
          }
        } catch {
          // Token expired or invalid
          localStorage.removeItem('user');
          setUser(null);
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Fetch tasks
  useEffect(() => {
    if (user && !showOnboarding) {
      fetchTasks();
    }
  }, [user, showOnboarding, refreshTrigger]);

  const fetchTasks = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/tasks`, { withCredentials: true });
      setTasks(res.data);
    } catch (err) {
      console.error("Failed to fetch tasks:", err);
    }
  };

  const handleAuthSuccess = (userData, goesToOnboarding) => {
    setUser(userData);
    if (goesToOnboarding) {
      setShowOnboarding(true);
    } else {
      setShowOnboarding(false);
      setActiveTab('dashboard');
    }
  };

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    setActiveTab('dashboard');
    // Re-fetch user details to get updated onboarding status
    axios.get(`${API_URL}/api/auth/profile`, { withCredentials: true })
      .then(res => setUser(res.data));
  };

  const handleLogout = async () => {
    try {
      await axios.post(`${API_URL}/api/auth/logout`, {}, { withCredentials: true });
    } catch (e) {
      console.error(e);
    }
    localStorage.removeItem('user');
    setUser(null);
    setShowOnboarding(false);
  };

  const triggerRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'var(--bg-primary)' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', color: 'var(--accent-purple)' }}>Loading your assistant...</h2>
      </div>
    );
  }

  // Not Authenticated
  if (!user) {
    return <Auth onAuthSuccess={handleAuthSuccess} API_URL={API_URL} />;
  }

  // Authenticated but onboarding survey not done
  if (showOnboarding) {
    return <Onboarding onOnboardingComplete={handleOnboardingComplete} API_URL={API_URL} />;
  }

  // Dashboard calculations
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.isCompleted).length;
  const pendingTasks = totalTasks - completedTasks;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div>
          <div className="sidebar-logo">
            <Sparkles size={24} />
            Todo Assistant
          </div>
          
          <nav className="sidebar-nav">
            <button 
              className={`sidebar-link ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
              style={{ background: 'none', border: 'none', width: '100%', cursor: 'pointer', textAlign: 'left' }}
            >
              <LayoutDashboard size={18} />
              Dashboard
            </button>

            <button 
              className={`sidebar-link ${activeTab === 'calendar' ? 'active' : ''}`}
              onClick={() => setActiveTab('calendar')}
              style={{ background: 'none', border: 'none', width: '100%', cursor: 'pointer', textAlign: 'left' }}
            >
              <CalendarIcon size={18} />
              Calendar Feed
            </button>

            <button 
              className={`sidebar-link ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
              style={{ background: 'none', border: 'none', width: '100%', cursor: 'pointer', textAlign: 'left' }}
            >
              <User size={18} />
              Settings & Profile
            </button>
          </nav>
        </div>

        <div>
          {/* User Widget */}
          <div className="sidebar-user" style={{ marginBottom: '15px' }}>
            <div className="user-avatar">
              {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{user.name}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Agent: {user.agentChoice || 'Ayra'}
              </div>
            </div>
          </div>

          <button 
            onClick={handleLogout} 
            className="sidebar-link" 
            style={{ background: 'none', border: 'none', width: '100%', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--accent-red)' }}
          >
            <LogOut size={18} />
            Log Out
          </button>
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="main-content">
        {activeTab === 'dashboard' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
              <div>
                <h1 style={{ fontSize: '2.5rem', margin: '0' }}>Welcome, {user.name}</h1>
                <p style={{ color: 'var(--text-secondary)' }}>
                  Here is what you have planned with your AI assistant, {user.agentChoice}.
                </p>
              </div>
              <button 
                onClick={toggleTheme} 
                className="btn btn-secondary"
                style={{ 
                  padding: '10px 16px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-secondary)',
                  borderColor: 'var(--glass-border)',
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  fontSize: '0.9rem'
                }}
              >
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                
              </button>
            </div>

            {/* Quick Stats Grid */}
            <div className="dashboard-stats">
              <div className="glass-panel stat-widget">
                <div className="stat-icon blue">
                  <ListTodo size={24} />
                </div>
                <div className="stat-details">
                  <h3>{pendingTasks}</h3>
                  <p>Pending Tasks</p>
                </div>
              </div>

              <div className="glass-panel stat-widget">
                <div className="stat-icon teal">
                  <CheckCircle2 size={24} />
                </div>
                <div className="stat-details">
                  <h3>{completedTasks}</h3>
                  <p>Completed Tasks</p>
                </div>
              </div>

              <div className="glass-panel stat-widget">
                <div className="stat-icon purple">
                  <Award size={24} />
                </div>
                <div className="stat-details">
                  <h3>{completionRate}%</h3>
                  <p>Completion Rate</p>
                </div>
              </div>
            </div>

            {/* Interactive Section */}
            <div className="dashboard-grid">
              <div>
                <TasksList 
                  API_URL={API_URL} 
                  tasks={tasks} 
                  onTaskActionExecuted={triggerRefresh} 
                />
              </div>
              <div>
                <VoiceAssistant 
                  API_URL={API_URL} 
                  onTaskActionExecuted={triggerRefresh} 
                  agentName={user.agentChoice}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'calendar' && (
          <CalendarFeed 
            API_URL={API_URL} 
            refreshTrigger={refreshTrigger} 
          />
        )}

        {activeTab === 'profile' && (
          <Profile 
            API_URL={API_URL} 
            user={user} 
            onUserUpdated={(updated) => setUser(updated)} 
          />
        )}
      </main>
    </div>
  );
}

export default App;
