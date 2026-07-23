import { useState, useEffect, type ChangeEvent, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Profile, Post, User } from '../types';
import { Settings, Calendar, Edit2, Check, X, UserPlus, UserMinus, FileText, Share2, Network, Trash2 } from 'lucide-react';
import { apiFetch } from '../lib/api';

interface ProfileViewProps {
  currentUser: User | null;
  targetUsername: string;
  onNavigate: (view: string, data?: any) => void;
  onProfileUpdate: (updatedUser: User) => void;
  triggerRefresh: () => void;
}

const AVATAR_PRESETS = [
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 100 100"><defs><linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%234f46e5"/><stop offset="100%" stop-color="%23ec4899"/></linearGradient></defs><rect width="100" height="100" fill="url(%23g1)"/></svg>',
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 100 100"><defs><linearGradient id="g2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%230d9488"/><stop offset="100%" stop-color="%2310b981"/></linearGradient></defs><rect width="100" height="100" fill="url(%23g2)"/></svg>',
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 100 100"><defs><linearGradient id="g3" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23f97316"/><stop offset="100%" stop-color="%23f43f5e"/></linearGradient></defs><rect width="100" height="100" fill="url(%23g3)"/></svg>',
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 100 100"><defs><linearGradient id="g4" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23475569"/><stop offset="100%" stop-color="%233b82f6"/></linearGradient></defs><rect width="100" height="100" fill="url(%23g4)"/></svg>',
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 100 100"><defs><linearGradient id="g5" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23d946ef"/><stop offset="100%" stop-color="%232563eb"/></linearGradient></defs><rect width="100" height="100" fill="url(%23g5)"/></svg>',
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 100 100"><defs><linearGradient id="g6" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23f59e0b"/><stop offset="100%" stop-color="%23dc2626"/></linearGradient></defs><rect width="100" height="100" fill="url(%23g6)"/></svg>',
];

export default function ProfileView({
  currentUser,
  targetUsername,
  onNavigate,
  onProfileUpdate,
  triggerRefresh,
}: ProfileViewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);

  // Edit profile state
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [profilePicture, setProfilePicture] = useState('');
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Active post comments state
  const [activeCommentsPostId, setActiveCommentsPostId] = useState<number | null>(null);
  const [comments, setComments] = useState<{ [postId: number]: any[] }>({});
  const [newCommentContent, setNewCommentContent] = useState('');
  const [commentingPostId, setCommentingPostId] = useState<number | null>(null);

  // Post edit state
  const [editingPostId, setEditingPostId] = useState<number | null>(null);
  const [editingPostContent, setEditingPostContent] = useState('');

  // Followers & Following modal state
  const [connectionsModalType, setConnectionsModalType] = useState<'followers' | 'following' | null>(null);
  const [connectionsList, setConnectionsList] = useState<any[]>([]);
  const [loadingConnections, setLoadingConnections] = useState(false);
  const [connectionsError, setConnectionsError] = useState<string | null>(null);

  const fetchConnections = async (type: 'followers' | 'following') => {
    if (!profile) return;
    setConnectionsModalType(type);
    setLoadingConnections(true);
    setConnectionsError(null);
    setConnectionsList([]);
    try {
      const res = await apiFetch(`/api/users/${profile.id}/${type}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Failed to fetch ${type}.`);
      }
      setConnectionsList(data[type] || []);
    } catch (err: any) {
      setConnectionsError(err.message || 'An error occurred.');
    } finally {
      setLoadingConnections(false);
    }
  };

  // Fetch target profile data on mount or username change
  const fetchProfileData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/users/${targetUsername}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load profile.');
      }

      setProfile(data.profile);
      setPosts(data.posts);
      
      // Sync edit inputs
      setDisplayName(data.profile.display_name);
      setBio(data.profile.bio || '');
      setProfilePicture(data.profile.profile_picture || '');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileData();
  }, [targetUsername]);

  // Handle follow toggle
  const handleFollowToggle = async () => {
    if (!currentUser) {
      onNavigate('auth');
      return;
    }
    if (!profile) return;

    const action = profile.is_following ? 'unfollow' : 'follow';
    
    // Optimistic UI updates
    setProfile(prev => prev ? {
      ...prev,
      is_following: !prev.is_following,
      followers_count: prev.is_following ? prev.followers_count - 1 : prev.followers_count + 1
    } : null);

    try {
      const res = await apiFetch(`/api/users/${profile.id}/${action}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      // Update with exact response
      setProfile(prev => prev ? {
        ...prev,
        followers_count: data.followers_count,
        is_following: action === 'follow'
      } : null);
      
      triggerRefresh();
    } catch (err) {
      console.error('Follow action failed:', err);
      fetchProfileData(); // revert
    }
  };

  // Handle local avatar file upload
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setEditError('Image size must be less than 2MB');
      return;
    }

    setEditError(null);
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setProfilePicture(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Save profile updates
  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setSaving(true);
    setEditError(null);
    try {
      const res = await apiFetch('/api/users/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: displayName,
          bio,
          profile_picture: profilePicture,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update profile.');
      }

      setProfile(prev => prev ? {
        ...prev,
        display_name: data.user.display_name,
        bio: data.user.bio,
        profile_picture: data.user.profile_picture,
      } : null);

      // Notify parent app of updated current user info
      onProfileUpdate(data.user);
      setIsEditing(false);
      triggerRefresh();
    } catch (err: any) {
      setEditError(err.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  // Toggle Like on post
  const handleLikeToggle = async (postId: number, isLiked: boolean) => {
    if (!currentUser) {
      onNavigate('auth');
      return;
    }

    setPosts(prev => prev.map(p => {
      if (p.id === postId) {
        return {
          ...p,
          is_liked: !isLiked,
          like_count: isLiked ? p.like_count - 1 : p.like_count + 1
        };
      }
      return p;
    }));

    try {
      const url = `/api/posts/${postId}/${isLiked ? 'unlike' : 'like'}`;
      const res = await apiFetch(url, { method: 'POST' });
      const data = await res.json();

      setPosts(prev => prev.map(p => {
        if (p.id === postId) {
          return { ...p, like_count: data.like_count, is_liked: data.is_liked };
        }
        return p;
      }));
      triggerRefresh();
    } catch (err) {
      console.error('Like toggle failed:', err);
    }
  };

  // Toggle comments
  const toggleComments = async (postId: number) => {
    if (activeCommentsPostId === postId) {
      setActiveCommentsPostId(null);
      return;
    }

    setActiveCommentsPostId(postId);
    if (!comments[postId]) {
      try {
        const res = await apiFetch(`/api/posts/${postId}/comments`);
        if (res.ok) {
          const data = await res.json();
          setComments(prev => ({ ...prev, [postId]: data.comments }));
        }
      } catch (err) {
        console.error('Error fetching comments:', err);
      }
    }
  };

  // Post comment
  const handleCommentSubmit = async (postId: number, e: FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onNavigate('auth');
      return;
    }
    if (!newCommentContent.trim()) return;

    setCommentingPostId(postId);
    try {
      const res = await apiFetch(`/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newCommentContent }),
      });
      const data = await res.json();
      if (res.ok) {
        setNewCommentContent('');
        setComments(prev => ({ ...prev, [postId]: [...(prev[postId] || []), data.comment] }));
        setPosts(prev => prev.map(p => {
          if (p.id === postId) return { ...p, comment_count: p.comment_count + 1 };
          return p;
        }));
        triggerRefresh();
      }
    } catch (err) {
      console.error('Comment error:', err);
    } finally {
      setCommentingPostId(null);
    }
  };

  // Delete post
  const handlePostDelete = async (postId: number) => {
    if (!window.confirm('Delete this Knot?')) return;
    try {
      const res = await apiFetch(`/api/posts/${postId}`, { method: 'DELETE' });
      if (res.ok) {
        setPosts(prev => prev.filter(p => p.id !== postId));
        triggerRefresh();
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  // Edit post
  const savePostEdit = async (postId: number) => {
    if (!editingPostContent.trim()) return;
    try {
      const res = await apiFetch(`/api/posts/${postId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editingPostContent }),
      });
      if (res.ok) {
        setPosts(prev => prev.map(p => {
          if (p.id === postId) return { ...p, content: editingPostContent };
          return p;
        }));
        setEditingPostId(null);
        triggerRefresh();
      }
    } catch (err) {
      console.error('Edit error:', err);
    }
  };

  const formatDate = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric'
      });
    } catch {
      return '';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-crimson/30 border-t-crimson rounded-full animate-spin" />
          <p className="text-xs text-sage font-mono">Untangling connections...</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="bg-white border border-ink/10 rounded-2xl p-8 text-center max-w-lg mx-auto">
        <h3 className="font-display font-semibold text-lg text-ink">Failed to untangle thread</h3>
        <p className="text-xs text-sage mt-2">{error || 'User profile could not be found.'}</p>
        <button
          onClick={() => onNavigate('feed')}
          className="mt-5 px-5 py-2 bg-crimson text-white text-xs font-bold rounded-full transition-all"
        >
          Go to Home Feed
        </button>
      </div>
    );
  }

  const isOwnProfile = currentUser && currentUser.username === profile.username;

  // Generate SVG network coordinates for the dynamic "Connections Graph" representation!
  // It renders a visual web of connected profiles. It looks gorgeous!
  const connectionCount = profile.followers_count + profile.following_count;
  const nodeCount = Math.min(12, connectionCount);
  const cx = 120; // Exact center of 240x240 viewBox
  const cy = 120;
  const radius = 80; // Elegant spacing within 240x240 bounds
  const nodes = Array.from({ length: nodeCount }).map((_, i) => {
    const angle = (i * 2 * Math.PI) / nodeCount;
    return {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
      id: i,
    };
  });

  return (
    <div className="space-y-6">
      {/* Profile Info Header Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white border border-ink/5 rounded-[2.5rem] p-6 shadow-sm relative overflow-hidden"
      >
        {/* Aesthetic crimson connection thread line running horizontally at the top */}
        <div className="absolute top-0 left-0 w-full h-0.75 bg-crimson" />

        <div className="flex flex-col sm:flex-row justify-between items-start gap-5">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left w-full sm:w-auto">
            {/* Avatar Display */}
            <div className="w-18 h-18 rounded-full bg-crimson/5 border-2 border-crimson/25 flex items-center justify-center text-crimson font-bold text-2xl overflow-hidden shrink-0 shadow-inner">
              {profile.profile_picture ? (
                <img referrerPolicy="no-referrer" src={profile.profile_picture} alt={profile.display_name} className="w-full h-full object-cover" />
              ) : (
                profile.display_name.charAt(0).toUpperCase()
              )}
            </div>

            <div className="space-y-1 min-w-0">
              <h2 className="font-display font-bold text-xl text-ink tracking-tight flex items-center justify-center sm:justify-start gap-1.5">
                {profile.display_name}
              </h2>
              <p className="text-xs font-mono text-sage">@{profile.username}</p>
              
              <div className="flex items-center justify-center sm:justify-start gap-3.5 py-1 text-xs text-sage font-medium">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-sage" />
                  Joined {formatDate(profile.join_date)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-2 w-full sm:w-auto justify-center">
            {isOwnProfile ? (
              <button
                id="edit-profile-btn"
                onClick={() => {
                  if (!isEditing && profile) {
                    setDisplayName(profile.display_name || '');
                    setBio(profile.bio || '');
                    setProfilePicture(profile.profile_picture || '');
                  }
                  setIsEditing(!isEditing);
                }}
                className="px-5 py-2 bg-cream hover:bg-ink/5 text-ink text-xs font-bold rounded-full border border-ink/10 transition-all flex items-center gap-1.5"
              >
                {isEditing ? <X className="w-3.5 h-3.5" /> : <Settings className="w-3.5 h-3.5" />}
                <span>{isEditing ? 'Cancel' : 'Edit Profile'}</span>
              </button>
            ) : (
              <button
                id="follow-toggle-btn"
                onClick={handleFollowToggle}
                className={`px-6 py-2 text-xs font-bold rounded-full shadow-sm hover:shadow active:scale-98 transition-all flex items-center gap-1.5 ${
                  profile.is_following
                    ? 'bg-cream text-ink border border-ink/10 hover:bg-ink/5'
                    : 'bg-crimson text-white hover:bg-crimson/95'
                }`}
              >
                {profile.is_following ? (
                  <>
                    <UserMinus className="w-3.5 h-3.5" />
                    <span>Unfollow</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Follow</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Bio Description */}
        <div className="mt-5 pt-4 border-t border-ink/5 text-sm leading-relaxed text-ink/90 whitespace-pre-wrap select-text">
          {profile.bio || (
            <p className="text-xs text-sage italic">No bio written yet. Untangle this user's world as they connect more knots.</p>
          )}
        </div>

        {/* Stats Row */}
        <div className="flex gap-6 mt-5 pt-4 border-t border-ink/5 text-xs text-ink">
          <button
            type="button"
            onClick={() => fetchConnections('followers')}
            className="flex items-baseline gap-1 cursor-pointer hover:underline focus:outline-none transition-all"
            aria-label="View followers"
          >
            <span className="font-mono font-bold text-sm text-crimson">{profile.followers_count}</span>
            <span className="text-sage font-medium">followers</span>
          </button>
          <button
            type="button"
            onClick={() => fetchConnections('following')}
            className="flex items-baseline gap-1 cursor-pointer hover:underline focus:outline-none transition-all"
            aria-label="View following"
          >
            <span className="font-mono font-bold text-sm text-crimson">{profile.following_count}</span>
            <span className="text-sage font-medium">following</span>
          </button>
          <div className="flex items-baseline gap-1">
            <span className="font-mono font-bold text-sm text-crimson">{posts.length}</span>
            <span className="text-sage font-medium">knots tied</span>
          </div>
        </div>

        {/* Edit Profile Form Panel */}
        <AnimatePresence>
          {isEditing && (
            <motion.form
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              onSubmit={handleSaveProfile}
              className="mt-6 pt-5 border-t-2 border-dashed border-ink/10 space-y-4 overflow-hidden"
            >
              <h3 className="font-display font-bold text-sm text-ink uppercase tracking-wider">Configure Profile</h3>

              {editError && (
                <div className="bg-crimson/5 border border-crimson/20 text-crimson rounded-xl p-3 text-xs font-semibold">
                  {editError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-ink uppercase tracking-wider mb-1">Display Name</label>
                  <input
                    id="profile-edit-name-input"
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full text-xs bg-cream/30 border border-ink/10 rounded-xl px-3.5 py-2.5 focus:border-crimson focus:outline-none transition-colors text-ink font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-ink uppercase tracking-wider mb-1">Upload Own Image</label>
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      id="upload-avatar-trigger-btn"
                      onClick={() => document.getElementById('profile-avatar-file-input')?.click()}
                      className="px-4 py-2 bg-crimson hover:bg-crimson/95 text-white text-xs font-semibold rounded-xl shadow-sm transition-all flex items-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                      <span>Choose Image</span>
                    </button>
                    <input
                      id="profile-avatar-file-input"
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    {profilePicture && profilePicture.startsWith('data:image/') && (
                      <span className="text-[10px] font-mono text-sage bg-sage/5 border border-ink/5 px-2 py-1 rounded-lg">Custom upload active</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Avatar presets selector */}
              <div>
                <label className="block text-[10px] font-bold text-ink uppercase tracking-wider mb-1.5">Preset Avatars (Quick Select)</label>
                <div className="flex flex-wrap gap-2.5">
                  {AVATAR_PRESETS.map((presetUrl, idx) => (
                    <button
                      key={idx}
                      type="button"
                      id={`preset-avatar-${idx}`}
                      onClick={() => setProfilePicture(presetUrl)}
                      className={`w-9 h-9 rounded-full overflow-hidden border-2 transition-all ${
                        profilePicture === presetUrl ? 'border-crimson ring-2 ring-crimson/10 scale-105' : 'border-ink/5 hover:border-ink/25'
                      }`}
                    >
                      <img src={presetUrl} alt="preset" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-ink uppercase tracking-wider mb-1">Profile Bio</label>
                <textarea
                  id="profile-edit-bio-input"
                  rows={3}
                  maxLength={160}
                  placeholder="Tell us about yourself..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full text-xs bg-cream/30 border border-ink/10 rounded-xl p-3 focus:border-crimson focus:outline-none transition-colors resize-none text-ink font-medium"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  id="profile-edit-cancel-btn"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-1.5 bg-cream hover:bg-ink/5 text-ink text-xs font-semibold rounded-full transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="profile-edit-save-btn"
                  disabled={saving || !displayName.trim()}
                  className="px-5 py-1.5 bg-crimson hover:bg-crimson/95 disabled:bg-crimson/30 text-white text-xs font-bold rounded-full shadow transition-all flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{saving ? 'Saving...' : 'Save Settings'}</span>
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Grid: SVG Connections Web Graph + User Knots */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Connection Network Visual - Left side on large screen */}
        <div className="lg:col-span-1 bg-white border border-ink/5 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-ink/5">
            <Network className="w-4 h-4 text-crimson" />
            <h3 className="font-display font-bold text-sm text-ink uppercase tracking-wider">Connections Map</h3>
          </div>

          <p className="text-xs text-sage leading-relaxed">
            {profile.followers_count + profile.following_count > 0 
              ? 'Tying a clean web of real connections. Crimson threads illustrate mutual ties and follow circles.'
              : 'Start following or receive followers to see your crimson connection network map build!'}
          </p>

          {/* SVG Connection Net Canvas */}
          <div className="flex justify-center py-2 bg-cream/15 rounded-xl border border-ink/5">
            <svg viewBox="0 0 240 240" className="w-60 h-60 bg-transparent select-none">
              {/* Connected threads */}
              {nodes.map((node) => (
                <line
                  key={`line-${node.id}`}
                  x1={cx}
                  y1={cy}
                  x2={node.x}
                  y2={node.y}
                  stroke="var(--color-crimson)"
                  strokeWidth="1.2"
                  opacity="0.35"
                  strokeDasharray="1.5 2"
                />
              ))}

              {/* Connected inter-node outer loop threads */}
              {nodes.length > 1 && nodes.map((node, i) => {
                const nextNode = nodes[(i + 1) % nodes.length];
                return (
                  <line
                    key={`loop-line-${node.id}`}
                    x1={node.x}
                    y1={node.y}
                    x2={nextNode.x}
                    y2={nextNode.y}
                    stroke="var(--color-sage)"
                    strokeWidth="0.8"
                    opacity="0.25"
                  />
                );
              })}

              {/* Satellite nodes representing other people in user's circle */}
              {nodes.map((node) => (
                <circle
                  key={`circle-${node.id}`}
                  cx={node.x}
                  cy={node.y}
                  r="7"
                  fill="var(--color-sage)"
                  opacity="0.85"
                  className="animate-pulse"
                  style={{ animationDelay: `${node.id * 150}ms` }}
                />
              ))}

              {/* Large Crimson center Node representing active profile user */}
              <circle cx={cx} cy={cy} r="16" fill="var(--color-crimson)" opacity="0.1" />
              <circle cx={cx} cy={cy} r="11" fill="var(--color-crimson)" />
              <text
                x={cx}
                y={cy + 4}
                textAnchor="middle"
                fill="#ffffff"
                className="text-[10px] font-bold font-mono"
              >
                {profile.display_name.charAt(0).toUpperCase()}
              </text>
            </svg>
          </div>

          <div className="text-center">
            <span className="text-[10px] font-mono text-sage uppercase tracking-wider">
              {profile.followers_count + profile.following_count} active circle links
            </span>
          </div>
        </div>

        {/* User Posts List - Right side */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-ink/5">
            <FileText className="w-4 h-4 text-crimson" />
            <h3 className="font-display font-bold text-sm text-ink uppercase tracking-wider">User's Tied Knots ({posts.length})</h3>
          </div>

          {posts.length === 0 ? (
            <div className="bg-white/40 border border-ink/5 border-dashed rounded-2xl py-12 px-4 text-center">
              <p className="text-xs text-sage italic">This user hasn't tied any knots yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => {
                const isAuthor = currentUser && post.author.id === currentUser.id;
                const isEditing = editingPostId === post.id;

                return (
                  <article
                    key={post.id}
                    className="bg-white border border-ink/5 rounded-[2.5rem] p-6 shadow-sm relative overflow-hidden hover:border-ink/10 hover:shadow-md transition-all duration-150"
                  >
                    <div className="absolute top-0 left-0 h-full w-0.5 bg-crimson" />

                    <div className="flex gap-3.5">
                      <div className="w-10 h-10 rounded-full bg-crimson/5 border border-crimson/20 flex items-center justify-center text-crimson font-bold text-sm overflow-hidden shrink-0">
                        {profile.profile_picture ? (
                          <img referrerPolicy="no-referrer" src={profile.profile_picture} alt={profile.display_name} className="w-full h-full object-cover" />
                        ) : (
                          profile.display_name.charAt(0).toUpperCase()
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-baseline gap-1.5 min-w-0">
                            <span className="font-bold text-sm text-ink truncate">
                              {profile.display_name}
                            </span>
                            <span className="text-xs text-sage truncate">
                              @{profile.username}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-mono text-sage whitespace-nowrap">
                              {new Date(post.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </span>

                            {isAuthor && !isEditing && (
                              <div className="flex items-center gap-1">
                                <button
                                  id={`edit-profile-post-${post.id}-btn`}
                                  onClick={() => {
                                    setEditingPostId(post.id);
                                    setEditingPostContent(post.content);
                                  }}
                                  className="p-1 text-sage hover:text-ink rounded-md hover:bg-cream"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  id={`delete-profile-post-${post.id}-btn`}
                                  onClick={() => handlePostDelete(post.id)}
                                  className="p-1 text-sage hover:text-crimson rounded-md hover:bg-crimson/5"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {isEditing ? (
                          <div className="mt-2 space-y-2">
                            <textarea
                              id={`profile-post-edit-textarea-${post.id}`}
                              rows={3}
                              value={editingPostContent}
                              onChange={(e) => setEditingPostContent(e.target.value)}
                              className="w-full text-xs bg-cream/30 border border-ink/10 rounded-xl p-3 focus:border-crimson focus:outline-none transition-all text-ink resize-none"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                id={`cancel-profile-edit-${post.id}-btn`}
                                onClick={() => setEditingPostId(null)}
                                className="px-3.5 py-1.5 bg-cream text-ink text-xs font-semibold rounded-full hover:bg-ink/5 transition-all"
                              >
                                Cancel
                              </button>
                              <button
                                id={`save-profile-edit-${post.id}-btn`}
                                onClick={() => savePostEdit(post.id)}
                                disabled={!editingPostContent.trim()}
                                className="px-4 py-1.5 bg-crimson text-white text-xs font-bold rounded-full hover:bg-crimson/95 transition-all"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap wrap-break-word mt-1 select-text">
                            {post.content}
                          </p>
                        )}

                        {!isEditing && (
                          <div className="flex items-center gap-6 mt-4 pt-3 border-t border-ink/5">
                            <button
                              id={`profile-post-like-${post.id}-btn`}
                              onClick={() => handleLikeToggle(post.id, post.is_liked)}
                              className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                                post.is_liked ? 'text-crimson' : 'text-sage hover:text-crimson'
                              }`}
                            >
                              <svg className={`w-4 h-4 ${post.is_liked ? 'fill-crimson stroke-crimson' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                              </svg>
                              <span className="font-mono">{post.like_count}</span>
                            </button>

                            <button
                              id={`profile-post-comments-toggle-${post.id}`}
                              onClick={() => toggleComments(post.id)}
                              className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                                activeCommentsPostId === post.id ? 'text-ink font-bold' : 'text-sage hover:text-ink'
                              }`}
                            >
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                              </svg>
                              <span className="font-mono">{post.comment_count}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Active Comments Subsection inside Profile Post */}
                    <AnimatePresence>
                      {activeCommentsPostId === post.id && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-4 pt-4 border-t border-ink/5 overflow-hidden"
                        >
                          <div className="space-y-3 mb-4">
                            {(comments[post.id] || []).map((comment) => (
                              <div key={comment.id} className="flex gap-2.5 p-3 rounded-2xl bg-cream/25 border border-ink/5">
                                <div className="w-7 h-7 rounded-full bg-crimson/5 border border-crimson/20 flex items-center justify-center text-crimson font-bold text-xs overflow-hidden shrink-0">
                                  {comment.author.profile_picture ? (
                                    <img referrerPolicy="no-referrer" src={comment.author.profile_picture} alt={comment.author.display_name} className="w-full h-full object-cover" />
                                  ) : (
                                    comment.author.display_name.charAt(0).toUpperCase()
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-1 mb-0.5">
                                    <span className="text-xs font-bold text-ink truncate">{comment.author.display_name}</span>
                                    <span className="text-[9px] font-mono text-sage">
                                      {new Date(comment.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                    </span>
                                  </div>
                                  <p className="text-xs text-ink wrap-break-word">{comment.content}</p>
                                </div>
                              </div>
                            ))}
                          </div>

                          {currentUser ? (
                            <form onSubmit={(e) => handleCommentSubmit(post.id, e)} className="flex items-center gap-2">
                              <input
                                id={`profile-post-comment-input-${post.id}`}
                                type="text"
                                maxLength={150}
                                placeholder="Add your reply..."
                                value={newCommentContent}
                                onChange={(e) => setNewCommentContent(e.target.value)}
                                className="flex-1 text-xs bg-cream/30 border border-ink/10 rounded-2xl px-4 py-2.5 text-ink focus:border-crimson focus:outline-none"
                              />
                              <button
                                type="submit"
                                id={`profile-post-comment-submit-${post.id}`}
                                disabled={commentingPostId === post.id || !newCommentContent.trim()}
                                className="p-2.5 bg-crimson text-white rounded-2xl shadow-sm hover:bg-crimson/95 transition-all"
                              >
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <line x1="22" y1="2" x2="11" y2="13" />
                                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                                </svg>
                              </button>
                            </form>
                          ) : (
                            <p className="text-center text-xs text-sage italic py-2">Please sign in to reply.</p>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </article>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* Connections List Modal (Followers / Following list) */}
      <AnimatePresence>
        {connectionsModalType && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setConnectionsModalType(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-white border border-ink/10 rounded-[2.5rem] w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden shadow-2xl relative"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Accent line */}
              <div className="absolute top-0 left-0 w-full h-1 bg-crimson" />

              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-ink/5 mt-1">
                <h3 className="font-display font-bold text-lg text-ink capitalize">
                  {connectionsModalType}
                </h3>
                <button
                  onClick={() => setConnectionsModalType(null)}
                  className="p-1.5 hover:bg-ink/5 rounded-full transition-colors text-sage hover:text-ink focus:outline-none"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {loadingConnections ? (
                  <div className="flex flex-col items-center justify-center py-10 space-y-3">
                    <div className="w-8 h-8 border-4 border-crimson border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs font-mono text-sage">Fetching connection net...</span>
                  </div>
                ) : connectionsError ? (
                  <div className="bg-crimson/5 border border-crimson/20 text-crimson rounded-2xl p-4 text-xs font-semibold text-center">
                    {connectionsError}
                  </div>
                ) : connectionsList.length === 0 ? (
                  <div className="text-center py-12 space-y-2">
                    <div className="w-12 h-12 bg-cream rounded-full flex items-center justify-center mx-auto text-sage">
                      <Network className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-medium text-ink">No {connectionsModalType} yet</p>
                    <p className="text-xs text-sage">When connections form, they will display here as tied threads.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-ink/5">
                    {connectionsList.map((user) => (
                      <div
                        key={user.id}
                        onClick={() => {
                          setConnectionsModalType(null);
                          onNavigate('profile', user.username);
                        }}
                        className="flex items-center gap-3.5 py-3.5 cursor-pointer group hover:bg-cream/20 rounded-2xl px-2 -mx-2 transition-all"
                      >
                        {/* User Avatar */}
                        <div className="w-10 h-10 rounded-full bg-crimson/5 border border-crimson/20 flex items-center justify-center text-crimson font-bold text-sm overflow-hidden shrink-0 group-hover:scale-105 transition-transform">
                          {user.profile_picture ? (
                            <img
                              referrerPolicy="no-referrer"
                              src={user.profile_picture}
                              alt={user.display_name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            user.display_name.charAt(0).toUpperCase()
                          )}
                        </div>

                        {/* User Identifiers */}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-xs text-ink truncate group-hover:text-crimson transition-colors">
                            {user.display_name}
                          </h4>
                          <p className="text-[10px] font-mono text-sage">@{user.username}</p>
                          {user.bio && (
                            <p className="text-[11px] text-sage truncate mt-0.5 max-w-70">
                              {user.bio}
                            </p>
                          )}
                        </div>

                        {/* Visual indicator button */}
                        <div className="text-xs font-bold text-crimson group-hover:translate-x-1 transition-transform opacity-0 group-hover:opacity-100 pr-1">
                          →
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
