import { createContext, useContext, useEffect, type PropsWithChildren } from "react";
import type { Socket } from "socket.io-client";

import { useAppSelector } from "@/hooks/useAppStore";
import { disconnectSocketClient, getSocketClient } from "@/services/socket";

const SocketContext = createContext<Socket | null>(null);

export const SocketProvider = ({ children }: PropsWithChildren) => {
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const socket = getSocketClient();

  useEffect(() => {
    if (isAuthenticated && !socket.connected) {
      socket.connect();
    }
    if (!isAuthenticated) {
      disconnectSocketClient();
    }
  }, [isAuthenticated, socket]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
};

export const useSocketContext = () => useContext(SocketContext);
