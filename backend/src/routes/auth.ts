import { Router } from 'express';
import { supabase } from '../db/supabase';

const router = Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Auth service not configured' });
  const { email, password } = req.body;

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return res.status(401).json({ error: error.message });
    }

    res.json({
      token: data.session?.access_token,
      user: {
        id: data.user?.id,
        email: data.user?.email,
        role: data.user?.user_metadata?.role || 'pm', // default role
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Auth service not configured' });
  try {
    const { error } = await supabase.auth.signOut();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: 'Logged out' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
