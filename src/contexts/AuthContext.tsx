import { createContext, useContext, useEffect, type PropsWithChildren } from "react";

import { useAppDispatch } from "@/hooks/useAppStore";
import { secureStorage } from "@/services/storage";
import { setBootstrappingDone } from "@/store/slices/authSlice";

const AuthContext = createContext({ isReady: false });

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const dispatch = useAppDispatch();

  useEffect(() => {
    const bootstrap = async () => {
      await secureStorage.getRefreshToken();
      dispatch(setBootstrappingDone());
    };

    void bootstrap();
  }, [dispatch]);

  return <AuthContext.Provider value={{ isReady: true }}>{children}</AuthContext.Provider>;
};

export const useAuthContext = () => useContext(AuthContext);
