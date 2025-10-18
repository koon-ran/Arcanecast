import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Cron job to archive old nomination polls
 * Runs daily at 02:00 UTC
 * Archives polls older than 30 days that weren't promoted
 */
export async function GET(request: Request) {
  try {
    // Verify this is a legitimate cron request
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[CRON] Starting archive-nominations job...');

    // Calculate cutoff date (30 days ago)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);

    console.log(`[CRON] Archiving polls created before ${cutoffDate.toISOString()}`);

    // Find old nomination polls that weren't promoted
    const { data: oldPolls, error: fetchError } = await supabase
      .from('dao_polls')
      .select('id, question, created_at, selection_count')
      .eq('status', 'nomination')
      .eq('section', 'nomination')
      .lt('created_at', cutoffDate.toISOString());

    if (fetchError) {
      console.error('[CRON] Error fetching old polls:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!oldPolls || oldPolls.length === 0) {
      console.log('[CRON] No polls to archive');
      return NextResponse.json({ 
        message: 'No polls to archive',
        archived: 0 
      });
    }

    console.log(`[CRON] Found ${oldPolls.length} polls to archive`);

    // Archive polls
    const pollIds = oldPolls.map(p => p.id);
    const { error: updateError } = await supabase
      .from('dao_polls')
      .update({
        status: 'archived',
        section: 'archived',
        archived_at: new Date().toISOString(),
      })
      .in('id', pollIds);

    if (updateError) {
      console.error('[CRON] Error archiving polls:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    console.log(`[CRON] Archived ${pollIds.length} polls`);

    // Clean up selections for archived polls (optional - keeps database tidy)
    const { error: deleteSelectionsError } = await supabase
      .from('selections')
      .delete()
      .in('poll_id', pollIds);

    if (deleteSelectionsError) {
      console.warn('[CRON] Error deleting selections:', deleteSelectionsError);
    } else {
      console.log('[CRON] Cleaned up selections for archived polls');
    }

    // Summary of archived polls
    const archivedSummary = oldPolls.map(p => ({
      id: p.id,
      question: p.question,
      created_at: p.created_at,
      selections: p.selection_count,
    }));

    console.log('[CRON] Archive complete:', archivedSummary);

    return NextResponse.json({
      success: true,
      archived: pollIds.length,
      polls: archivedSummary,
      cutoffDate: cutoffDate.toISOString(),
    });

  } catch (error: any) {
    console.error('[CRON] Archive nominations error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
