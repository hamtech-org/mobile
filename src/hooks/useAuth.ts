import { useCallback } from "react";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  useForgotPasswordMutation,
  useLoginMutation,
  useLogoutMutation,
  useResetPasswordMutation,
  useRegisterMutation,
  useVerifyEmailMutation,
  useVerifyLoginOtpMutation,
  useCreateFaceLivenessSessionMutation,
  useFaceLoginMutation,
  type AuthTokenResponse,
} from "@/store/api/authApi";
import { clearMarkAsReadDedupeCache } from "@/utils/markAsReadSessionDedupe";
import { clearAuthState, setAuthState } from "@/store/slices/authSlice";
import { secureStorage } from "@/services/storage";
import { fetchCurrentUserProfile } from "@/services/userProfile";
import { extractMutationErrorMessage } from "@/utils/apiError";
import { useAppDispatch, useAppSelector } from "./useAppStore";

interface RegisterPayload {
  email: string;
  password: string;
  displayName: string;
}

export const useAuth = () => {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const accessToken = useAppSelector((state) => state.auth.accessToken);
  const [loginMutation, loginState] = useLoginMutation();
  const [registerMutation, registerState] = useRegisterMutation();
  const [verifyLoginOtpMutation, verifyLoginOtpState] = useVerifyLoginOtpMutation();
  const [verifyEmailMutation, verifyEmailState] = useVerifyEmailMutation();
  const [forgotPasswordMutation, forgotPasswordState] = useForgotPasswordMutation();
  const [resetPasswordMutation, resetPasswordState] = useResetPasswordMutation();
  const [createFaceLivenessSessionMutation, createFaceLivenessSessionState] =
    useCreateFaceLivenessSessionMutation();
  const [faceLoginMutation, faceLoginState] = useFaceLoginMutation();
  const [logoutMutation, logoutState] = useLogoutMutation();

  const applyAuthSession = useCallback(
    async (
      response: AuthTokenResponse,
      fallback?: { email?: string; displayName?: string },
      redirectPath?: string,
    ) => {
      await secureStorage.setTokens(response.accessToken, response.refreshToken);
      const hydratedProfile = await fetchCurrentUserProfile();
      dispatch(
        setAuthState({
          user: hydratedProfile ?? {
            userId: response.userId,
            email: fallback?.email ?? "",
            displayName: fallback?.displayName ?? "",
          },
          accessToken: response.accessToken,
          refreshToken: response.refreshToken,
        }),
      );
      const target = redirectPath?.trim().startsWith("/") ? redirectPath.trim() : "/(main)/(chat)";
      router.replace(target as "/");
    },
    [dispatch, router],
  );

  const login = useCallback(
    async (email: string, password: string, redirectPath?: string): Promise<boolean> => {
      try {
        await loginMutation({ email, password }).unwrap();
        router.push({
          pathname: "/(auth)/otp-verification",
          params: {
            email,
            mode: "login",
            notice: "Đã gửi OTP đăng nhập. Vui lòng kiểm tra email.",
            ...(redirectPath?.trim() ? { redirect: redirectPath.trim() } : {}),
          },
        });
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
        router.push({
          pathname: "/(auth)/otp-verification",
          params: {
            email: payload.email,
            mode: "register",
            notice: "Đã gửi OTP xác thực email đăng ký.",
          },
        });
        return true;
      } catch {
        return false;
      }
    },
    [registerMutation, router],
  );

  const verifyLoginOtp = useCallback(
    async (email: string, otp: string, redirectPath?: string): Promise<boolean> => {
      try {
        const response = await verifyLoginOtpMutation({ email, otp }).unwrap();
        await applyAuthSession(response, { email }, redirectPath);
        return true;
      } catch {
        return false;
      }
    },
    [applyAuthSession, verifyLoginOtpMutation],
  );

  const verifyRegisterOtp = useCallback(
    async (email: string, otp: string): Promise<boolean> => {
      try {
        const response = await verifyEmailMutation({ email, otp }).unwrap();
        await applyAuthSession(response, { email });
        return true;
      } catch {
        return false;
      }
    },
    [applyAuthSession, verifyEmailMutation],
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

  const resetPassword = useCallback(
    async (email: string, token: string, newPassword: string): Promise<boolean> => {
      try {
        await resetPasswordMutation({ email, token, newPassword }).unwrap();
        router.replace("/(auth)/login");
        return true;
      } catch {
        return false;
      }
    },
    [resetPasswordMutation, router],
  );

  const createFaceLivenessSession = useCallback(async (): Promise<string | null> => {
    try {
      const response = await createFaceLivenessSessionMutation().unwrap();
      return response.sessionId;
    } catch {
      return null;
    }
  }, [createFaceLivenessSessionMutation]);

  const loginWithFace = useCallback(
    async (email: string, livenessSessionId: string, redirectPath?: string): Promise<boolean> => {
      try {
        const response = await faceLoginMutation({ email, livenessSessionId }).unwrap();
        await applyAuthSession(response, { email }, redirectPath);
        return true;
      } catch {
        return false;
      }
    },
    [applyAuthSession, faceLoginMutation],
  );

  const logout = useCallback(async () => {
    try {
      const storedTokens = await AsyncStorage.getItem("hamtech_registered_push_tokens");
      const tokens = storedTokens ? (JSON.parse(storedTokens) as string[]) : [];
      const deviceToken = tokens[0]; // Lấy token đầu tiên (nếu có) để gửi lên backend xóa
      await logoutMutation({ accessToken, deviceToken }).unwrap();
    } catch {
      // Luôn cho phép logout local để tránh user bị kẹt phiên đăng nhập.
    }
    await secureStorage.clearTokens();
    await AsyncStorage.removeItem("hamtech_registered_push_tokens").catch(() => undefined);
    clearMarkAsReadDedupeCache();
    dispatch(clearAuthState());
    router.replace("/(auth)/login");
  }, [accessToken, dispatch, logoutMutation, router]);

  const isLoading =
    loginState.isLoading ||
    registerState.isLoading ||
    verifyLoginOtpState.isLoading ||
    verifyEmailState.isLoading ||
    forgotPasswordState.isLoading ||
    resetPasswordState.isLoading ||
    createFaceLivenessSessionState.isLoading ||
    faceLoginState.isLoading ||
    logoutState.isLoading;

  const errorMessage =
    extractMutationErrorMessage(loginState.error) ??
    extractMutationErrorMessage(registerState.error) ??
    extractMutationErrorMessage(verifyLoginOtpState.error) ??
    extractMutationErrorMessage(verifyEmailState.error) ??
    extractMutationErrorMessage(forgotPasswordState.error) ??
    extractMutationErrorMessage(resetPasswordState.error) ??
    extractMutationErrorMessage(createFaceLivenessSessionState.error) ??
    extractMutationErrorMessage(faceLoginState.error) ??
    extractMutationErrorMessage(logoutState.error) ??
    null;

  return {
    login,
    register,
    verifyLoginOtp,
    verifyRegisterOtp,
    forgotPassword,
    resetPassword,
    createFaceLivenessSession,
    loginWithFace,
    logout,
    isLoading,
    errorMessage,
  };
};
