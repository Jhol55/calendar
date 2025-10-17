'use server';

import { getSession } from '@/utils/security/session';

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

    const response = await fetch(
      `http://localhost:3000/api/uazapi/admin/instance/all`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          admintoken: `${process.env.UAZAPI_ADMIN_TOKEN}`,
        }),
      },
    );

    const data = await response.json();

    // Verificar se data é um array antes de usar filter
    const filteredData = Array.isArray(data)
      ? data.filter(
          (item: { adminField01: string }) => item.adminField01 === email,
        )
      : [];

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
      message: response.ok
        ? 'Instância conectada com sucesso'
        : response.statusText,
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
