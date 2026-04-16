import { useCallback } from "react";

import { useLoginMutation } from "@/store/api/authApi";
import { clearAuthState, setAuthState } from "@/store/slices/authSlice";
import { secureStorage } from "@/services/storage";
import { useAppDispatch } from "./useAppStore";

export const useAuth = () => {
  const dispatch = useAppDispatch();
  const [loginMutation, { isLoading }] = useLoginMutation();

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await loginMutation({ email, password }).unwrap();
      await secureStorage.setTokens(response.accessToken, response.refreshToken);
      dispatch(
        setAuthState({
          user: response.user,
          accessToken: response.accessToken,
          refreshToken: response.refreshToken,
        }),
      );
    },
    [dispatch, loginMutation],
  );

  const logout = useCallback(async () => {
    await secureStorage.clearTokens();
    dispatch(clearAuthState());
  }, [dispatch]);

  return {
    login,
    logout,
    isLoading,
  };
};
