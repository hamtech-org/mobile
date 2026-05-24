import { io, type Socket } from "socket.io-client";

import { env } from "@/config/env";
import { ngrokSkipBrowserWarningHeaders } from "@/utils/ngrok";

let socketClient: Socket | null = null;

/** JWT cho handshake Socket.IO */
export function normalizeSocketAuthToken(raw: string | null | undefined): string | null {
  if (raw == null || typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t) return null;
  return t.startsWith("Bearer ") ? t.slice("Bearer ".length).trim() : t;
}

export const getSocketClient = (): Socket => {
  if (!socketClient) {
    socketClient = io(env.socketUrl, {
      autoConnect: false,
      transports: ["websocket"],
      extraHeaders: ngrokSkipBrowserWarningHeaders(env.socketUrl),
    });

    if (__DEV__) {
      socketClient.on("connect_error", (err: Error) => {
        console.warn("[Socket] connect_error:", err?.message ?? err);
      });
      socketClient.on("connect", () => {
        console.info("[Socket] connected", socketClient?.id);
      });
    }
  }
  return socketClient;
};

export const disconnectSocketClient = (): void => {
  socketClient?.disconnect();
};
