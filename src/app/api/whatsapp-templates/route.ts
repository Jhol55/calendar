import { NextRequest, NextResponse } from 'next/server';
import { listTemplates } from '@/services/whatsapp-cloud/template.service';

/**
 * GET /api/whatsapp-templates
 * Busca todos os templates (aprovados, pendentes, rejeitados, etc) de uma instância WhatsApp Cloud API
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const instanceToken = searchParams.get('instanceToken');

    if (!instanceToken) {
      return NextResponse.json(
        { error: 'instanceToken is required' },
        { status: 400 },
      );
    }

    const templates = await listTemplates(instanceToken);

    return NextResponse.json({
      success: true,
      data: templates,
      count: templates.length,
    });
  } catch (error) {
    console.error('Error fetching templates:', error);

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
