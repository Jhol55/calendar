'use server';

import { getSession } from '@/utils/security/session';
import { prisma } from '@/services/prisma';

interface SessionUser {
  user: {
    email: string;
  };
  expires: Date;
  remember: boolean;
}

type UazapiResponse = {
  success: boolean;
  message?: string;
  code?: number;
  field?: string;
  data?: unknown;
};

/**
 * Buscar instâncias do usuário
 * Acesso direto ao Prisma (sem HTTP overhead)
 * Fallback para UAZAPI se não encontrar no banco
 */
export async function getInstances(): Promise<UazapiResponse> {
  try {
    const session = (await getSession()) as SessionUser | null;
    const email = session?.user?.email;

    if (!email) {
      return {
        success: false,
        message: 'Unauthorized',
        code: 401,
      };
    }

    // Buscar do PostgreSQL diretamente
    try {
      const instances = await prisma.instances.findMany({
        where: {
          adminField01: email,
        },
      });

      if (instances && instances.length > 0) {
        console.log(
          `✅ Found ${instances.length} instances in PostgreSQL for ${email}`,
        );
        return {
          success: true,
          message: 'Instâncias carregadas com sucesso',
          code: 200,
          data: instances,
        };
      }

      console.log(
        '⚠️ No instances found in PostgreSQL, trying UAZAPI fallback',
      );
    } catch (dbError) {
      console.error(
        '❌ Error fetching from PostgreSQL, falling back to UAZAPI:',
        dbError,
      );
    }

    // Fallback: buscar da UAZAPI
    const response = await fetch(`${process.env.UAZAPI_URL}/instance/all`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        admintoken: `${process.env.UAZAPI_ADMIN_TOKEN}`,
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        Pragma: 'no-cache',
        Expires: '0',
      },
      cache: 'no-store',
    });

    const data = await response.json();

    // Garantir que data é um array
    const instancesArray = Array.isArray(data) ? data : [];

    const filteredData = instancesArray.filter(
      (item: { adminField01: string }) => item.adminField01 === email,
    );

    return {
      success: response.ok,
      message: response.ok
        ? 'Instâncias carregadas com sucesso'
        : response.statusText,
      code: response.status,
      data: filteredData,
    };
  } catch (error) {
    console.error('Erro ao buscar instâncias:', error);
    return {
      success: false,
      message: 'Erro ao buscar instâncias',
      code: 500,
    };
  }
}

/**
 * Conectar instância WhatsApp
 * Proxy necessário para API UAZAPI externa
 */
export async function connectInstance(token: string): Promise<UazapiResponse> {
  try {
    const session = (await getSession()) as SessionUser | null;
    const email = session?.user?.email;

    if (!email) {
      return {
        success: false,
        message: 'Unauthorized',
        code: 401,
      };
    }

    const response = await fetch(
      `http://localhost:3000/api/uazapi/user/instance/connect`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          token,
        }),
      },
    );

    const data = await response.json();

    return {
      success: response.ok,
      message: response.ok
        ? 'Instância conectada com sucesso'
        : response.statusText,
      code: response.status,
      data: data,
    };
  } catch (error) {
    console.error('Erro ao conectar instância:', error);
    return {
      success: false,
      message: 'Erro ao conectar instância',
      code: 500,
    };
  }
}

/**
 * Buscar status da instância WhatsApp
 * Proxy necessário para API UAZAPI externa
 */
export async function getInstanceStatus(
  token: string,
): Promise<UazapiResponse> {
  try {
    const session = (await getSession()) as SessionUser | null;
    const email = session?.user?.email;

    if (!email || !token) {
      return {
        success: false,
        message: 'Unauthorized',
        code: 401,
      };
    }

    const response = await fetch(
      `http://localhost:3000/api/uazapi/user/instance/status`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          token,
        }),
      },
    );

    const data = await response.json();

    return {
      success: response.ok,
      message: response.ok ? 'Status obtido com sucesso' : response.statusText,
      code: response.status,
      data: data,
    };
  } catch (error) {
    console.error('Erro ao buscar status da instância:', error);
    return {
      success: false,
      message: 'Erro ao buscar status da instância',
      code: 500,
    };
  }
}

/**
 * Deletar instância WhatsApp
 * Proxy necessário para API UAZAPI externa
 */
export async function deleteInstance(token: string): Promise<UazapiResponse> {
  try {
    const session = (await getSession()) as SessionUser | null;
    const email = session?.user?.email;

    if (!email) {
      return {
        success: false,
        message: 'Unauthorized',
        code: 401,
      };
    }

    const response = await fetch(
      `http://localhost:3000/api/uazapi/user/instance`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          token,
        }),
      },
    );

    const data = await response.json();

    return {
      success: response.ok,
      message: response.ok
        ? 'Instância deletada com sucesso'
        : response.statusText,
      code: response.status,
      data: data,
    };
  } catch (error) {
    console.error('Erro ao deletar instância:', error);
    return {
      success: false,
      message: 'Erro ao deletar instância',
      code: 500,
    };
  }
}

/**
 * Criar nova instância WhatsApp
 * Proxy necessário para API UAZAPI externa
 */
export async function createInstance(name: string): Promise<UazapiResponse> {
  try {
    const session = (await getSession()) as SessionUser | null;
    const email = session?.user?.email;

    if (!email) {
      return {
        success: false,
        message: 'Unauthorized',
        code: 401,
      };
    }

    const response = await fetch(
      `http://localhost:3000/api/uazapi/admin/instance/init`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          adminField01: email,
          admintoken: `${process.env.UAZAPI_ADMIN_TOKEN}`,
        }),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        message: data.message || 'Erro ao criar instância',
        code: response.status,
      };
    }

    return {
      success: response.ok,
      message: response.ok
        ? 'Instância criada com sucesso'
        : response.statusText,
      code: response.status,
      data: data,
    };
  } catch (error) {
    console.error('Erro ao criar instância:', error);
    return {
      success: false,
      message: 'Erro ao criar instância',
      code: 500,
    };
  }
}

/**
 * Buscar webhook da instância
 * Acesso direto ao Prisma (sem HTTP overhead)
 */
export async function getInstanceWebhook(
  token: string,
): Promise<UazapiResponse> {
  try {
    if (!token) {
      return {
        success: false,
        message: 'Token é obrigatório',
        code: 400,
      };
    }

    // Buscar instância no banco PostgreSQL
    const instance = await prisma.instances.findFirst({
      where: { token },
      select: { webhook: true, name: true, profileName: true },
    });

    if (!instance) {
      return {
        success: false,
        message: 'Instância não encontrada',
        code: 404,
      };
    }

    console.log('🔍 Instance webhook found:', {
      name: instance.name,
      profileName: instance.profileName,
      webhook: instance.webhook,
    });

    return {
      success: true,
      message: 'Webhook da instância obtido com sucesso',
      code: 200,
      data: {
        token,
        webhook: instance.webhook,
        name: instance.name,
        profileName: instance.profileName,
      },
    };
  } catch (error) {
    console.error('Erro ao buscar webhook da instância:', error);
    return {
      success: false,
      message: 'Erro ao buscar webhook da instância',
      code: 500,
    };
  }
}
