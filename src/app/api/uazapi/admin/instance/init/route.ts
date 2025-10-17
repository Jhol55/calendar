import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/services/prisma';

// Função para gerar ID único de webhook
function generateWebhookId(): string {
  return `wh_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

export async function POST(request: NextRequest) {
  try {
    const requestData = await request.json();
    const { name, admintoken, adminField01 } = requestData;

    if (!name || !admintoken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Gerar webhook único
    const webhookId = generateWebhookId();
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const webhookUrl = `${baseUrl}/api/webhooks/${webhookId}`;

    const response = await fetch(`${process.env.UAZAPI_URL}/instance/init`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        admintoken: admintoken,
      },
      body: JSON.stringify({
        name,
        adminField01,
      }),
    });

    const data = await response.json();

    if (response.ok && data.instance) {
      try {
        await prisma.instances.create({
          data: {
            id: data.instance.id || data.instance.token,
            token: data.instance.token,
            status: data.instance.status || 'disconnected',
            paircode: data.instance.paircode || '',
            qrcode: data.instance.qrcode || '',
            name: name,
            webhook: webhookUrl,
            profileName: data.instance.profileName || '',
            profilePicUrl: data.instance.profilePicUrl || '',
            isBusiness: data.instance.isBusiness || false,
            plataform: data.instance.plataform || '',
            systemName: data.instance.systemName || '',
            owner: data.instance.owner || '',
            current_presence: data.instance.current_presence || '',
            lastDisconnect: data.instance.lastDisconnect || '',
            lastDisconnectReason: data.instance.lastDisconnectReason || '',
            adminField01: adminField01,
            adminField02: data.instance.adminField02 || '',
            openai_apikey: data.instance.openai_apikey || '',
            chatbot_enabled: data.instance.chatbot_enabled || false,
            chatbot_ignoreGroups: data.instance.chatbot_ignoreGroups || false,
            chatbot_stopConversation:
              data.instance.chatbot_stopConversation || '',
            chatbot_stopMinutes: data.instance.chatbot_stopMinutes || 0,
            chatbot_stopWhenYouSendMsg:
              data.instance.chatbot_stopWhenYouSendMsg || 0,
            created: data.instance.created || new Date().toISOString(),
            updated: data.instance.updated || new Date().toISOString(),
            currentTime: data.instance.currentTime || new Date().toISOString(),
          },
        });
      } catch (dbError) {
        console.error('Error creating instance in database:', dbError);
      }
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching instances:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
