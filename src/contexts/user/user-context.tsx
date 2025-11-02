'use client';

import React, { createContext, useCallback, useState } from 'react';
import type {
  UserProps,
  UserContextProps,
  InstanceProps,
} from './user-context.type';
import { useEffect } from 'react';
import {
  useUser as useUserQuery,
  useInstances as useInstancesQuery,
  useInvalidateUser,
} from '@/lib/react-query/hooks/use-user';
import { ChatbotFlow } from '@/actions/chatbot-flows/flows';

export const UserContext = createContext<UserContextProps>({
  user: undefined,
  setUser: () => {},
  instances: [],
  setInstances: () => {},
  handleUpdate: () => {},
  workflows: [],
  setWorkflows: () => {},
});

interface UserProviderProps {
  children: React.ReactNode | React.ReactNode[];
}

export const UserProvider = ({ children }: UserProviderProps) => {
  // Usar React Query para buscar dados
  // safeQueryFn já extrai o .data automaticamente, então recebemos diretamente os dados
  const { data: user, error: userError } = useUserQuery();

  // Instâncias são buscadas sob demanda, não automaticamente
  // Isso evita queries desnecessárias quando o usuário não está na página de instâncias
  const {
    data: instances = [], // Array de instâncias, com default []
    error: instancesError,
  } = useInstancesQuery({
    enabled: false, // Desabilitado por padrão, será habilitado apenas quando necessário
  });

  const { invalidateProfile, invalidateInstances } = useInvalidateUser();

  // Estados locais para compatibilidade
  const [workflows, setWorkflows] = useState<ChatbotFlow[]>([]);

  /**
   * Função para forçar atualização de dados do usuário
   * Agora usa invalidate do React Query
   */
  const handleUpdate = useCallback(() => {
    invalidateProfile();
    invalidateInstances();
  }, [invalidateProfile, invalidateInstances]);

  /**
   * Setter para user (mantido para compatibilidade)
   * Não é mais necessário com React Query, mas mantido para não quebrar código existente
   */
  const setUser = useCallback(() => {
    // Com React Query, atualizações vêm automaticamente das queries
    // Esta função é mantida apenas para compatibilidade com código legado
    invalidateProfile();
  }, [invalidateProfile]);

  /**
   * Setter para instances (mantido para compatibilidade)
   */
  const setInstances = useCallback(() => {
    // Com React Query, atualizações vêm automaticamente das queries
    invalidateInstances();
  }, [invalidateInstances]);

  // Log de erros (apenas em desenvolvimento)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      if (userError) {
        console.error('❌ Error fetching user:', userError);
      }
      if (instancesError) {
        console.error('❌ Error fetching instances:', instancesError);
      }
    }
  }, [userError, instancesError]);

  return (
    <UserContext.Provider
      value={{
        user: user as UserProps | undefined,
        setUser,
        instances: instances as InstanceProps[],
        setInstances,
        handleUpdate,
        workflows,
        setWorkflows,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};
