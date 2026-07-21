import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Cheap distinct() over an indexed field — used to populate city filter
// dropdowns (Explore, Leaderboards) without a heavier aggregation.
export async function GET() {
  if (!process.env.MONGO_URL) {
    return NextResponse.json([]);
  }
  try {
    const db = await getDb();
    const cities = await db.collection('routes').distinct('city', { is_public: true, city: { $ne: null } });
    return NextResponse.json(cities.sort());
  } catch (error) {
    console.error('GET /api/routes/cities failed:', error);
    return NextResponse.json([]);
  }
}
