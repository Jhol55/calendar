export interface UserProps {
  id: number;
  username: string;
  email: string;
  confirmed: boolean;
  name?: string;
  avatar?: string;
}

export interface UserContextProps {
  user: UserProps | undefined;
  setUser: Dispatch<SetStateAction<UserProps | undefined>>;
}
