import type { Conversation, Message } from '@pro-date/contracts';

export interface OutgoingMessage {
  conversationId: string;
  clientId: string;
  body: string;
  createdAt: string;
  failure: string | null;
}
export interface CachedThread {
  conversation: Conversation | null;
  messages: Message[];
  outgoing: OutgoingMessage[];
}
export interface ChatStorage {
  read(this: void, id: string): Promise<CachedThread>;
  saveConversation(conversation: Conversation): Promise<void>;
  saveConversations(conversations: Conversation[]): Promise<void>;
  cachedConversations(): Promise<Conversation[]>;
  saveMessages(id: string, messages: Message[]): Promise<void>;
  enqueue(message: OutgoingMessage): Promise<void>;
  setFailure(clientId: string, failure: string | null): Promise<void>;
  remove(clientId: string): Promise<void>;
  clear(this: void, id: string): Promise<void>;
  pendingIds(): Promise<string[]>;
  close(purge: boolean): Promise<void>;
}
