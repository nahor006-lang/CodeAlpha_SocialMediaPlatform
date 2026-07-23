import { Router, Response, NextFunction } from 'express';
import { db, hashPassword, verifyPassword } from '../database/db';
import crypto from 'crypto';
import { AuthenticatedRequest, requireAuth, optionalAuth } from '../middleware/auth';

const router = Router();

// ==========================================
// AUTHENTICATION ENDPOINTS
// ==========================================

// Register a new user
router.post('/auth/register', (req, res) => {
  const { username, password, display_name } = req.body;

  if (!username || !password || !display_name) {
    return res.status(400).json({ error: 'Username, password, and display name are required.' });
  }

  const cleanUsername = username.trim().toLowerCase();
  if (cleanUsername.length < 3 || cleanUsername.length > 20) {
    return res.status(400).json({ error: 'Username must be between 3 and 20 characters.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }

  try {
    // Check if user already exists
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(cleanUsername);
    if (existing) {
      return res.status(400).json({ error: 'Username is already taken.' });
    }

    const passHash = hashPassword(password);
    
    // Insert new user
    const result = db.prepare(`
      INSERT INTO users (username, password_hash, display_name, bio, profile_picture)
      VALUES (?, ?, ?, ?, ?)
    `).run(cleanUsername, passHash, display_name.trim(), '', '');

    const userId = result.lastInsertRowid;

    // Create a secure session token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days session

    db.prepare(`
      INSERT INTO sessions (token, user_id, expires_at)
      VALUES (?, ?, ?)
    `).run(token, userId, expiresAt.toISOString());

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    const newUser = db.prepare('SELECT id, username, display_name, bio, profile_picture, join_date FROM users WHERE id = ?').get(userId);
    return res.status(201).json({ user: newUser, token });
  } catch (err: any) {
    console.error('Error in registration:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// Login
router.post('/auth/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const cleanUsername = username.trim().toLowerCase();

  try {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(cleanUsername) as any;
    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(400).json({ error: 'Invalid username or password.' });
    }

    // Create secure session token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days session

    db.prepare(`
      INSERT INTO sessions (token, user_id, expires_at)
      VALUES (?, ?, ?)
    `).run(token, user.id, expiresAt.toISOString());

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    const userProfile = {
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      bio: user.bio,
      profile_picture: user.profile_picture,
      join_date: user.join_date
    };

    return res.json({ user: userProfile, token });
  } catch (err) {
    console.error('Error in login:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// Logout
router.post('/auth/logout', (req, res) => {
  const token = req.cookies.token;
  if (token) {
    try {
      db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    } catch (err) {
      console.error('Error deleting session:', err);
    }
  }
  res.clearCookie('token', {
    httpOnly: true,
    secure: true,
    sameSite: 'none'
  });
  return res.json({ success: true, message: 'Logged out successfully.' });
});

// Get current user details
router.get('/auth/me', optionalAuth, (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    return res.json({ user: null });
  }
  return res.json({ user: req.user });
});

// ==========================================
// USER & PROFILE ENDPOINTS
// ==========================================

// Get user profile details by username
router.get('/users/:username', requireAuth, (req: AuthenticatedRequest, res) => {
  const { username } = req.params;
  const cleanUsername = username.trim().toLowerCase();

  try {
    const targetUser = db.prepare('SELECT id, username, display_name, bio, profile_picture, join_date FROM users WHERE username = ?').get(cleanUsername) as any;
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Followers count
    const followersResult = db.prepare('SELECT COUNT(*) as count FROM followers WHERE following_id = ?').get(targetUser.id) as any;
    const followersCount = followersResult ? followersResult.count : 0;

    // Following count
    const followingResult = db.prepare('SELECT COUNT(*) as count FROM followers WHERE follower_id = ?').get(targetUser.id) as any;
    const followingCount = followingResult ? followingResult.count : 0;

    // Is current user following this user?
    let isFollowing = false;
    if (req.user) {
      const followCheck = db.prepare('SELECT 1 FROM followers WHERE follower_id = ? AND following_id = ?').get(req.user.id, targetUser.id);
      isFollowing = !!followCheck;
    }

    // Get this user's posts
    // We also want to know for each post: like count, comments count, and if current user liked it
    const posts = db.prepare(`
      SELECT p.id, p.content, p.timestamp,
             u.id as author_id, u.username as author_username, u.display_name as author_display_name, u.profile_picture as author_profile_picture,
             (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as like_count,
             (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count,
             ? as current_user_id
       FROM posts p
       JOIN users u ON p.author_id = u.id
       WHERE p.author_id = ?
       ORDER BY p.timestamp DESC
    `).all(req.user ? req.user.id : 0, targetUser.id) as any[];

    // Map posts to see if liked
    const enrichedPosts = posts.map(post => {
      let isLiked = false;
      if (req.user) {
        const likeCheck = db.prepare('SELECT 1 FROM likes WHERE post_id = ? AND user_id = ?').get(post.id, req.user.id);
        isLiked = !!likeCheck;
      }
      return {
        id: post.id,
        content: post.content,
        timestamp: post.timestamp,
        author: {
          id: post.author_id,
          username: post.author_username,
          display_name: post.author_display_name,
          profile_picture: post.author_profile_picture
        },
        like_count: post.like_count,
        comment_count: post.comment_count,
        is_liked: isLiked
      };
    });

    return res.json({
      profile: {
        id: targetUser.id,
        username: targetUser.username,
        display_name: targetUser.display_name,
        bio: targetUser.bio,
        profile_picture: targetUser.profile_picture,
        join_date: targetUser.join_date,
        followers_count: followersCount,
        following_count: followingCount,
        is_following: isFollowing
      },
      posts: enrichedPosts
    });
  } catch (err) {
    console.error('Error fetching user profile:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// Update profile of current user
router.put('/users/profile', requireAuth, (req: AuthenticatedRequest, res) => {
  const { display_name, bio, profile_picture } = req.body;
  const user = req.user!;

  if (!display_name || !display_name.trim()) {
    return res.status(400).json({ error: 'Display name cannot be empty.' });
  }

  try {
    db.prepare(`
      UPDATE users
      SET display_name = ?, bio = ?, profile_picture = ?
      WHERE id = ?
    `).run(display_name.trim(), (bio || '').trim(), (profile_picture || '').trim(), user.id);

    const updatedUser = db.prepare('SELECT id, username, display_name, bio, profile_picture, join_date FROM users WHERE id = ?').get(user.id);
    return res.json({ user: updatedUser, message: 'Profile updated successfully.' });
  } catch (err) {
    console.error('Error updating user profile:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// Follow a user
router.post('/users/:id/follow', requireAuth, (req: AuthenticatedRequest, res) => {
  const targetId = parseInt(req.params.id, 10);
  const user = req.user!;

  if (isNaN(targetId)) {
    return res.status(400).json({ error: 'Invalid user ID.' });
  }

  if (targetId === user.id) {
    return res.status(400).json({ error: 'You cannot follow yourself.' });
  }

  try {
    // Check if target user exists
    const targetUser = db.prepare('SELECT id FROM users WHERE id = ?').get(targetId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User to follow not found.' });
    }

    // Insert follow link, ignore if duplicate
    db.prepare(`
      INSERT OR IGNORE INTO followers (follower_id, following_id)
      VALUES (?, ?)
    `).run(user.id, targetId);

    // Get updated count
    const followersResult = db.prepare('SELECT COUNT(*) as count FROM followers WHERE following_id = ?').get(targetId) as any;
    const followersCount = followersResult ? followersResult.count : 0;

    return res.json({ success: true, message: 'Followed successfully.', followers_count: followersCount });
  } catch (err) {
    console.error('Error following user:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// Unfollow a user
router.post('/users/:id/unfollow', requireAuth, (req: AuthenticatedRequest, res) => {
  const targetId = parseInt(req.params.id, 10);
  const user = req.user!;

  if (isNaN(targetId)) {
    return res.status(400).json({ error: 'Invalid user ID.' });
  }

  try {
    db.prepare(`
      DELETE FROM followers
      WHERE follower_id = ? AND following_id = ?
    `).run(user.id, targetId);

    // Get updated count
    const followersResult = db.prepare('SELECT COUNT(*) as count FROM followers WHERE following_id = ?').get(targetId) as any;
    const followersCount = followersResult ? followersResult.count : 0;

    return res.json({ success: true, message: 'Unfollowed successfully.', followers_count: followersCount });
  } catch (err) {
    console.error('Error unfollowing user:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// Get followers list
router.get('/users/:id/followers', requireAuth, (req: AuthenticatedRequest, res) => {
  const targetId = parseInt(req.params.id, 10);
  if (isNaN(targetId)) {
    return res.status(400).json({ error: 'Invalid user ID.' });
  }

  try {
    const followers = db.prepare(`
      SELECT u.id, u.username, u.display_name, u.bio, u.profile_picture
      FROM followers f
      JOIN users u ON f.follower_id = u.id
      WHERE f.following_id = ?
    `).all(targetId) as any[];

    return res.json({ followers });
  } catch (err) {
    console.error('Error fetching followers:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// Get following list
router.get('/users/:id/following', requireAuth, (req: AuthenticatedRequest, res) => {
  const targetId = parseInt(req.params.id, 10);
  if (isNaN(targetId)) {
    return res.status(400).json({ error: 'Invalid user ID.' });
  }

  try {
    const following = db.prepare(`
      SELECT u.id, u.username, u.display_name, u.bio, u.profile_picture
      FROM followers f
      JOIN users u ON f.following_id = u.id
      WHERE f.follower_id = ?
    `).all(targetId) as any[];

    return res.json({ following });
  } catch (err) {
    console.error('Error fetching following:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ==========================================
// POST ENDPOINTS
// ==========================================

// Get Home Feed (all posts, enriched with counts and is_liked)
router.get('/posts', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const posts = db.prepare(`
      SELECT p.id, p.content, p.timestamp,
             u.id as author_id, u.username as author_username, u.display_name as author_display_name, u.profile_picture as author_profile_picture,
             (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as like_count,
             (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count
      FROM posts p
      JOIN users u ON p.author_id = u.id
      ORDER BY p.timestamp DESC
    `).all() as any[];

    const enrichedPosts = posts.map(post => {
      let isLiked = false;
      if (req.user) {
        const likeCheck = db.prepare('SELECT 1 FROM likes WHERE post_id = ? AND user_id = ?').get(post.id, req.user.id);
        isLiked = !!likeCheck;
      }
      return {
        id: post.id,
        content: post.content,
        timestamp: post.timestamp,
        author: {
          id: post.author_id,
          username: post.author_username,
          display_name: post.author_display_name,
          profile_picture: post.author_profile_picture
        },
        like_count: post.like_count,
        comment_count: post.comment_count,
        is_liked: isLiked
      };
    });

    return res.json({ posts: enrichedPosts });
  } catch (err) {
    console.error('Error fetching feed posts:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// Create a new post
router.post('/posts', requireAuth, (req: AuthenticatedRequest, res) => {
  const { content } = req.body;
  const user = req.user!;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Post content cannot be empty.' });
  }

  if (content.length > 500) {
    return res.status(400).json({ error: 'Post content cannot exceed 500 characters.' });
  }

  try {
    const result = db.prepare(`
      INSERT INTO posts (author_id, content)
      VALUES (?, ?)
    `).run(user.id, content.trim());

    const newPostId = result.lastInsertRowid;

    // Retrieve full post to return
    const post = db.prepare(`
      SELECT p.id, p.content, p.timestamp,
             u.id as author_id, u.username as author_username, u.display_name as author_display_name, u.profile_picture as author_profile_picture
      FROM posts p
      JOIN users u ON p.author_id = u.id
      WHERE p.id = ?
    `).get(newPostId) as any;

    return res.status(201).json({
      post: {
        id: post.id,
        content: post.content,
        timestamp: post.timestamp,
        author: {
          id: post.author_id,
          username: post.author_username,
          display_name: post.author_display_name,
          profile_picture: post.author_profile_picture
        },
        like_count: 0,
        comment_count: 0,
        is_liked: false
      },
      message: 'Post created successfully.'
    });
  } catch (err) {
    console.error('Error creating post:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// Edit user's own post
router.put('/posts/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const postId = parseInt(req.params.id, 10);
  const { content } = req.body;
  const user = req.user!;

  if (isNaN(postId)) {
    return res.status(400).json({ error: 'Invalid post ID.' });
  }

  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Post content cannot be empty.' });
  }

  try {
    // Check ownership
    const post = db.prepare('SELECT author_id FROM posts WHERE id = ?').get(postId) as any;
    if (!post) {
      return res.status(404).json({ error: 'Post not found.' });
    }

    if (post.author_id !== user.id) {
      return res.status(403).json({ error: 'You are not authorized to edit this post.' });
    }

    db.prepare(`
      UPDATE posts
      SET content = ?
      WHERE id = ?
    `).run(content.trim(), postId);

    return res.json({ success: true, message: 'Post updated successfully.' });
  } catch (err) {
    console.error('Error updating post:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// Delete user's own post
router.delete('/posts/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const postId = parseInt(req.params.id, 10);
  const user = req.user!;

  if (isNaN(postId)) {
    return res.status(400).json({ error: 'Invalid post ID.' });
  }

  try {
    // Check ownership
    const post = db.prepare('SELECT author_id FROM posts WHERE id = ?').get(postId) as any;
    if (!post) {
      return res.status(404).json({ error: 'Post not found.' });
    }

    if (post.author_id !== user.id) {
      return res.status(403).json({ error: 'You are not authorized to delete this post.' });
    }

    // SQLite will cascade delete comments, likes etc because we enabled foreign_keys and ON DELETE CASCADE!
    db.prepare('DELETE FROM posts WHERE id = ?').run(postId);

    return res.json({ success: true, message: 'Post deleted successfully.' });
  } catch (err) {
    console.error('Error deleting post:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// Like a post
router.post('/posts/:id/like', requireAuth, (req: AuthenticatedRequest, res) => {
  const postId = parseInt(req.params.id, 10);
  const user = req.user!;

  if (isNaN(postId)) {
    return res.status(400).json({ error: 'Invalid post ID.' });
  }

  try {
    const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found.' });
    }

    db.prepare(`
      INSERT OR IGNORE INTO likes (post_id, user_id)
      VALUES (?, ?)
    `).run(postId, user.id);

    // Get current like count
    const likeCountResult = db.prepare('SELECT COUNT(*) as count FROM likes WHERE post_id = ?').get(postId) as any;
    const likeCount = likeCountResult ? likeCountResult.count : 0;

    return res.json({ success: true, message: 'Post liked.', like_count: likeCount, is_liked: true });
  } catch (err) {
    console.error('Error liking post:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// Unlike a post
router.post('/posts/:id/unlike', requireAuth, (req: AuthenticatedRequest, res) => {
  const postId = parseInt(req.params.id, 10);
  const user = req.user!;

  if (isNaN(postId)) {
    return res.status(400).json({ error: 'Invalid post ID.' });
  }

  try {
    db.prepare(`
      DELETE FROM likes
      WHERE post_id = ? AND user_id = ?
    `).run(postId, user.id);

    // Get current like count
    const likeCountResult = db.prepare('SELECT COUNT(*) as count FROM likes WHERE post_id = ?').get(postId) as any;
    const likeCount = likeCountResult ? likeCountResult.count : 0;

    return res.json({ success: true, message: 'Post unliked.', like_count: likeCount, is_liked: false });
  } catch (err) {
    console.error('Error unliking post:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ==========================================
// COMMENT ENDPOINTS
// ==========================================

// Get comments for a post
router.get('/posts/:postId/comments', (req, res) => {
  const postId = parseInt(req.params.postId, 10);

  if (isNaN(postId)) {
    return res.status(400).json({ error: 'Invalid post ID.' });
  }

  try {
    const comments = db.prepare(`
      SELECT c.id, c.content, c.timestamp,
             u.id as author_id, u.username as author_username, u.display_name as author_display_name, u.profile_picture as author_profile_picture
      FROM comments c
      JOIN users u ON c.author_id = u.id
      WHERE c.post_id = ?
      ORDER BY c.timestamp ASC
    `).all(postId) as any[];

    const formattedComments = comments.map(comment => ({
      id: comment.id,
      content: comment.content,
      timestamp: comment.timestamp,
      author: {
        id: comment.author_id,
        username: comment.author_username,
        display_name: comment.author_display_name,
        profile_picture: comment.author_profile_picture
      }
    }));

    return res.json({ comments: formattedComments });
  } catch (err) {
    console.error('Error fetching comments:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// Add a comment to a post
router.post('/posts/:postId/comments', requireAuth, (req: AuthenticatedRequest, res) => {
  const postId = parseInt(req.params.postId, 10);
  const { content } = req.body;
  const user = req.user!;

  if (isNaN(postId)) {
    return res.status(400).json({ error: 'Invalid post ID.' });
  }

  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Comment content cannot be empty.' });
  }

  try {
    const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found.' });
    }

    const result = db.prepare(`
      INSERT INTO comments (post_id, author_id, content)
      VALUES (?, ?, ?)
    `).run(postId, user.id, content.trim());

    const commentId = result.lastInsertRowid;

    const newComment = db.prepare(`
      SELECT c.id, c.content, c.timestamp,
             u.id as author_id, u.username as author_username, u.display_name as author_display_name, u.profile_picture as author_profile_picture
      FROM comments c
      JOIN users u ON c.author_id = u.id
      WHERE c.id = ?
    `).get(commentId) as any;

    return res.status(201).json({
      comment: {
        id: newComment.id,
        content: newComment.content,
        timestamp: newComment.timestamp,
        author: {
          id: newComment.author_id,
          username: newComment.author_username,
          display_name: newComment.author_display_name,
          profile_picture: newComment.author_profile_picture
        }
      },
      message: 'Comment added successfully.'
    });
  } catch (err) {
    console.error('Error adding comment:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// Delete user's own comment
router.delete('/comments/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const commentId = parseInt(req.params.id, 10);
  const user = req.user!;

  if (isNaN(commentId)) {
    return res.status(400).json({ error: 'Invalid comment ID.' });
  }

  try {
    const comment = db.prepare('SELECT author_id FROM comments WHERE id = ?').get(commentId) as any;
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found.' });
    }

    if (comment.author_id !== user.id) {
      return res.status(403).json({ error: 'You are not authorized to delete this comment.' });
    }

    db.prepare('DELETE FROM comments WHERE id = ?').run(commentId);

    return res.json({ success: true, message: 'Comment deleted successfully.' });
  } catch (err) {
    console.error('Error deleting comment:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
