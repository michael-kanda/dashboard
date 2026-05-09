// src/app/api/setup-prompt-tracking/route.ts
import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { auth } from '@/lib/auth';

export async function GET() {
  try {
    const session = await auth();
    if (session?.user?.role !== 'SUPERADMIN') {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 403 });
    }

    await sql`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS brand_keywords TEXT[] DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS settings_show_prompt_tracking BOOLEAN DEFAULT FALSE;
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS prompt_cluster_history (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date_range VARCHAR(20) NOT NULL,
        queries_hash VARCHAR(64) NOT NULL,
        result JSONB NOT NULL,
        query_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_prompt_cluster_history_user_created
      ON prompt_cluster_history(user_id, created_at DESC);
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_prompt_cluster_history_hash
      ON prompt_cluster_history(user_id, queries_hash, created_at DESC);
    `;

    return NextResponse.json({
      message: 'Prompt-Tracking-Schema erfolgreich geprüft/erstellt',
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: 'Fehler beim Einrichten von Prompt Tracking',
        error: error instanceof Error ? error.message : 'Unbekannter Fehler',
      },
      { status: 500 }
    );
  }
}
