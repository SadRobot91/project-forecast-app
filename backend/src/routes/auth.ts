import { Router } from 'express';
import { supabase } from '../db/supabase';
import { query } from '../db/index';

const router = Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Auth service not configured' });
  const { email, password } = req.body;

  try {
    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !authData.user || !authData.session) {
      return res.status(401).json({ error: error?.message ?? 'Authentication failed' });
    }

    const userResult = await query(
      'SELECT id, role, name FROM "User" WHERE supabase_uid = $1',
      [authData.user.id]
    );

    if (!userResult.rowCount) {
      return res.status(403).json({ error: 'User not provisioned' });
    }

    const dbUser = userResult.rows[0];

    res.json({
      token: authData.session.access_token,
      user: {
        id: dbUser.id,
        role: dbUser.role,
        email: authData.user.email,
        name: dbUser.name,
      },
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Auth service not configured' });
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (token) {
      const { error } = await supabase.auth.admin.signOut(token);
      if (error) console.error('Logout signOut failed:', error.message);
    }
    res.json({ message: 'Logged out' });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
