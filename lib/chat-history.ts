import { openDB } from "idb";
import type { DBSchema, IDBPDatabase } from "idb";
import type { ChatConversation, ChatFolder } from "@/lib/models";

interface ChatHistoryDatabase extends DBSchema {
  folders: {
    key: string;
    value: ChatFolder;
  };
  conversations: {
    key: string;
    value: ChatConversation;
    indexes: { "by-updated-at": string };
  };
}

let databasePromise: Promise<IDBPDatabase<ChatHistoryDatabase>> | undefined;

function getDatabase() {
  if (!databasePromise) {
    databasePromise = openDB<ChatHistoryDatabase>("luma-chat-history", 1, {
      upgrade(database) {
        database.createObjectStore("folders", { keyPath: "id" });
        const conversations = database.createObjectStore("conversations", { keyPath: "id" });
        conversations.createIndex("by-updated-at", "updatedAt");
      }
    });
  }
  return databasePromise;
}

export async function readChatFolders(): Promise<ChatFolder[]> {
  const database = await getDatabase();
  return database.getAll("folders");
}

export async function writeChatFolder(folder: ChatFolder): Promise<void> {
  const database = await getDatabase();
  await database.put("folders", folder);
}

export async function readChatConversations(): Promise<ChatConversation[]> {
  const database = await getDatabase();
  return database.getAllFromIndex("conversations", "by-updated-at").then((items) => items.reverse());
}

export async function writeChatConversation(conversation: ChatConversation): Promise<void> {
  const database = await getDatabase();
  await database.put("conversations", conversation);
}
