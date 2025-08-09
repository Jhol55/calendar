export interface UserProps {
  id: number;
  username: string;
  email: string;
  confirmed: boolean;
}

export interface UserContextProps {
  user: UserProps | undefined;
  setUser: Dispatch<SetStateAction<UserProps | undefined>>;
}
