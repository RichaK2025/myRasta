import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

function shortCode(len = 6) {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function stripId(doc) {
  if (!doc) return doc;
  const { _id, ...rest } = doc;
  return rest;
}

export async function GET(request, { params }) {
  const resolved = await params;
  const segments = (resolved?.path) || [];
  const db = await getDb();

  try {
    // GET /api/routes  -> list all public routes
    if (segments[0] === 'routes' && segments.length === 1) {
      const url = new URL(request.url);
      const mine = url.searchParams.get('user_id');
      const q = mine ? { user_id: mine } : {};
      const docs = await db
        .collection('routes')
        .find(q)
        .sort({ created_at: -1 })
        .limit(100)
        .toArray();
      return NextResponse.json(docs.map(stripId));
    }

    // GET /api/routes/share/:code
    if (segments[0] === 'routes' && segments[1] === 'share' && segments[2]) {
      const doc = await db.collection('routes').findOne({ share_code: segments[2] });
      if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      // increment views
      await db.collection('routes').updateOne(
        { id: doc.id },
        { $inc: { views: 1 } }
      );
      return NextResponse.json(stripId(doc));
    }

    // GET /api/routes/:id
    if (segments[0] === 'routes' && segments[1]) {
      const doc = await db.collection('routes').findOne({ id: segments[1] });
      if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json(stripId(doc));
    }

    // GET /api  -> health
    if (segments.length === 0) {
      return NextResponse.json({ ok: true, service: 'raasta' });
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  const resolved = await params;
  const segments = (resolved?.path) || [];
  const db = await getDb();

  try {
    // POST /api/routes  -> create route
    if (segments[0] === 'routes' && segments.length === 1) {
      const body = await request.json();
      const id = uuidv4();
      let share_code = shortCode(6);
      // ensure unique share_code
      while (await db.collection('routes').findOne({ share_code })) {
        share_code = shortCode(6);
      }
      const doc = {
        id,
        share_code,
        name: body.name || 'Untitled Route',
        description: body.description || '',
        route_type: body.route_type || 'General',
        tags: Array.isArray(body.tags) ? body.tags : [],
        notes: body.notes || '',
        cover_image: body.cover_image || null,
        creator_name: body.creator_name || 'Anonymous',
        user_id: body.user_id || 'anon',
        points: Array.isArray(body.points) ? body.points : [],
        distance_km: body.distance_km || 0,
        duration_sec: body.duration_sec || 0,
        avg_speed_kmh: body.avg_speed_kmh || 0,
        max_speed_kmh: body.max_speed_kmh || 0,
        start: body.start || null,
        end: body.end || null,
        views: 0,
        likes: 0,
        saves: 0,
        created_at: new Date().toISOString(),
      };
      await db.collection('routes').insertOne(doc);
      return NextResponse.json(stripId(doc));
    }

    // POST /api/routes/:id/like
    if (segments[0] === 'routes' && segments[1] && segments[2] === 'like') {
      await db.collection('routes').updateOne(
        { id: segments[1] },
        { $inc: { likes: 1 } }
      );
      const doc = await db.collection('routes').findOne({ id: segments[1] });
      return NextResponse.json(stripId(doc));
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const resolved = await params;
  const segments = (resolved?.path) || [];
  const db = await getDb();
  try {
    if (segments[0] === 'routes' && segments[1]) {
      await db.collection('routes').deleteOne({ id: segments[1] });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
