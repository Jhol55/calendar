/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Serviço para envio de mensagens via WhatsApp Cloud API (Meta)
 * Documentação: https://developers.facebook.com/docs/whatsapp/cloud-api
 */

import { prisma } from '../prisma';

interface WhatsAppCloudInstance {
  phoneNumberId: string;
  accessToken: string;
}

/**
 * Busca informações da instância WhatsApp Cloud API
 */
async function getCloudInstance(token: string): Promise<WhatsAppCloudInstance> {
  const instance = await prisma.instances.findUnique({
    where: { token },
    select: {
      plataform: true,
      whatsapp_official_enabled: true,
      whatsapp_official_phone_number_id: true,
      whatsapp_official_access_token: true,
    },
  });

  if (!instance) {
    throw new Error('Instance not found');
  }

  if (instance.plataform !== 'cloud' || !instance.whatsapp_official_enabled) {
    throw new Error('Instance is not a WhatsApp Cloud API instance');
  }

  if (
    !instance.whatsapp_official_phone_number_id ||
    !instance.whatsapp_official_access_token
  ) {
    throw new Error('WhatsApp Cloud API credentials not configured');
  }

  return {
    phoneNumberId: instance.whatsapp_official_phone_number_id,
    accessToken: instance.whatsapp_official_access_token,
  };
}

/**
 * Envia uma mensagem de texto via WhatsApp Cloud API
 * Documentação: https://developers.facebook.com/docs/whatsapp/cloud-api/messages/text-messages
 */
export async function sendTextMessage(
  token: string,
  to: string,
  text: string,
  options?: {
    previewUrl?: boolean;
  },
): Promise<any> {
  const { phoneNumberId, accessToken } = await getCloudInstance(token);

  // Formatar número de telefone (remover caracteres não numéricos)
  const formattedTo = to.replace(/\D/g, '');

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: formattedTo,
    type: 'text',
    text: {
      preview_url: options?.previewUrl || false,
      body: text,
    },
  };

  console.log('📤 Sending text message via WhatsApp Cloud API:', {
    phoneNumberId,
    to: formattedTo,
    textLength: text.length,
  });

  const response = await fetch(
    `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    let errorData;
    try {
      errorData = JSON.parse(errorText);
    } catch {
      errorData = { error: errorText };
    }
    console.error('❌ WhatsApp Cloud API error:', errorData);
    throw new Error(
      `WhatsApp Cloud API error: ${errorData.error?.message || response.statusText}`,
    );
  }

  const result = await response.json();
  console.log('✅ Message sent successfully via WhatsApp Cloud API:', result);
  return result;
}

/**
 * Envia uma mensagem de mídia via WhatsApp Cloud API
 * Documentação: https://developers.facebook.com/docs/whatsapp/cloud-api/messages/image-messages
 */
export async function sendMediaMessage(
  token: string,
  to: string,
  mediaUrl: string,
  mediaType: 'image' | 'video' | 'document' | 'audio',
  options?: {
    caption?: string;
    filename?: string;
  },
): Promise<any> {
  const { phoneNumberId, accessToken } = await getCloudInstance(token);

  // Formatar número de telefone (remover caracteres não numéricos)
  const formattedTo = to.replace(/\D/g, '');

  // Mapear tipos de mídia
  const mediaTypeMap: Record<string, string> = {
    image: 'image',
    video: 'video',
    document: 'document',
    audio: 'audio',
  };

  const type = mediaTypeMap[mediaType] || 'document';

  const payload: any = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: formattedTo,
    type: type,
    [type]: {
      link: mediaUrl,
    },
  };

  // Adicionar caption (apenas para image, video e document)
  if (options?.caption && ['image', 'video', 'document'].includes(type)) {
    payload[type].caption = options.caption;
  }

  // Adicionar filename (apenas para document)
  if (options?.filename && type === 'document') {
    payload[type].filename = options.filename;
  }

  console.log('📤 Sending media message via WhatsApp Cloud API:', {
    phoneNumberId,
    to: formattedTo,
    mediaType: type,
    hasCaption: !!options?.caption,
  });

  const response = await fetch(
    `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    let errorData;
    try {
      errorData = JSON.parse(errorText);
    } catch {
      errorData = { error: errorText };
    }
    console.error('❌ WhatsApp Cloud API error:', errorData);
    throw new Error(
      `WhatsApp Cloud API error: ${errorData.error?.message || response.statusText}`,
    );
  }

  const result = await response.json();
  console.log(
    '✅ Media message sent successfully via WhatsApp Cloud API:',
    result,
  );
  return result;
}

/**
 * Envia uma mensagem de localização via WhatsApp Cloud API
 * Documentação: https://developers.facebook.com/docs/whatsapp/cloud-api/messages/location-messages
 */
export async function sendLocationMessage(
  token: string,
  to: string,
  latitude: number,
  longitude: number,
  options?: {
    name?: string;
    address?: string;
  },
): Promise<any> {
  const { phoneNumberId, accessToken } = await getCloudInstance(token);

  // Formatar número de telefone (remover caracteres não numéricos)
  const formattedTo = to.replace(/\D/g, '');

  const payload: any = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: formattedTo,
    type: 'location',
    location: {
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      name: options?.name || '',
      address: options?.address || '',
    },
  };

  console.log('📤 Sending location message via WhatsApp Cloud API:', {
    phoneNumberId,
    to: formattedTo,
    latitude,
    longitude,
  });

  const response = await fetch(
    `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    let errorData;
    try {
      errorData = JSON.parse(errorText);
    } catch {
      errorData = { error: errorText };
    }
    console.error('❌ WhatsApp Cloud API error:', errorData);
    throw new Error(
      `WhatsApp Cloud API error: ${errorData.error?.message || response.statusText}`,
    );
  }

  const result = await response.json();
  console.log(
    '✅ Location message sent successfully via WhatsApp Cloud API:',
    result,
  );
  return result;
}

/**
 * Envia uma mensagem de contato via WhatsApp Cloud API
 * Documentação: https://developers.facebook.com/docs/whatsapp/cloud-api/messages/contact-messages
 */
export async function sendContactMessage(
  token: string,
  to: string,
  contacts: Array<{
    name: {
      formatted_name: string;
      first_name?: string;
      last_name?: string;
    };
    phones?: Array<{
      phone: string;
      type?: string;
      wa_id?: string;
    }>;
    emails?: Array<{
      email: string;
      type?: string;
    }>;
    org?: {
      company?: string;
    };
    urls?: Array<{
      url: string;
      type?: string;
    }>;
  }>,
): Promise<any> {
  const { phoneNumberId, accessToken } = await getCloudInstance(token);

  // Formatar número de telefone (remover caracteres não numéricos)
  const formattedTo = to.replace(/\D/g, '');

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: formattedTo,
    type: 'contacts',
    contacts: contacts,
  };

  console.log('📤 Sending contact message via WhatsApp Cloud API:', {
    phoneNumberId,
    to: formattedTo,
    contactsCount: contacts.length,
  });

  const response = await fetch(
    `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    let errorData;
    try {
      errorData = JSON.parse(errorText);
    } catch {
      errorData = { error: errorText };
    }
    console.error('❌ WhatsApp Cloud API error:', errorData);
    throw new Error(
      `WhatsApp Cloud API error: ${errorData.error?.message || response.statusText}`,
    );
  }

  const result = await response.json();
  console.log(
    '✅ Contact message sent successfully via WhatsApp Cloud API:',
    result,
  );
  return result;
}

/**
 * Envia uma mensagem interativa com botões via WhatsApp Cloud API
 * Documentação: https://developers.facebook.com/docs/whatsapp/cloud-api/messages/interactive-messages
 */
export async function sendInteractiveButtonMessage(
  token: string,
  to: string,
  text: string,
  buttons: Array<{
    id: string;
    title: string;
  }>,
  options?: {
    footer?: string;
    header?: string;
  },
): Promise<any> {
  const { phoneNumberId, accessToken } = await getCloudInstance(token);

  // Formatar número de telefone (remover caracteres não numéricos)
  const formattedTo = to.replace(/\D/g, '');

  // WhatsApp Cloud API suporta até 3 botões
  if (buttons.length > 3) {
    console.warn('⚠️ WhatsApp Cloud API supports max 3 buttons, truncating...');
    buttons = buttons.slice(0, 3);
  }

  const payload: any = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: formattedTo,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: {
        text: text,
      },
      action: {
        buttons: buttons.map((btn) => ({
          type: 'reply',
          reply: {
            id: btn.id,
            title: btn.title.substring(0, 20), // Max 20 chars
          },
        })),
      },
    },
  };

  if (options?.header) {
    payload.interactive.header = {
      type: 'text',
      text: options.header,
    };
  }

  if (options?.footer) {
    payload.interactive.footer = {
      text: options.footer,
    };
  }

  console.log('📤 Sending interactive button message via WhatsApp Cloud API:', {
    phoneNumberId,
    to: formattedTo,
    buttonsCount: buttons.length,
  });

  const response = await fetch(
    `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    let errorData;
    try {
      errorData = JSON.parse(errorText);
    } catch {
      errorData = { error: errorText };
    }
    console.error('❌ WhatsApp Cloud API error:', errorData);
    throw new Error(
      `WhatsApp Cloud API error: ${errorData.error?.message || response.statusText}`,
    );
  }

  const result = await response.json();
  console.log(
    '✅ Interactive button message sent successfully via WhatsApp Cloud API:',
    result,
  );
  return result;
}

/**
 * Envia uma mensagem interativa com lista via WhatsApp Cloud API
 * Documentação: https://developers.facebook.com/docs/whatsapp/cloud-api/messages/interactive-messages
 */
export async function sendInteractiveListMessage(
  token: string,
  to: string,
  text: string,
  buttonText: string,
  sections: Array<{
    title?: string;
    rows: Array<{
      id: string;
      title: string;
      description?: string;
    }>;
  }>,
  options?: {
    footer?: string;
    header?: string;
  },
): Promise<any> {
  const { phoneNumberId, accessToken } = await getCloudInstance(token);

  // Formatar número de telefone (remover caracteres não numéricos)
  const formattedTo = to.replace(/\D/g, '');

  const payload: any = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: formattedTo,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: {
        text: text,
      },
      action: {
        button: buttonText.substring(0, 20), // Max 20 chars
        sections: sections.map((section) => ({
          title: section.title?.substring(0, 24), // Max 24 chars
          rows: section.rows.map((row) => ({
            id: row.id.substring(0, 200), // Max 200 chars
            title: row.title.substring(0, 24), // Max 24 chars
            description: row.description?.substring(0, 72), // Max 72 chars
          })),
        })),
      },
    },
  };

  if (options?.header) {
    payload.interactive.header = {
      type: 'text',
      text: options.header,
    };
  }

  if (options?.footer) {
    payload.interactive.footer = {
      text: options.footer,
    };
  }

  console.log('📤 Sending interactive list message via WhatsApp Cloud API:', {
    phoneNumberId,
    to: formattedTo,
    sectionsCount: sections.length,
  });

  const response = await fetch(
    `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    let errorData;
    try {
      errorData = JSON.parse(errorText);
    } catch {
      errorData = { error: errorText };
    }
    console.error('❌ WhatsApp Cloud API error:', errorData);
    throw new Error(
      `WhatsApp Cloud API error: ${errorData.error?.message || response.statusText}`,
    );
  }

  const result = await response.json();
  console.log(
    '✅ Interactive list message sent successfully via WhatsApp Cloud API:',
    result,
  );
  return result;
}

/**
 * Envia uma mensagem via template do WhatsApp Cloud API
 * Documentação: https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-message-templates
 */
export async function sendTemplateMessage(
  token: string,
  to: string,
  templateName: string,
  languageCode: string,
  components?: Array<{
    type: 'header' | 'body' | 'button';
    parameters: Array<{
      type: 'text' | 'currency' | 'date_time' | 'image' | 'document' | 'video';
      text?: string;
      currency?: { fallback_value: string; code: string; amount_1000: number };
      date_time?: { fallback_value: string };
      image?: { link: string };
      document?: { link: string; filename?: string };
      video?: { link: string };
    }>;
    sub_type?: 'quick_reply' | 'url';
    index?: number;
  }>,
): Promise<any> {
  const { phoneNumberId, accessToken } = await getCloudInstance(token);

  // Formatar número de telefone (remover caracteres não numéricos)
  const formattedTo = to.replace(/\D/g, '');

  const payload: any = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: formattedTo,
    type: 'template',
    template: {
      name: templateName,
      language: {
        code: languageCode,
      },
    },
  };

  // Adicionar componentes se fornecidos
  if (components && components.length > 0) {
    payload.template.components = components;
  }

  console.log('📤 Sending template message via WhatsApp Cloud API:', {
    phoneNumberId,
    to: formattedTo,
    templateName,
    languageCode,
    componentsCount: components?.length || 0,
  });

  console.log('📋 PAYLOAD COMPLETO:', JSON.stringify(payload, null, 2));

  const response = await fetch(
    `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    let errorData;
    try {
      errorData = JSON.parse(errorText);
    } catch {
      errorData = { error: errorText };
    }
    console.error('❌ WhatsApp Cloud API error:', errorData);
    throw new Error(
      `WhatsApp Cloud API error: ${errorData.error?.message || response.statusText}`,
    );
  }

  const result = await response.json();

  // Alguns erros da Cloud API vêm com HTTP 200 mas campo "error" no corpo.
  // Exemplo: code 131049 - "This message was not delivered to maintain healthy ecosystem engagement."
  const hasLogicalError =
    result?.error === true ||
    (Array.isArray(result?.errors) && result.errors.length > 0);

  if (hasLogicalError) {
    console.error('❌ WhatsApp Cloud template logical error:', result);

    // Tentar extrair mensagem mais amigável
    const firstError = Array.isArray(result?.errors)
      ? result.errors[0]
      : undefined;

    const errorMessage =
      firstError?.message ||
      firstError?.title ||
      result?.error_data?.message ||
      'Unknown WhatsApp template error';

    throw new Error(
      `WhatsApp Cloud API error (template): ${errorMessage}${
        firstError?.code ? ` (code ${firstError.code})` : ''
      }`,
    );
  }

  console.log(
    '✅ Template message sent successfully via WhatsApp Cloud API:',
    result,
  );
  return result;
}
