import { prisma } from '../prisma';

export interface TemplateCategoryUpdate {
  id: string;
  template_id: string;
  template_name: string;
  instance_token: string;
  old_category: string | null;
  new_category: string;
  language: string;
  waba_id: string;
  reviewed: boolean;
  appealed: boolean;
  updated_at: Date;
  created_at: Date;
}

/**
 * Busca recategorizações de templates por template_id ou template_name
 */
export async function getCategoryUpdatesByTemplate(
  templateId: string,
  instanceToken: string,
): Promise<TemplateCategoryUpdate | null> {
  try {
    const update = await prisma.template_category_updates.findFirst({
      where: {
        template_id: templateId,
        instance_token: instanceToken,
      },
      orderBy: {
        updated_at: 'desc',
      },
    });

    return update;
  } catch (error) {
    console.error('❌ Error fetching category update:', error);
    return null;
  }
}

/**
 * Busca recategorizações por nome do template
 */
export async function getCategoryUpdatesByTemplateName(
  templateName: string,
  instanceToken: string,
): Promise<TemplateCategoryUpdate | null> {
  try {
    const update = await prisma.template_category_updates.findFirst({
      where: {
        template_name: templateName,
        instance_token: instanceToken,
      },
      orderBy: {
        updated_at: 'desc',
      },
    });

    return update;
  } catch (error) {
    console.error('❌ Error fetching category update by name:', error);
    return null;
  }
}

/**
 * Busca todas as recategorizações de uma instância
 */
export async function getCategoryUpdatesByInstance(
  instanceToken: string,
): Promise<TemplateCategoryUpdate[]> {
  try {
    const updates = await prisma.template_category_updates.findMany({
      where: {
        instance_token: instanceToken,
      },
      orderBy: {
        updated_at: 'desc',
      },
    });

    return updates;
  } catch (error) {
    console.error('❌ Error fetching category updates:', error);
    return [];
  }
}

/**
 * Marca uma recategorização como revisada
 */
export async function markCategoryUpdateAsReviewed(
  updateId: string,
): Promise<boolean> {
  try {
    await prisma.template_category_updates.update({
      where: { id: updateId },
      data: { reviewed: true },
    });

    return true;
  } catch (error) {
    console.error('❌ Error marking update as reviewed:', error);
    return false;
  }
}

/**
 * Marca uma recategorização como apelada
 */
export async function markCategoryUpdateAsAppealed(
  updateId: string,
): Promise<boolean> {
  try {
    await prisma.template_category_updates.update({
      where: { id: updateId },
      data: { appealed: true },
    });

    return true;
  } catch (error) {
    console.error('❌ Error marking update as appealed:', error);
    return false;
  }
}
