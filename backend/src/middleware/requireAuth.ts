import { Request, Response, NextFunction } from 'express';
import { supabase } from '../db/supabase';
import { query } from '../db/index';

// Cache token→auth con TTL breve: evita il round-trip HTTP a Supabase
// (~100-300 ms) e la query User per ogni richiesta dello stesso utente.
// Trade-off: un token revocato resta accettato per al più AUTH_CACHE_TTL_MS.
const AUTH_CACHE_TTL_MS = 60_000;
const AUTH_CACHE_MAX_ENTRIES = 500;
type CachedAuth = { auth: NonNullable<Request['auth']>; expires: number };
const authCache = new Map<string, CachedAuth>();

function cacheGet(token: string): CachedAuth['auth'] | null {
  const hit = authCache.get(token);
  if (!hit) return null;
  if (hit.expires < Date.now()) {
    authCache.delete(token);
    return null;
  }
  return hit.auth;
}

function cacheSet(token: string, auth: CachedAuth['auth']): void {
  if (authCache.size >= AUTH_CACHE_MAX_ENTRIES) {
    const oldest = authCache.keys().next().value;
    if (oldest !== undefined) authCache.delete(oldest);
  }
  authCache.set(token, { auth, expires: Date.now() + AUTH_CACHE_TTL_MS });
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.auth) return next();

  if (process.env.NODE_ENV === 'test' && process.env.JEST_WORKER_ID !== undefined) {
    req.auth = { userId: 1, role: 'dm', email: 'test@test.com', supabaseUid: 'test-uid' };
    return next();
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing token' });
    }
    const token = authHeader.slice(7);

    const cached = cacheGet(token);
    if (cached) {
      req.auth = cached;
      return next();
    }

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
    cacheSet(token, req.auth);
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}
