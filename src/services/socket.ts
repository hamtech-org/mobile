import { io, type Socket } from "socket.io-client";

import { env } from "@/config/env";

let socketClient: Socket | null = null;

export const getSocketClient = (): Socket => {
  if (!socketClient) {
    socketClient = io(env.socketUrl, {
      autoConnect: false,
      transports: ["websocket"],
    });
  }
  return socketClient;
};

export const disconnectSocketClient = (): void => {
  if (socketClient?.connected) {
    socketClient.disconnect();
  }
};
