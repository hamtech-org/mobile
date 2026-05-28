import { createContext, useContext, useEffect, type PropsWithChildren } from "react";
import type { Socket } from "socket.io-client";

import { useAppSelector } from "@/hooks/useAppStore";
import {
  attachCallGroupSocketToRedux,
  detachCallGroupSocketFromRedux,
} from "@/services/callGroupReduxSync";
import {
  disconnectSocketClient,
  getSocketClient,
  normalizeSocketAuthToken,
} from "@/services/socket";

const SocketContext = createContext<Socket | null>(null);

export const SocketProvider = ({ children }: PropsWithChildren) => {
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const accessToken = useAppSelector((state) => state.auth.accessToken);
  const socket = getSocketClient();

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      disconnectSocketClient();
      return;
    }

    const token = normalizeSocketAuthToken(accessToken);
    if (!token) {
      disconnectSocketClient();
      return;
    }

    socket.auth = { token };
    if (socket.connected) {
      socket.disconnect();
    }

    detachCallGroupSocketFromRedux();
    socket.connect();

    const handleConnect = () => {
      attachCallGroupSocketToRedux(socket);
    };
    const handleDisconnect = () => {
      detachCallGroupSocketFromRedux();
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      detachCallGroupSocketFromRedux();
      disconnectSocketClient();
    };
  }, [isAuthenticated, accessToken, socket]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
};

export const useSocketContext = () => useContext(SocketContext);
