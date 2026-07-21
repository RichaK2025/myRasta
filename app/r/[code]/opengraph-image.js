import { ImageResponse } from 'next/og';

export const contentType = 'image/png';
export const size = { width: 1200, height: 630 };
export const alt = 'Route shared on Raasta';

const TAG_EMOJI = {
  'Rain Safe': '🌧', 'Monsoon Safe': '🌧', Scenic: '🌄', 'Family Friendly': '👨‍👩‍👧',
  'Women Safe': '🛡', 'Bike Route': '🏍', 'Truck Friendly': '🚛', Pilgrimage: '🙏',
  'Avoid Traffic': '🚦', 'Village Route': '🏘', Adventure: '⛰', Fastest: '⚡',
};

export default async function Image({ params }) {
  const { code } = await params;
  let route = null;
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/routes/share/${code}`, { cache: 'no-store' });
    if (res.ok) route = await res.json();
  } catch {}

  const name = route?.name || 'Route on Raasta';
  const creator = route?.creator_name || 'a local';
  const distance = route?.distance_km ? `${route.distance_km.toFixed(1)} km` : '';
  const duration = route?.duration_sec ? `${Math.round(route.duration_sec / 60)} min` : '';
  const vibe = route?.ai_summary?.vibe;
  const verified = route?.verified_count || 0;
  const tags = (route?.tags || []).slice(0, 3);

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%', width: '100%', display: 'flex', flexDirection: 'column',
          background: 'linear-gradient(135deg, #0a0a0a 0%, #262626 100%)',
          padding: 72, color: 'white', fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            height: 72, width: 72, borderRadius: 20, background: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 40, color: '#0a0a0a', fontWeight: 700,
          }}>R</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 28, fontWeight: 600 }}>Raasta</div>
            <div style={{ fontSize: 18, color: '#a3a3a3' }}>Navigate Like A Local</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 60, flex: 1 }}>
          <div style={{ fontSize: 24, color: '#a3a3a3' }}>Shared by {creator}</div>
          <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.1, marginTop: 12, letterSpacing: -1 }}>
            {name.length > 45 ? name.slice(0, 45) + '…' : name}
          </div>
          {vibe && (
            <div style={{ fontSize: 24, color: '#c084fc', marginTop: 20, fontStyle: 'italic' }}>
              “{vibe}”
            </div>
          )}
          {tags.length > 0 && (
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              {tags.map((tag) => (
                <div key={tag} style={{
                  display: 'flex', fontSize: 20, padding: '8px 18px', borderRadius: 999,
                  background: 'rgba(255,255,255,0.08)', color: '#e5e5e5',
                }}>
                  {TAG_EMOJI[tag] || '📍'} {tag}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 40, marginTop: 20 }}>
          {distance && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 18, color: '#a3a3a3' }}>Distance</div>
              <div style={{ fontSize: 42, fontWeight: 600 }}>{distance}</div>
            </div>
          )}
          {duration && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 18, color: '#a3a3a3' }}>Time</div>
              <div style={{ fontSize: 42, fontWeight: 600 }}>{duration}</div>
            </div>
          )}
          {verified > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 18, color: '#a3a3a3' }}>Verified</div>
              <div style={{ fontSize: 42, fontWeight: 600 }}>{verified} local{verified > 1 ? 's' : ''}</div>
            </div>
          )}
        </div>

        <div style={{
          marginTop: 40, padding: '20px 28px', background: 'rgba(255,255,255,0.05)',
          borderRadius: 20, fontSize: 22, color: '#e5e5e5', display: 'flex',
        }}>
          “Use my Raasta link instead of explaining directions on call.”
        </div>
      </div>
    ),
    { ...size }
  );
}
