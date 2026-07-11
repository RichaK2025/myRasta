import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { v4 as uuidv4 } from 'uuid';
import { summarizeRoute } from '@/lib/emergent';

export const runtime = 'nodejs';
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
    if (segments.length === 0) {
      return NextResponse.json({ ok: true, service: 'raasta' });
    }

    // GET /api/routes
    if (segments[0] === 'routes' && segments.length === 1) {
      const url = new URL(request.url);
      const mine = url.searchParams.get('user_id');
      const sort = url.searchParams.get('sort') || 'recent';
      const q = mine ? { user_id: mine } : {};
      let sortSpec = { created_at: -1 };
      if (sort === 'popular') sortSpec = { likes: -1, views: -1 };
      if (sort === 'trending') sortSpec = { views: -1, created_at: -1 };
      const docs = await db
        .collection('routes')
        .find(q)
        .sort(sortSpec)
        .limit(100)
        .toArray();
      return NextResponse.json(docs.map(stripId));
    }

    // GET /api/routes/share/:code
    if (segments[0] === 'routes' && segments[1] === 'share' && segments[2]) {
      const doc = await db.collection('routes').findOne({ share_code: segments[2] });
      if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      await db.collection('routes').updateOne({ id: doc.id }, { $inc: { views: 1 } });
      return NextResponse.json(stripId(doc));
    }

    // GET /api/routes/:id/comments
    if (segments[0] === 'routes' && segments[1] && segments[2] === 'comments') {
      const docs = await db
        .collection('comments')
        .find({ route_id: segments[1] })
        .sort({ created_at: -1 })
        .toArray();
      return NextResponse.json(docs.map(stripId));
    }

    // GET /api/routes/:id/conditions
    if (segments[0] === 'routes' && segments[1] && segments[2] === 'conditions') {
      const docs = await db
        .collection('conditions')
        .find({ route_id: segments[1] })
        .sort({ created_at: -1 })
        .limit(50)
        .toArray();
      return NextResponse.json(docs.map(stripId));
    }

    // GET /api/routes/:id
    if (segments[0] === 'routes' && segments[1]) {
      const doc = await db.collection('routes').findOne({ id: segments[1] });
      if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json(stripId(doc));
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
    // POST /api/routes  -> create
    if (segments[0] === 'routes' && segments.length === 1) {
      const body = await request.json();
      const id = uuidv4();
      let share_code = shortCode(6);
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
        rating_avg: 0,
        rating_count: 0,
        ai_summary: null,
        created_at: new Date().toISOString(),
      };
      await db.collection('routes').insertOne(doc);
      return NextResponse.json(stripId(doc));
    }

    // POST /api/routes/:id/like
    if (segments[0] === 'routes' && segments[1] && segments[2] === 'like') {
      const body = await request.json().catch(() => ({}));
      const delta = body.unlike ? -1 : 1;
      await db.collection('routes').updateOne(
        { id: segments[1] },
        { $inc: { likes: delta } }
      );
      const doc = await db.collection('routes').findOne({ id: segments[1] });
      return NextResponse.json(stripId(doc));
    }

    // POST /api/routes/:id/rate
    if (segments[0] === 'routes' && segments[1] && segments[2] === 'rate') {
      const body = await request.json();
      const stars = Math.min(5, Math.max(1, parseInt(body.stars, 10) || 5));
      const rating = {
        id: uuidv4(),
        route_id: segments[1],
        user_id: body.user_id || 'anon',
        stars,
        created_at: new Date().toISOString(),
      };
      // upsert one rating per user per route
      await db.collection('ratings').updateOne(
        { route_id: segments[1], user_id: rating.user_id },
        { $set: rating },
        { upsert: true }
      );
      const all = await db.collection('ratings').find({ route_id: segments[1] }).toArray();
      const avg = all.reduce((a, r) => a + r.stars, 0) / all.length;
      await db.collection('routes').updateOne(
        { id: segments[1] },
        { $set: { rating_avg: avg, rating_count: all.length } }
      );
      return NextResponse.json({ rating_avg: avg, rating_count: all.length });
    }

    // POST /api/routes/:id/comments
    if (segments[0] === 'routes' && segments[1] && segments[2] === 'comments') {
      const body = await request.json();
      const comment = {
        id: uuidv4(),
        route_id: segments[1],
        user_id: body.user_id || 'anon',
        author: body.author || 'Anonymous',
        text: (body.text || '').trim().slice(0, 500),
        created_at: new Date().toISOString(),
      };
      if (!comment.text) return NextResponse.json({ error: 'Empty comment' }, { status: 400 });
      await db.collection('comments').insertOne(comment);
      return NextResponse.json(stripId(comment));
    }

    // POST /api/routes/:id/conditions
    if (segments[0] === 'routes' && segments[1] && segments[2] === 'conditions') {
      const body = await request.json();
      const condition = {
        id: uuidv4(),
        route_id: segments[1],
        user_id: body.user_id || 'anon',
        author: body.author || 'Anonymous',
        type: body.type || 'info', // pothole, traffic, roadblock, weather, info
        text: (body.text || '').trim().slice(0, 300),
        km_mark: body.km_mark || null,
        created_at: new Date().toISOString(),
      };
      await db.collection('conditions').insertOne(condition);
      return NextResponse.json(stripId(condition));
    }

    // POST /api/routes/:id/summarize -> AI summary
    if (segments[0] === 'routes' && segments[1] && segments[2] === 'summarize') {
      const doc = await db.collection('routes').findOne({ id: segments[1] });
      if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      const summary = await summarizeRoute(doc);
      await db.collection('routes').updateOne(
        { id: segments[1] },
        { $set: { ai_summary: summary } }
      );
      return NextResponse.json(summary);
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
    if (segments[0] === 'routes' && segments[1] && segments.length === 2) {
      await db.collection('routes').deleteOne({ id: segments[1] });
      await db.collection('comments').deleteMany({ route_id: segments[1] });
      await db.collection('ratings').deleteMany({ route_id: segments[1] });
      await db.collection('conditions').deleteMany({ route_id: segments[1] });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
