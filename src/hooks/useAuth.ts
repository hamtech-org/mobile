import { useCallback } from "react";
import { useRouter } from "expo-router";

import {
  useForgotPasswordMutation,
  useLoginMutation,
  useRegisterMutation,
  useVerifyLoginOtpMutation,
  type AuthTokenResponse,
} from "@/store/api/authApi";
import { clearAuthState, setAuthState } from "@/store/slices/authSlice";
import { secureStorage } from "@/services/storage";
import { useAppDispatch } from "./useAppStore";

interface RegisterPayload {
  email: string;
  password: string;
  displayName: string;
}

export const useAuth = () => {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [loginMutation, loginState] = useLoginMutation();
  const [registerMutation, registerState] = useRegisterMutation();
  const [verifyLoginOtpMutation, verifyLoginOtpState] = useVerifyLoginOtpMutation();
  const [forgotPasswordMutation, forgotPasswordState] = useForgotPasswordMutation();

  const applyAuthSession = useCallback(
    async (response: AuthTokenResponse, fallback?: { email?: string; displayName?: string }) => {
      await secureStorage.setTokens(response.accessToken, response.refreshToken);
      dispatch(
        setAuthState({
          user: {
            userId: response.userId,
            email: fallback?.email ?? "",
            displayName: fallback?.displayName ?? "",
          },
          accessToken: response.accessToken,
          refreshToken: response.refreshToken,
        }),
      );
      router.replace("/");
    },
    [dispatch, router],
  );

  const login = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      try {
        await loginMutation({ email, password }).unwrap();
        router.push({ pathname: "/(auth)/otp-verification", params: { email, mode: "login" } });
        return true;
      } catch {
        return false;
      }
    },
    [loginMutation, router],
  );

  const register = useCallback(
    async (payload: RegisterPayload): Promise<boolean> => {
      try {
        await registerMutation(payload).unwrap();
        router.push({ pathname: "/(auth)/otp-verification", params: { email: payload.email, mode: "register" } });
        return true;
      } catch {
        return false;
      }
    },
    [registerMutation, router],
  );

  const verifyLoginOtp = useCallback(
    async (email: string, otp: string): Promise<boolean> => {
      try {
        const response = await verifyLoginOtpMutation({ email, otp }).unwrap();
        await applyAuthSession(response, { email });
        return true;
      } catch {
        return false;
      }
    },
    [applyAuthSession, verifyLoginOtpMutation],
  );

  const forgotPassword = useCallback(
    async (email: string): Promise<boolean> => {
      try {
        await forgotPasswordMutation({ email }).unwrap();
        return true;
      } catch {
        return false;
      }
    },
    [forgotPasswordMutation],
  );

  const logout = useCallback(async () => {
    await secureStorage.clearTokens();
    dispatch(clearAuthState());
    router.replace("/");
  }, [dispatch, router]);

  const isLoading =
    loginState.isLoading || registerState.isLoading || verifyLoginOtpState.isLoading || forgotPasswordState.isLoading;

  const errorMessage =
    (loginState.error as { data?: { message?: string } } | undefined)?.data?.message ??
    (registerState.error as { data?: { message?: string } } | undefined)?.data?.message ??
    (verifyLoginOtpState.error as { data?: { message?: string } } | undefined)?.data?.message ??
    (forgotPasswordState.error as { data?: { message?: string } } | undefined)?.data?.message ??
    null;

  return {
    login,
    register,
    verifyLoginOtp,
    forgotPassword,
    logout,
    isLoading,
    errorMessage,
  };
};
