// API Route: Delete Selection
// DELETE /api/dao/selections/[id]

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const selectionId = params.id;

    if (!selectionId) {
      return NextResponse.json(
        { error: 'Missing selection ID' },
        { status: 400 }
      );
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    // Get selection to verify ownership (optional - can remove if not needed)
    const { data: selection, error: fetchError } = await supabaseAdmin
      .from('selections')
      .select('*')
      .eq('id', selectionId)
      .single();

    if (fetchError || !selection) {
      return NextResponse.json(
        { error: 'Selection not found' },
        { status: 404 }
      );
    }

    // Delete selection (trigger will auto-decrement selection_count)
    const { error: deleteError } = await supabaseAdmin
      .from('selections')
      .delete()
      .eq('id', selectionId);

    if (deleteError) {
      console.error('Error deleting selection:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete selection', details: deleteError.message },
        { status: 500 }
      );
    }

    // Get updated selection count for this week
    const { data: userSelections } = await supabaseAdmin
      .from('selections')
      .select('*')
      .eq('wallet', selection.wallet)
      .eq('week_id', selection.week_id);

    const remainingSelections = 5 - (userSelections?.length || 0);

    return NextResponse.json({
      success: true,
      remainingSelections,
      message: 'Selection removed successfully',
    });
  } catch (error) {
    console.error('Error in DELETE /api/dao/selections/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
