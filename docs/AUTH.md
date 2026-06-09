# Authentication & Authorization Guide

This document describes how authentication and role-based access control (RBAC) work in the Project Forecast App.

## Overview

The app uses **Supabase Auth** for login and a custom **JWT token verification** flow for API access. Users are provisioned in the local `User` table with a `supabase_uid` foreign key reference.

```
User (frontend)
  → POST /api/auth/login (email, password)
  → Supabase Auth (signInWithPassword)
  → JWT token + session
  → Store token in localStorage + AuthContext
  → Include Bearer token in all API requests
  
Protected API routes
  → GET /api/projects
  → requireAuth middleware
  → Verify token with Supabase.auth.getUser()
  → Look up user in local DB by supabase_uid
  → Attach req.auth { userId, role, email, supabaseUid }
  → Route handler uses req.auth for pm_id filtering
```

---

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ Frontend (React + AuthContext)                                  │
│ ┌──────────────────────────────────────────────────────────────┐│
│ │ Login Page                                                   ││
│ │  email + password → submitLogin()                           ││
│ │  → POST /api/auth/login                                     ││
│ └──────────────────────────────────────────────────────────────┘│
└──────────────────────┬──────────────────────────────────────────┘
                       │
       ┌───────────────▼───────────────┐
       │ POST /api/auth/login          │
       │ (backend route handler)       │
       │                               │
       │ 1. Extract email, password    │
       │ 2. supabase.auth              │
       │    .signInWithPassword()      │
       │ 3. Query User by supabase_uid │
       │ 4. Return token + user object │
       └───────────────┬───────────────┘
                       │
       ┌───────────────▼───────────────────────┐
       │ Supabase Auth Service                 │
       │                                       │
       │ Check email/password against          │
       │ Supabase's auth table                 │
       │ Return access_token if valid          │
       └───────────────┬───────────────────────┘
                       │
       ┌───────────────▼──────────────────────────────────────┐
       │ Local Database (PostgreSQL)                          │
       │                                                      │
       │ SELECT id, role, name FROM "User"                   │
       │ WHERE supabase_uid = $1                             │
       │                                                      │
       │ Join: Supabase UUID → Local user record             │
       └───────────────┬──────────────────────────────────────┘
                       │
       ┌───────────────▼──────────────────────────────┐
       │ Response: 200 OK                             │
       │ {                                            │
       │   token: "eyJhbGc...",                       │
       │   user: {                                    │
       │     id: 1,          ← local user ID          │
       │     role: "pm",                              │
       │     email: "pm@....",                        │
       │     name: "Alice"                            │
       │   }                                          │
       │ }                                            │
       └───────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────────┐
│ Frontend: AuthContext.setAuth(token, user)                      │
│  → localStorage.setItem('token', token)                         │
│  → localStorage.setItem('user', JSON.stringify(user))           │
│  → Redirect to /projects                                        │
└──────────────────────────────────────────────────────────────────┘
```

---

## Backend Implementation

### 1. Supabase Client Setup

**File:** `backend/src/db/supabase.ts`

```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
```

**Key points:**
- Uses **service role key** (not anon key) — allows admin-level auth operations
- If credentials are missing, routes return 503 Service Unavailable
- Only used for login/logout; **not for data queries**

### 2. Login Route

**File:** `backend/src/routes/auth.ts`

```typescript
router.post('/login', async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Auth service not configured' });
  
  const { email, password } = req.body;

  try {
    // 1. Authenticate with Supabase
    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !authData.user || !authData.session) {
      return res.status(401).json({ error: error?.message ?? 'Authentication failed' });
    }

    // 2. Look up user in local DB by Supabase UUID
    const userResult = await query(
      'SELECT id, role, name FROM "User" WHERE supabase_uid = $1',
      [authData.user.id]
    );

    if (!userResult.rowCount) {
      return res.status(403).json({ error: 'User not provisioned' });
    }

    const dbUser = userResult.rows[0];

    // 3. Return token + local user metadata
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
    res.status(500).json({ error: err.message });
  }
});
```

**Flow:**
1. **Authenticate** — Check email/password against Supabase Auth
2. **Provision check** — Verify user exists in local `User` table (bridges Supabase ↔ local DB)
3. **Return JWT + metadata** — Frontend stores token in localStorage, includes user info

### 3. requireAuth Middleware

**File:** `backend/src/middleware/requireAuth.ts`

```typescript
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  // Test mode: bypass auth
  if (process.env.NODE_ENV === 'test') {
    req.auth = { userId: 1, role: 'dm', email: 'test@test.com', supabaseUid: 'test-uid' };
    return next();
  }

  // 1. Extract Bearer token
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }
  const token = authHeader.slice(7);

  if (!supabase) {
    return res.status(503).json({ error: 'Auth service unavailable' });
  }

  // 2. Verify token with Supabase
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // 3. Look up user in local DB
  const result = await query(
    'SELECT id, role FROM "User" WHERE supabase_uid = $1',
    [data.user.id]
  );
  if (result.rowCount === 0) {
    return res.status(403).json({ error: 'User not provisioned' });
  }

  // 4. Attach auth context to request
  req.auth = {
    userId: result.rows[0].id,
    role: result.rows[0].role,
    email: data.user.email ?? '',
    supabaseUid: data.user.id,
  };
  next();
}
```

**Protection strategy:**
- **Every protected route** is wrapped with `requireAuth` middleware
- **Token verification** happens with Supabase, not locally
- **User provisioning** enforces that every authenticated Supabase user must exist in the local DB
- **req.auth** object is attached for downstream use (filtering by `pm_id`, role checks, etc.)

### 4. Role-Based Access Control

**File:** `backend/src/middleware/requireAuth.ts`

```typescript
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}
```

**Usage in routes:**
```typescript
// Example: Only DMs can view portfolio
app.use('/api/dm/portfolio', requireAuth, requireRole('dm'), portfolioRouter);

// Example: PMs and DMs can access projects
app.use('/api/projects', requireAuth, projectsRouter);
```

### 5. Project Ownership Filtering

**File:** `backend/src/routes/projects.ts`

```typescript
router.get('/', async (req, res) => {
  try {
    const { userId } = req.auth;

    const result = await query(
      `SELECT * FROM "Project"
       WHERE pm_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
```

**Key principle:** All project queries filter by `pm_id = req.auth.userId`. A PM sees only their own projects.

### 6. Logout

**File:** `backend/src/routes/auth.ts`

```typescript
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
```

On the frontend, the `AuthContext.logout()` also clears localStorage.

---

## Frontend Implementation

### AuthContext

**File:** `frontend/src/contexts/AuthContext.tsx`

```typescript
interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  setAuth: (token: string, user: AuthUser) => void;
  logout: () => void;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [user, setUser] = useState<AuthUser | null>(() => {
    const stored = localStorage.getItem('user');
    return stored ? (JSON.parse(stored) as AuthUser) : null;
  });

  // Listen for auth state changes (token refresh, logout)
  useEffect(() => {
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
          setToken(null);
          setUser(null);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
        if (event === 'TOKEN_REFRESHED' && session) {
          const newToken = session.access_token;
          localStorage.setItem('token', newToken);
          setToken(newToken);
        }
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  const setAuth = useCallback((newToken: string, newUser: AuthUser) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    // Clear local state
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, setAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
```

### Login Page

**File:** `frontend/src/pages/Login.tsx`

```typescript
function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { setAuth } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(`Login failed: ${err.error}`);
        return;
      }

      const { token, user } = await res.json();
      setAuth(token, user);
      navigate('/projects');
    } catch (err) {
      console.error(err);
      alert('Network error');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input value={email} onChange={e => setEmail(e.target.value)} />
      <input type="password" value={password} onChange={e => setPassword(e.target.value)} />
      <button type="submit">Login</button>
    </form>
  );
}
```

### API Client with Bearer Token

**File:** `frontend/src/api/client.ts`

```typescript
export async function apiClient(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = localStorage.getItem('token');

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${import.meta.env.VITE_API_URL}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    // Token expired or invalid — redirect to login
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  }

  return res;
}
```

### Protected Route Component

**File:** `frontend/src/components/ProtectedRoute.tsx`

```typescript
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();

  if (!token) {
    return <Navigate to="/login" />;
  }

  return <>{children}</>;
}
```

Usage in `App.tsx`:
```typescript
<Route path="/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
```

---

## User Provisioning

Before a user can log in, they must:

1. **Be created in Supabase Auth** — Email/password account
2. **Be created in local `User` table** — With `supabase_uid` set to their Supabase UUID

### Steps to provision a user:

1. Create Supabase auth account:
   ```
   Supabase Dashboard → Authentication → Users → Add User
   Email: pm@example.com
   Password: (auto-generated)
   ```

2. Note the user's UUID from Supabase (e.g., `123e4567-e89b-12d3-a456-426614174000`)

3. Insert into local DB:
   ```sql
   INSERT INTO "User" (email, name, role, supabase_uid, password_hash)
   VALUES (
     'pm@example.com',
     'Alice PM',
     'pm',
     '123e4567-e89b-12d3-a456-426614174000',
     ''  -- password_hash is unused (auth via Supabase)
   );
   ```

### Environment Variables

**Backend** (`backend/.env`):
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Frontend** (`frontend/.env.local`):
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_USE_MOCK=false  # Set true to bypass auth entirely (mock mode)
```

---

## Mock Mode

For local development without Supabase:

**Frontend** (`frontend/.env.local`):
```
VITE_USE_MOCK=true
```

This bypasses the login and uses mock data (`frontend/src/mocks/mockData.ts`). The frontend stores a fake token (`mock-jwt-token-dev`) in localStorage, and API calls are intercepted and return mock responses.

---

## Token Refresh

Supabase automatically handles token refresh via the `onAuthStateChange` listener in `AuthContext`.

```typescript
if (event === 'TOKEN_REFRESHED' && session) {
  const newToken = session.access_token;
  localStorage.setItem('token', newToken);
  setToken(newToken);
}
```

When the backend gets an invalid token:
```typescript
if (res.status === 401) {
  localStorage.removeItem('token');
  window.location.href = '/login';  // Force re-login
}
```

---

## Test Mode

In `NODE_ENV=test`, the `requireAuth` middleware skips verification and injects a test user:

```typescript
if (process.env.NODE_ENV === 'test') {
  req.auth = { userId: 1, role: 'dm', email: 'test@test.com', supabaseUid: 'test-uid' };
  return next();
}
```

This allows integration tests to run without a real Supabase instance.

---

## Security Considerations

1. **Bearer tokens in localStorage** — Vulnerable to XSS. Use `httpOnly` cookies in production (requires backend cookie handling).
2. **Service role key** — Has full admin access to Supabase. Store securely (use environment variables, Vercel secrets).
3. **Token expiration** — Supabase tokens expire after 1 hour. Refresh tokens are used for automatic renewal.
4. **pm_id filtering** — Enforced at the query level; a PM cannot see other PMs' projects.
5. **Role-based routes** — DM-only endpoints use `requireRole('dm')` middleware.

---

## Deployment Checklist

- [ ] Create Supabase project (free tier OK for POC)
- [ ] Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in Vercel environment
- [ ] Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel environment
- [ ] Provision all users in Supabase Auth + local `User` table
- [ ] Test login flow in production
- [ ] Monitor Supabase logs for failed authentications
- [ ] Set up alerts for token verification failures (403 errors)

---

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| 503 Auth service not configured | Missing Supabase env vars | Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` |
| 401 Invalid token | Token expired or malformed | User must log in again |
| 403 User not provisioned | User exists in Supabase but not in local DB | INSERT into `User` table with matching `supabase_uid` |
| CORS error on login | Frontend → backend auth request blocked | Check CORS config in `backend/src/index.ts` |
| Token not sent in requests | Authorization header missing | Check `apiClient()` in `frontend/src/api/client.ts` |

