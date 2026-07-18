import jwt from 'jsonwebtoken';

// Resolves the signed-in Google user (if any) from the auth_token cookie set by
// /api/auth/google. Returns null for anonymous requests — callers should fall
// back to a client-supplied anonymous id in that case.
export function getAuthUser(request) {
  const token = request.cookies.get('auth_token')?.value;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    return { googleId: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}

// Resolves the user_id to persist on a document: prefer the authenticated
// Google identity, and only trust a client-supplied anonymous id otherwise.
export function resolveUserId(request, fallbackAnonId) {
  const authUser = getAuthUser(request);
  if (authUser) return `g_${authUser.googleId}`;
  return fallbackAnonId || 'anon';
}
