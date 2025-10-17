'use client';

import React, { createContext, useCallback, useState } from 'react';
import {
  UserProps,
  UserContextProps,
  InstanceProps,
} from './user-context.type';
import { useEffect } from 'react';
import { getUser } from '@/services/user';
import { getInstances } from '@/actions/uazapi/instance';
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
  const [user, setUser] = useState<UserProps | undefined>(undefined);
  const [instances, setInstances] = useState<InstanceProps[]>([]);
  const [workflows, setWorkflows] = useState<ChatbotFlow[]>([]);

  const [trigger, setTrigger] = useState(0);
  const handleUpdate = useCallback(() => setTrigger((prev) => prev + 1), []);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await getUser();
        if (response.success && response.data) {
          setUser(response.data as UserProps);
        }
      } catch (error) {
        console.error('Error fetching user:', error);
      }
    };

    const fetchInstances = async () => {
      try {
        const response = await getInstances();
        if (response.success && response.data) {
          setInstances(response.data as InstanceProps[]);
        }
      } catch (error) {
        console.error('Erro ao carregar instâncias:', error);
      }
    };

    fetchUser();
    fetchInstances();
  }, [trigger]);

  return (
    <UserContext.Provider
      value={{
        user,
        setUser,
        instances,
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
