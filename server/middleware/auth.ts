import { Request, Response, NextFunction } from 'express';
import { db } from '../database/db';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    username: string;
    display_name: string;
    bio: string | null;
    profile_picture: string | null;
    join_date: string;
  };
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  let token = req.cookies.token;

  // Fallback to Authorization Bearer token
  if (!token && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      token = parts[1];
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }

  try {
    // Look up session
    const session = db.prepare('SELECT user_id, expires_at FROM sessions WHERE token = ?').get(token) as { user_id: number; expires_at: string } | undefined;
    if (!session) {
      res.clearCookie('token', { httpOnly: true, secure: true, sameSite: 'none' });
      return res.status(401).json({ error: 'Session expired or invalid.' });
    }

    if (new Date(session.expires_at) < new Date()) {
      db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
      res.clearCookie('token', { httpOnly: true, secure: true, sameSite: 'none' });
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }

    const user = db.prepare('SELECT id, username, display_name, bio, profile_picture, join_date FROM users WHERE id = ?').get(session.user_id) as AuthenticatedRequest['user'] | undefined;
    if (!user) {
      db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
      res.clearCookie('token', { httpOnly: true, secure: true, sameSite: 'none' });
      return res.status(401).json({ error: 'User not found.' });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('Error in requireAuth middleware:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  let token = req.cookies.token;

  // Fallback to Authorization Bearer token
  if (!token && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      token = parts[1];
    }
  }

  if (!token) {
    return next();
  }

  try {
    const session = db.prepare('SELECT user_id, expires_at FROM sessions WHERE token = ?').get(token) as { user_id: number; expires_at: string } | undefined;
    if (!session || new Date(session.expires_at) < new Date()) {
      return next();
    }

    const user = db.prepare('SELECT id, username, display_name, bio, profile_picture, join_date FROM users WHERE id = ?').get(session.user_id) as AuthenticatedRequest['user'] | undefined;
    if (user) {
      req.user = user;
    }
    next();
  } catch (err) {
    console.error('Error in optionalAuth middleware:', err);
    next();
  }
}
