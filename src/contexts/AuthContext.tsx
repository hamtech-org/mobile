import { createContext, useContext, useEffect, type PropsWithChildren } from "react";

import { useAppDispatch } from "@/hooks/useAppStore";
import { secureStorage } from "@/services/storage";
import { fetchCurrentUserProfile } from "@/services/userProfile";
import { useRefreshTokenMutation } from "@/store/api/authApi";
import { setAuthState, setBootstrappingDone } from "@/store/slices/authSlice";

const AuthContext = createContext({ isReady: false });

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const dispatch = useAppDispatch();
  const [refreshTokenMutation] = useRefreshTokenMutation();

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const refreshToken = await secureStorage.getRefreshToken();
        if (!refreshToken) {
          dispatch(setBootstrappingDone());
          return;
        }

        const response = await refreshTokenMutation({ refreshToken }).unwrap();
        await secureStorage.setTokens(response.accessToken, response.refreshToken);
        const hydratedProfile = await fetchCurrentUserProfile();
        dispatch(
          setAuthState({
            user: hydratedProfile ?? { userId: "unknown", email: "", displayName: "" },
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
          }),
        );
      } catch {
        await secureStorage.clearTokens();
        dispatch(setBootstrappingDone());
      }
    };

    void bootstrap();
  }, [dispatch, refreshTokenMutation]);

  return <AuthContext.Provider value={{ isReady: true }}>{children}</AuthContext.Provider>;
};

export const useAuthContext = () => useContext(AuthContext);
