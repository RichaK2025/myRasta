// Short, unambiguous alphanumeric code — shared by route share_code and
// group invite_code (both need the same "type it or scan it" property).
export function shortCode(len = 6) {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
