export interface UserProps {
  id: number;
  username: string;
  email: string;
  confirmed: boolean;
  name?: string;
  avatar?: string;
  onboardingCompleted?: boolean;
}

export interface InstanceProps {
  id: string;
  token: string;
  status: string;
  paircode: string;
  qrcode: string;
  name: string;
  profileName: string;
  profilePicUrl: string;
  isBusiness: boolean;
  plataform: string;
  systemName: string;
  owner: string;
  current_presence: string;
  lastDisconnect: string;
  lastDisconnectReason: string;
  adminField01: string;
  adminField02: string;
  openai_apikey: string;
  chatbot_enabled: boolean;
  chatbot_ignoreGroups: boolean;
  chatbot_stopConversation: string;
  chatbot_stopMinutes: number;
  chatbot_stopWhenYouSendMsg: number;
  created: string;
  updated: string;
  currentTime: string;
}

export interface UserContextProps {
  user: UserProps | undefined;
  setUser: Dispatch<SetStateAction<UserProps | undefined>>;
  instances: InstanceProps[];
  setInstances: Dispatch<SetStateAction<InstanceProps[]>>;
  handleUpdate: () => void;
  workflows: ChatbotFlow[];
  setWorkflows: Dispatch<SetStateAction<ChatbotFlow[]>>;
}
