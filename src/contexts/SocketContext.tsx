import { createContext, useContext, useEffect, type PropsWithChildren } from "react";
import type { Socket } from "socket.io-client";
import { router } from "expo-router";

import { useAppSelector, useAppDispatch } from "@/hooks/useAppStore";
import { clearAuthState } from "@/store/slices/authSlice";
import { secureStorage } from "@/services/storage";
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
  const dispatch = useAppDispatch();
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
    const handleForceLogout = async () => {
      console.log("[Socket] Received auth:force_logout. Logging out...");
      await secureStorage.clearTokens();
      dispatch(clearAuthState());
      router.replace("/(auth)/login");
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("auth:force_logout", handleForceLogout);
    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("auth:force_logout", handleForceLogout);
      detachCallGroupSocketFromRedux();
      disconnectSocketClient();
    };
  }, [isAuthenticated, accessToken, socket, dispatch]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
};

export const useSocketContext = () => useContext(SocketContext);
