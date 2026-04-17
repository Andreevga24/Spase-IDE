export type ChatRole = "system" | "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type StreamChatArgs = {
  messages: ChatMessage[];
  signal?: AbortSignal;
  onToken: (token: string) => void;
};

export type StreamChatFn = (args: StreamChatArgs) => Promise<void>;

