import { useSocketContext } from "@/contexts/SocketContext";

export const useSocket = () => {
  return useSocketContext();
};
