import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Post } from './types';
import Navigation from './components/Navigation';
import Feed from './components/Feed';
import ProfileView from './components/ProfileView';
import Auth from './components/Auth';
import { Search, Compass, Sparkles } from 'lucide-react';
import { apiFetch } from './lib/api';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<string>('feed'); // 'feed' | 'profile' | 'auth'
  const [targetUsername, setTargetUsername] = useState<string | null>(null);
  
  // App-wide data
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Global Discover list
  const [searchQuery, setSearchQuery] = useState('');
  const [discoveredUsers, setDiscoveredUsers] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  // Fetch feed
  const fetchFeed = async () => {
    setLoadingFeed(true);
    try {
      const res = await apiFetch('/api/posts');
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts);
      }
    } catch (err) {
      console.error('Error fetching feed posts:', err);
    } finally {
      setLoadingFeed(false);
    }
  };

  // Verify auth on mount
  const checkAuth = async () => {
    try {
      const res = await apiFetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setCurrentUser(data.user);
          fetchFeed();
        } else {
          setCurrentUser(null);
          setCurrentView('auth');
        }
      } else {
        setCurrentUser(null);
        setCurrentView('auth');
      }
    } catch (err) {
      console.error('Error verifying auth:', err);
      setCurrentUser(null);
      setCurrentView('auth');
    } finally {
      setCheckingAuth(false);
    }
  };

  // Search users for discovering connections
  const handleUserSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setDiscoveredUsers([]);
      return;
    }

    setSearching(true);
    try {
      // Find user profile by query
      const res = await apiFetch(`/api/users/${query}`);
      if (res.ok) {
        const data = await res.json();
        setDiscoveredUsers([data.profile]);
      } else {
        setDiscoveredUsers([]);
      }
    } catch {
      setDiscoveredUsers([]);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  // Handle navigation requests
  const handleNavigate = (view: string, data?: any) => {
    if (!currentUser && view !== 'auth') {
      setCurrentView('auth');
      return;
    }
    setCurrentView(view);
    setIsComposeOpen(false);
    if (view === 'profile' && data) {
      setTargetUsername(data);
    } else {
      setTargetUsername(null);
    }
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Logout request
  const handleLogout = async () => {
    try {
      const res = await apiFetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) {
        setCurrentUser(null);
        handleNavigate('feed');
        fetchFeed();
      }
    } catch (err) {
      console.error('Logout error:', err);
    }
  };


  if (checkingAuth) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-cream">
        <div className="text-center space-y-3">
          <div className="w-9 h-9 border-3 border-crimson/30 border-t-crimson rounded-full animate-spin mx-auto" />
          <p className="text-xs text-sage font-mono uppercase tracking-wider">Untangling Knot...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream selection:bg-crimson/15 selection:text-crimson">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row">
        
        {/* Sidebar Left Navigation */}
        <Navigation
          currentUser={currentUser}
          currentView={currentView}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
          onOpenCompose={() => {
            setIsComposeOpen(true);
            setCurrentView('feed');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />

        {/* Main Content Area */}
        <main className="flex-1 min-h-[90vh] px-4 md:px-8 py-6 pb-24 md:pb-8">
          
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            
            {/* Left Content Feed / Profile Views */}
            <div className="lg:col-span-3">
              <AnimatePresence mode="wait">
                {currentView === 'feed' && (
                  <motion.div
                    key="feed"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Feed
                      currentUser={currentUser}
                      posts={posts}
                      setPosts={setPosts}
                      onNavigate={handleNavigate}
                      triggerRefresh={fetchFeed}
                      composeOpenDirectly={isComposeOpen}
                      onCloseCompose={isComposeOpen ? () => setIsComposeOpen(false) : undefined}
                    />
                  </motion.div>
                )}

                {currentView === 'profile' && targetUsername && (
                  <motion.div
                    key={`profile-${targetUsername}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.15 }}
                  >
                    <ProfileView
                      currentUser={currentUser}
                      targetUsername={targetUsername}
                      onNavigate={handleNavigate}
                      onProfileUpdate={(updatedUser) => {
                        setCurrentUser(updatedUser);
                      }}
                      triggerRefresh={fetchFeed}
                    />
                  </motion.div>
                )}

                {currentView === 'auth' && (
                  <motion.div
                    key="auth"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Auth
                      onAuthSuccess={(user) => {
                        setCurrentUser(user);
                        handleNavigate('feed');
                        fetchFeed();
                      }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Sidebar Right Info / Discover Panel */}
            <div className="hidden lg:block lg:col-span-1 space-y-6">
              
              {/* Discover Users Panel */}
              <div className="bg-white border border-ink/10 rounded-2xl p-4.5 shadow-sm space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-ink/5">
                  <Compass className="w-4 h-4 text-crimson" />
                  <h3 className="font-display font-bold text-xs text-ink uppercase tracking-wider">Discover connections</h3>
                </div>

                <p className="text-[11px] text-sage leading-relaxed">
                  Search Users by their username.
                </p>

                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-sage">
                    <Search className="w-3.5 h-3.5" />
                  </span>
                  <input
                    id="sidebar-user-search-input"
                    type="text"
                    placeholder="Search exact username..."
                    value={searchQuery}
                    onChange={(e) => handleUserSearch(e.target.value)}
                    className="w-full pl-8.5 pr-3 py-1.5 bg-cream/40 border border-ink/10 rounded-xl text-xs focus:border-crimson focus:outline-none transition-colors text-ink placeholder:text-sage"
                  />
                </div>

                {searching && (
                  <div className="text-center py-2">
                    <div className="w-4 h-4 border-2 border-crimson/30 border-t-crimson rounded-full animate-spin mx-auto" />
                  </div>
                )}

                {!searching && searchQuery && discoveredUsers.length === 0 && (
                  <p className="text-[11px] text-sage italic text-center py-1">No user matched that exact username.</p>
                )}

                <div className="space-y-2.5">
                  {discoveredUsers.map((user) => (
                    <div 
                      key={user.id}
                      onClick={() => handleNavigate('profile', user.username)}
                      className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-cream/45 cursor-pointer border border-transparent hover:border-ink/5 transition-all group"
                    >
                      <div className="w-8 h-8 rounded-full bg-crimson/5 border border-crimson/25 flex items-center justify-center text-crimson font-bold text-xs overflow-hidden shrink-0">
                        {user.profile_picture ? (
                          <img src={user.profile_picture} alt={user.display_name} className="w-full h-full object-cover" />
                        ) : (
                          user.display_name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-bold text-ink group-hover:text-crimson transition-colors truncate">{user.display_name}</h4>
                        <p className="text-[10px] text-sage truncate">@{user.username}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Knot Stats Overview */}
              <div className="bg-white border border-ink/10 rounded-2xl p-4.5 shadow-sm space-y-3">
                <div className="flex items-center gap-1.5 pb-2 border-b border-ink/5">
                  <Sparkles className="w-4 h-4 text-crimson" />
                  <h3 className="font-display font-bold text-xs text-ink uppercase tracking-wider">About KNOT</h3>
                </div>

                <div className="space-y-3 text-xs">
                  <p className="text-sage leading-relaxed">
                    Knot is built around genuine conversations and meaningful connections.
                  </p>

                  <div className="space-y-2">
                    <div className="flex justify-between border-b border-ink/5 border-dashed pb-1">
                      <span className="text-sage">Experience</span>
                      <span className="text-crimson font-semibold">Minimal & Clean</span>
                    </div>

                    <div className="flex justify-between border-b border-ink/5 border-dashed pb-1">
                      <span className="text-sage">Community</span>
                      <span className="text-crimson font-semibold">Authentic</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-sage">Design</span>
                      <span className="text-crimson font-semibold">Responsive</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>

          </div>
        </main>

      </div>
    </div>
  );
}
