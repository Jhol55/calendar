/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Serviço para gerenciamento de templates do WhatsApp Cloud API
 * Documentação: https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates
 */

import { prisma } from '../prisma';
import { getCategoryUpdatesByTemplateName } from './template-category-updates.service';

interface TemplateComponent {
  type: string;
  format?: string;
  text?: string;
  example?: {
    body_text?: string[][];
    header_text?: string[];
  };
  buttons?: Array<{
    type: string;
    text: string;
    url?: string;
    phone_number?: string;
  }>;
}

interface WhatsAppTemplate {
  id: string;
  name: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'DISABLED' | 'PAUSED';
  category: 'AUTHENTICATION' | 'MARKETING' | 'UTILITY';
  language: string;
  components: TemplateComponent[];
  quality_score?: string; // Qualidade do template (GREEN, YELLOW, RED, UNKNOWN)
  rejection_reason?: string; // Motivo da rejeição (se rejeitado)
  categoryUpdate?: {
    id: string;
    oldCategory: string | null;
    newCategory: string;
    updatedAt: Date;
    reviewed: boolean;
    appealed: boolean;
  };
}

interface TemplateListResponse {
  data: WhatsAppTemplate[];
  paging?: {
    cursors?: {
      before?: string;
      after?: string;
    };
  };
}

type WhatsAppTemplateWithUpdate = WhatsAppTemplate & {
  categoryUpdate?: {
    id: string;
    oldCategory: string | null;
    newCategory: string;
    updatedAt: Date;
    reviewed: boolean;
    appealed: boolean;
  };
};

/**
 * Busca os templates de uma instância WhatsApp Cloud API
 */
export async function listTemplates(
  instanceToken: string,
): Promise<WhatsAppTemplate[]> {
  try {
    // Buscar informações da instância
    const instance = await prisma.instances.findUnique({
      where: { token: instanceToken },
      select: {
        plataform: true,
        whatsapp_official_enabled: true,
        whatsapp_official_business_account_id: true,
        whatsapp_official_access_token: true,
        whatsapp_official_phone_number: true,
      },
    });

    if (!instance) {
      throw new Error('Instance not found');
    }

    if (instance.plataform !== 'cloud' || !instance.whatsapp_official_enabled) {
      throw new Error('Instance is not a WhatsApp Cloud API instance');
    }

    if (
      !instance.whatsapp_official_business_account_id ||
      !instance.whatsapp_official_access_token
    ) {
      throw new Error('WhatsApp Cloud API credentials not configured');
    }

    const wabaId = instance.whatsapp_official_business_account_id;
    const accessToken = instance.whatsapp_official_access_token;
    const phoneDisplayName = instance.whatsapp_official_phone_number || '';
    const phoneDisplayNameLower = phoneDisplayName.toLowerCase();
    const isTestAccount =
      phoneDisplayNameLower === 'test number' ||
      phoneDisplayNameLower.includes('public test number');

    console.log('📋 Fetching templates for WABA:', wabaId);
    console.log('🧪 Instância de teste?', isTestAccount ? 'Sim' : 'Não');
    console.log(
      '📞 Nome exibido do número:',
      phoneDisplayName || '(não definido)',
    );

    // Coleção base que será enriquecida com recategorizações
    let fetchedTemplates: WhatsAppTemplate[] = [];

    try {
      // Buscar templates via API com campos adicionais
      // Campos disponíveis: id, name, status, category, language, components, quality_score, rejection_reason
      const response = await fetch(
        `https://graph.facebook.com/v21.0/${wabaId}/message_templates?fields=id,name,status,category,language,components,quality_score,rejection_reason&limit=100`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Error fetching templates:', errorText);

        if (!isTestAccount) {
          throw new Error(`Failed to fetch templates: ${errorText}`);
        }

        console.warn(
          '⚠️ Falha ao buscar templates, mas a instância é de teste. Usando fallback.',
        );
      } else {
        const data: TemplateListResponse = await response.json();
        console.log(`✅ Found ${data.data.length} templates`);
        fetchedTemplates = [...data.data];
      }
    } catch (error) {
      if (!isTestAccount) {
        throw error;
      }

      console.warn(
        '⚠️ Erro ao buscar templates em conta de teste. Continuando com fallback.',
        error,
      );
    }

    // Buscar recategorizações para cada template obtido
    let templatesWithUpdates: WhatsAppTemplateWithUpdate[] = await Promise.all(
      fetchedTemplates.map(async (template) => {
        const categoryUpdate = await getCategoryUpdatesByTemplateName(
          template.name,
          instanceToken,
        );

        return {
          ...template,
          categoryUpdate: categoryUpdate
            ? {
                id: categoryUpdate.id,
                oldCategory: categoryUpdate.old_category,
                newCategory: categoryUpdate.new_category,
                updatedAt: categoryUpdate.updated_at,
                reviewed: categoryUpdate.reviewed,
                appealed: categoryUpdate.appealed,
              }
            : undefined,
        };
      }),
    );

    if (isTestAccount) {
      const alreadyHasHelloWorld = templatesWithUpdates.some(
        (template) => template.name === 'hello_world',
      );

      if (!alreadyHasHelloWorld) {
        console.log(
          'ℹ️ Adicionando template hello_world padrão para conta de teste.',
        );
        templatesWithUpdates = [
          {
            id: 'hello_world_default',
            name: 'hello_world',
            status: 'APPROVED',
            category: 'UTILITY',
            language: 'en_US',
            components: [
              {
                type: 'HEADER',
                format: 'TEXT',
                text: 'Hello World',
              },
              {
                type: 'BODY',
                text: 'Welcome and congratulations!! This message demonstrates your ability to send a WhatsApp message notification from the Cloud API, hosted by Meta. Thank you for taking the time to test with us.',
              },
            ],
            quality_score: 'GREEN',
            categoryUpdate: undefined,
            rejection_reason: undefined,
          },
          ...templatesWithUpdates,
        ];
      }
    }

    // Contar por status para log
    const statusCounts = templatesWithUpdates.reduce(
      (acc, template) => {
        acc[template.status] = (acc[template.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    console.log(`✅ Templates por status:`, statusCounts);

    return templatesWithUpdates;
  } catch (error) {
    console.error('❌ Error in listTemplates:', error);
    throw error;
  }
}

/**
 * Busca detalhes de um template específico
 */
export async function getTemplate(
  instanceToken: string,
  templateName: string,
): Promise<WhatsAppTemplate | null> {
  const templates = await listTemplates(instanceToken);
  return templates.find((t) => t.name === templateName) || null;
}

/**
 * Extrai informações sobre as variáveis de um template
 */
export function extractTemplateVariables(template: WhatsAppTemplate): Array<{
  component: string;
  index: number;
  example?: string;
}> {
  const variables: Array<{
    component: string;
    index: number;
    example?: string;
  }> = [];

  template.components.forEach((component) => {
    if (component.type === 'HEADER' && component.format === 'TEXT') {
      // Header com variáveis
      const headerText = component.text || '';
      const headerVarCount = (headerText.match(/\{\{(\d+)\}\}/g) || []).length;
      for (let i = 1; i <= headerVarCount; i++) {
        variables.push({
          component: 'header',
          index: i,
          example: component.example?.header_text?.[i - 1],
        });
      }
    }

    if (component.type === 'BODY') {
      // Body com variáveis
      const bodyText = component.text || '';
      const bodyVarCount = (bodyText.match(/\{\{(\d+)\}\}/g) || []).length;
      for (let i = 1; i <= bodyVarCount; i++) {
        variables.push({
          component: 'body',
          index: i,
          example: component.example?.body_text?.[0]?.[i - 1],
        });
      }
    }
  });

  return variables;
}

/**
 * Gera preview do template com as variáveis substituídas
 */
export function generateTemplatePreview(
  template: WhatsAppTemplate,
  variables: Record<string, string>,
): string {
  let preview = '';

  template.components.forEach((component) => {
    if (component.type === 'HEADER' && component.text) {
      let headerText = component.text;
      Object.entries(variables).forEach(([key, value]) => {
        if (key.startsWith('header_')) {
          const index = key.replace('header_', '');
          headerText = headerText.replace(`{{${index}}}`, value);
        }
      });
      preview += `${headerText}\n\n`;
    }

    if (component.type === 'BODY' && component.text) {
      let bodyText = component.text;
      Object.entries(variables).forEach(([key, value]) => {
        if (key.startsWith('body_')) {
          const index = key.replace('body_', '');
          bodyText = bodyText.replace(`{{${index}}}`, value);
        }
      });
      preview += `${bodyText}\n\n`;
    }

    if (component.type === 'FOOTER' && component.text) {
      preview += `${component.text}\n`;
    }

    if (component.type === 'BUTTONS' && component.buttons) {
      preview += '\n🔘 Botões:\n';
      component.buttons.forEach((button) => {
        preview += `   • ${button.text}\n`;
      });
    }
  });

  return preview.trim();
}
