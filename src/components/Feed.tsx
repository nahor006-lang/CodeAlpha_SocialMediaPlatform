import { useState, useEffect, type Dispatch, type SetStateAction, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Post, Comment, User } from '../types';
import { Heart, MessageCircle, Trash2, Edit3, Send, Calendar, Share2, Check, X } from 'lucide-react';
import { apiFetch } from '../lib/api';

interface FeedProps {
  currentUser: User | null;
  posts: Post[];
  setPosts: Dispatch<SetStateAction<Post[]>>;
  onNavigate: (view: string, data?: any) => void;
  triggerRefresh: () => void;
  composeOpenDirectly?: boolean;
  onCloseCompose?: () => void;
}

export default function Feed({
  currentUser,
  posts,
  setPosts,
  onNavigate,
  triggerRefresh,
  composeOpenDirectly = false,
  onCloseCompose
}: FeedProps) {
  const [newPostContent, setNewPostContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeCommentsPostId, setActiveCommentsPostId] = useState<number | null>(null);
  const [comments, setComments] = useState<{ [postId: number]: Comment[] }>({});
  const [newCommentContent, setNewCommentContent] = useState('');
  const [commentingPostId, setCommentingPostId] = useState<number | null>(null);
  
  // Post editing state
  const [editingPostId, setEditingPostId] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Form error states
  const [postError, setPostError] = useState<string | null>(null);

  const maxPostLength = 280;

  // Handle post submit
  const handlePostSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onNavigate('auth');
      return;
    }

    if (!newPostContent.trim()) return;

    setIsSubmitting(true);
    setPostError(null);

    try {
      const res = await apiFetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newPostContent }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to publish post.');
      }

      setNewPostContent('');
      triggerRefresh();
      if (onCloseCompose) onCloseCompose();
    } catch (err: any) {
      setPostError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Like
  const handleLikeToggle = async (postId: number, isLiked: boolean) => {
    if (!currentUser) {
      onNavigate('auth');
      return;
    }

    // Optimistic update
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

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update like status.');
      }

      // Sync count from server
      setPosts(prev => prev.map(p => {
        if (p.id === postId) {
          return {
            ...p,
            like_count: data.like_count,
            is_liked: data.is_liked
          };
        }
        return p;
      }));
    } catch (err) {
      console.error('Like toggle failed:', err);
      // Revert in case of failure
      triggerRefresh();
    }
  };

  // Fetch comments
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

  // Submit a comment
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
      if (!res.ok) {
        throw new Error(data.error || 'Failed to post comment.');
      }

      setNewCommentContent('');
      setComments(prev => ({
        ...prev,
        [postId]: [...(prev[postId] || []), data.comment]
      }));

      // Update comment count on post
      setPosts(prev => prev.map(p => {
        if (p.id === postId) {
          return { ...p, comment_count: p.comment_count + 1 };
        }
        return p;
      }));
    } catch (err) {
      console.error('Error posting comment:', err);
    } finally {
      setCommentingPostId(null);
    }
  };

  // Delete comment
  const handleCommentDelete = async (postId: number, commentId: number) => {
    if (!window.confirm('Are you sure you want to delete your comment?')) return;

    try {
      const res = await apiFetch(`/api/comments/${commentId}`, { method: 'DELETE' });
      if (res.ok) {
        setComments(prev => ({
          ...prev,
          [postId]: (prev[postId] || []).filter(c => c.id !== commentId)
        }));

        // Update comment count on post
        setPosts(prev => prev.map(p => {
          if (p.id === postId) {
            return { ...p, comment_count: Math.max(0, p.comment_count - 1) };
          }
          return p;
        }));
      }
    } catch (err) {
      console.error('Error deleting comment:', err);
    }
  };

  // Start Editing Post
  const startEditing = (post: Post) => {
    setEditingPostId(post.id);
    setEditingContent(post.content);
  };

  // Save Post Edit
  const savePostEdit = async (postId: number) => {
    if (!editingContent.trim()) return;

    setIsSavingEdit(true);
    try {
      const res = await apiFetch(`/api/posts/${postId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editingContent }),
      });

      if (res.ok) {
        setPosts(prev => prev.map(p => {
          if (p.id === postId) {
            return { ...p, content: editingContent };
          }
          return p;
        }));
        setEditingPostId(null);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to save edit.');
      }
    } catch (err) {
      console.error('Error editing post:', err);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Delete Post
  const handlePostDelete = async (postId: number) => {
    if (!window.confirm('Are you sure you want to untangle and delete this Knot? This action cannot be undone.')) return;

    try {
      const res = await apiFetch(`/api/posts/${postId}`, { method: 'DELETE' });
      if (res.ok) {
        setPosts(prev => prev.filter(p => p.id !== postId));
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete post.');
      }
    } catch (err) {
      console.error('Error deleting post:', err);
    }
  };


  // Format relative timestamp
  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <div id="feed-view-container" className="space-y-6">
      {/* Post Composer - Visible inline or in full-screen modal */}
      {(currentUser && (!composeOpenDirectly || composeOpenDirectly)) && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`bg-white border border-ink/5 rounded-[2.5rem] p-6 shadow-sm relative overflow-hidden ${
            composeOpenDirectly ? 'border-crimson/30 ring-1 ring-crimson/5' : ''
          }`}
        >
          {/* Aesthetic Crimson connection thread line running vertically down on the composer */}
          <div className="absolute top-0 left-0 h-full w-0.75 bg-crimson" />

          <div className="flex gap-4">
            <div 
              onClick={() => onNavigate('profile', currentUser.username)}
              className="w-10 h-10 rounded-full bg-crimson/5 border border-crimson/20 flex items-center justify-center text-crimson font-bold text-sm cursor-pointer overflow-hidden"
            >
              {currentUser.profile_picture ? (
                <img referrerPolicy="no-referrer" src={currentUser.profile_picture} alt={currentUser.display_name} className="w-full h-full object-cover" />
              ) : (
                currentUser.display_name.charAt(0).toUpperCase()
              )}
            </div>

            <form onSubmit={handlePostSubmit} className="flex-1 space-y-3">
              <div>
                <textarea
                  id="feed-post-textarea"
                  rows={3}
                  maxLength={maxPostLength}
                  placeholder="What knot are we tying today? Share your thoughts..."
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                  className="w-full text-sm bg-transparent border-none resize-none focus:outline-none focus:ring-0 text-ink placeholder:text-sage"
                />
              </div>

              {postError && (
                <p className="text-xs text-crimson font-medium">{postError}</p>
              )}

              <div className="flex items-center justify-between border-t border-ink/5 pt-3">
                <div className="flex items-center gap-1">
                  <span className={`text-[11px] font-mono font-medium ${
                    newPostContent.length > maxPostLength - 20 ? 'text-crimson' : 'text-sage'
                  }`}>
                    {newPostContent.length}/{maxPostLength}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {onCloseCompose && (
                    <button
                      type="button"
                      id="feed-cancel-compose-btn"
                      onClick={onCloseCompose}
                      className="px-4 py-1.5 bg-cream hover:bg-ink/5 text-ink/70 text-xs font-semibold rounded-full transition-all"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="submit"
                    id="feed-submit-post-btn"
                    disabled={isSubmitting || !newPostContent.trim()}
                    className="px-5 py-1.5 bg-crimson hover:bg-crimson/95 disabled:bg-crimson/30 text-white text-xs font-bold rounded-full shadow-sm hover:shadow active:scale-98 transition-all flex items-center gap-1.5"
                  >
                    <span>Tie Knot</span>
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </form>
          </div>
        </motion.div>
      )}

      {/* Feed List Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-display font-bold text-2xl tracking-tight text-ink">Knot Feed</h2>
        <span className="text-xs font-mono bg-white border border-ink/5 text-sage px-3 py-1 rounded-full">
          {posts.length} {posts.length === 1 ? 'connection' : 'connections'}
        </span>
      </div>

      {/* Empty State */}
      {posts.length === 0 && (
        <div id="feed-empty-state" className="bg-white/40 border border-ink/5 border-dashed rounded-3xl py-16 px-4 text-center">
          <div className="flex justify-center mb-3 text-sage/40">
            <Share2 className="w-12 h-12 stroke-[1.5]" />
          </div>
          <h3 className="font-display font-semibold text-lg text-ink">Zero knots tied yet</h3>
          <p className="text-xs text-sage mt-1 max-w-sm mx-auto">
            This platform starts entirely empty! Be the first real user to connect and tie a brand new knot.
          </p>
        </div>
      )}

      {/* Post Loop */}
      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {posts.map((post) => {
            const isAuthor = currentUser && post.author.id === currentUser.id;
            const isEditing = editingPostId === post.id;

            return (
              <motion.article
                key={post.id}
                layoutId={`post-${post.id}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white border border-ink/5 rounded-[2.5rem] p-6 shadow-sm relative overflow-hidden hover:border-ink/10 hover:shadow-md transition-all duration-150"
              >
                {/* Visual Connection Line - Crimson thread running down to the likes/replies */}
                <div className="absolute top-0 left-0 h-full w-0.5 bg-linear-to-b from-crimson/40 to-sage/10" />

                <div className="flex gap-3.5">
                  {/* Author Avatar */}
                  <div 
                    onClick={() => onNavigate('profile', post.author.username)}
                    className="w-10 h-10 rounded-full bg-crimson/5 border border-crimson/20 flex items-center justify-center text-crimson font-bold text-sm cursor-pointer overflow-hidden shrink-0"
                  >
                    {post.author.profile_picture ? (
                      <img referrerPolicy="no-referrer" src={post.author.profile_picture} alt={post.author.display_name} className="w-full h-full object-cover" />
                    ) : (
                      post.author.display_name.charAt(0).toUpperCase()
                    )}
                  </div>

                  {/* Post Content Area */}
                  <div className="flex-1 min-w-0">
                    {/* Header: Author info + timestamp */}
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div 
                        onClick={() => onNavigate('profile', post.author.username)}
                        className="cursor-pointer group flex items-baseline gap-1.5 min-w-0"
                      >
                        <span className="font-bold text-sm text-ink group-hover:text-crimson transition-colors truncate">
                          {post.author.display_name}
                        </span>
                        <span className="text-xs text-sage truncate">
                          @{post.author.username}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-sage whitespace-nowrap">
                          {formatTime(post.timestamp)}
                        </span>

                        {isAuthor && !isEditing && (
                          <div className="flex items-center gap-1">
                            <button
                              id={`edit-post-${post.id}-btn`}
                              onClick={() => startEditing(post)}
                              className="p-1 text-sage hover:text-ink hover:bg-cream rounded-md transition-all"
                              title="Edit Knot"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              id={`delete-post-${post.id}-btn`}
                              onClick={() => handlePostDelete(post.id)}
                              className="p-1 text-sage hover:text-crimson hover:bg-crimson/5 rounded-md transition-all"
                              title="Delete Knot"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Post text */}
                    {isEditing ? (
                      <div className="mt-2 space-y-2">
                        <textarea
                          id={`post-edit-textarea-${post.id}`}
                          rows={3}
                          value={editingContent}
                          onChange={(e) => setEditingContent(e.target.value)}
                          className="w-full text-sm bg-cream/30 border border-ink/10 rounded-xl p-3 focus:border-crimson focus:outline-none transition-all resize-none text-ink"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            id={`cancel-edit-${post.id}-btn`}
                            onClick={() => setEditingPostId(null)}
                            className="px-3.5 py-1.5 bg-cream text-ink text-xs font-semibold rounded-full hover:bg-ink/5 transition-all flex items-center gap-1"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Cancel</span>
                          </button>
                          <button
                            id={`save-edit-${post.id}-btn`}
                            onClick={() => savePostEdit(post.id)}
                            disabled={isSavingEdit || !editingContent.trim()}
                            className="px-4 py-1.5 bg-crimson text-white text-xs font-bold rounded-full hover:bg-crimson/95 disabled:bg-crimson/30 transition-all flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Save</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap wrap-break-word mt-1 select-text">
                        {post.content}
                      </p>
                    )}

                    {/* Interactive Footer (Likes, Replies, Share) */}
                    {!isEditing && (
                      <div className="flex items-center gap-6 mt-4 pt-3 border-t border-ink/5">
                        {/* Like Button */}
                        <button
                          id={`like-btn-${post.id}`}
                          onClick={() => handleLikeToggle(post.id, post.is_liked)}
                          className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                            post.is_liked ? 'text-crimson' : 'text-sage hover:text-crimson'
                          }`}
                        >
                          <Heart className={`w-4 h-4 ${post.is_liked ? 'fill-crimson stroke-crimson' : ''}`} />
                          <span className="font-mono">{post.like_count}</span>
                        </button>

                        {/* Reply Button */}
                        <button
                          id={`comments-toggle-${post.id}`}
                          onClick={() => toggleComments(post.id)}
                          className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                            activeCommentsPostId === post.id ? 'text-ink font-bold' : 'text-sage hover:text-ink'
                          }`}
                        >
                          <MessageCircle className="w-4 h-4" />
                          <span className="font-mono">{post.comment_count}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Expanded Comments Section */}
                <AnimatePresence>
                  {activeCommentsPostId === post.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-4 pt-4 border-t border-ink/5 overflow-hidden"
                    >
                      <h4 className="text-xs font-bold text-ink uppercase tracking-wider mb-3">Conversation</h4>

                      {/* Comment list */}
                      <div className="space-y-3 mb-4">
                        {comments[post.id]?.length === 0 && (
                          <p className="text-xs text-sage italic py-1">No talk in this knot. Be the first to add to the conversation.</p>
                        )}

                        {comments[post.id]?.map((comment) => (
                          <div key={comment.id} className="flex gap-2.5 p-3 rounded-2xl bg-cream/25 border border-ink/5">
                            <div 
                              onClick={() => onNavigate('profile', comment.author.username)}
                              className="w-7 h-7 rounded-full bg-crimson/5 border border-crimson/20 flex items-center justify-center text-crimson font-bold text-xs cursor-pointer overflow-hidden shrink-0"
                            >
                              {comment.author.profile_picture ? (
                                <img referrerPolicy="no-referrer" src={comment.author.profile_picture} alt={comment.author.display_name} className="w-full h-full object-cover" />
                              ) : (
                                comment.author.display_name.charAt(0).toUpperCase()
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1 mb-0.5">
                                <span 
                                  onClick={() => onNavigate('profile', comment.author.username)}
                                  className="text-xs font-bold text-ink hover:text-crimson cursor-pointer truncate"
                                >
                                  {comment.author.display_name}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[9px] font-mono text-sage">{formatTime(comment.timestamp)}</span>
                                  {currentUser && comment.author.id === currentUser.id && (
                                    <button
                                      id={`delete-comment-${comment.id}-btn`}
                                      onClick={() => handleCommentDelete(post.id, comment.id)}
                                      className="p-0.5 text-sage hover:text-crimson rounded transition-all"
                                      title="Delete Comment"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                              <p className="text-xs text-ink leading-relaxed wrap-break-word whitespace-pre-wrap select-text">
                                {comment.content}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Comment Input */}
                      {currentUser ? (
                        <form onSubmit={(e) => handleCommentSubmit(post.id, e)} className="flex items-center gap-2">
                          <input
                            id={`comment-input-${post.id}`}
                            type="text"
                            maxLength={150}
                            placeholder="Add your piece to the thread..."
                            value={newCommentContent}
                            onChange={(e) => setNewCommentContent(e.target.value)}
                            className="flex-1 text-xs bg-cream/30 border border-ink/10 rounded-2xl px-4 py-2.5 focus:border-crimson focus:outline-none transition-colors text-ink"
                          />
                          <button
                            type="submit"
                            id={`submit-comment-${post.id}`}
                            disabled={commentingPostId === post.id || !newCommentContent.trim()}
                            className="p-2.5 bg-crimson hover:bg-crimson/95 disabled:bg-crimson/30 text-white rounded-2xl shadow-sm transition-all"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        </form>
                      ) : (
                        <div className="text-center p-3 bg-cream/30 rounded-xl border border-dashed border-ink/10">
                          <p className="text-xs text-sage">
                            Please{' '}
                            <button onClick={() => onNavigate('auth')} className="text-crimson font-bold hover:underline">
                              sign in
                            </button>{' '}
                            to join the conversation.
                          </p>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.article>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
