import { NextRequest, NextResponse } from 'next/server';
import { markCategoryUpdateAsReviewed } from '@/services/whatsapp-cloud/template-category-updates.service';

/**
 * POST /api/whatsapp-templates/category-update/[updateId]/review
 * Marca uma recategorização como revisada
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { updateId: string } },
) {
  try {
    const { updateId } = params;

    if (!updateId) {
      return NextResponse.json(
        { success: false, error: 'updateId is required' },
        { status: 400 },
      );
    }

    const success = await markCategoryUpdateAsReviewed(updateId);

    if (success) {
      return NextResponse.json({
        success: true,
        message: 'Recategorização marcada como revisada',
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to mark as reviewed',
        },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error('Error marking category update as reviewed:', error);

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 },
    );
  }
}
