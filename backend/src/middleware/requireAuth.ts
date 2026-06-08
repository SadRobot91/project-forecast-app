import { Request, Response, NextFunction } from 'express';
import { supabase } from '../db/supabase';
import { query } from '../db/index';

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV === 'test') {
    req.auth = { userId: 1, role: 'dm', email: 'test@test.com', supabaseUid: 'test-uid' };
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }
  const token = authHeader.slice(7);

  if (!supabase) {
    return res.status(503).json({ error: 'Auth service unavailable' });
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const result = await query(
    'SELECT id, role FROM "User" WHERE supabase_uid = $1',
    [data.user.id]
  );
  if (result.rowCount === 0) {
    return res.status(403).json({ error: 'User not provisioned' });
  }

  req.auth = {
    userId: result.rows[0].id,
    role: result.rows[0].role,
    email: data.user.email ?? '',
    supabaseUid: data.user.id,
  };
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}
