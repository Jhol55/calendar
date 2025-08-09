'use client';

import React, { createContext, useState } from 'react';
import { UserProps, UserContextProps } from './user-context.type';

export const UserContext = createContext<UserContextProps>({
  user: undefined,
  setUser: () => {},
});

interface UserProviderProps {
  children: React.ReactNode | React.ReactNode[];
}

export const UserProvider = ({ children }: UserProviderProps) => {
  const [user, setUser] = useState<UserProps | undefined>(undefined);

  return (
    <UserContext.Provider value={{ user, setUser }}>
      {children}
    </UserContext.Provider>
  );
};
