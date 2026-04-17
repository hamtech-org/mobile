import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

import { env } from "@/config/env";

interface LoginRequest {
  email: string;
  password: string;
}

interface RegisterRequest {
  email: string;
  password: string;
  displayName: string;
}

interface AuthStepOneResponse {
  message: string;
}

export interface AuthTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  userId: string;
}

interface ForgotPasswordRequest {
  email: string;
}

interface ForgotPasswordResponse {
  message: string;
}

interface RefreshTokenRequest {
  refreshToken: string;
}

interface VerifyEmailRequest {
  email: string;
  otp: string;
}

interface ResetPasswordRequest {
  email: string;
  token: string;
  newPassword: string;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message: string;
}

export const authApi = createApi({
  reducerPath: "authApi",
  baseQuery: fetchBaseQuery({
    baseUrl: env.apiBaseUrl,
    prepareHeaders: (headers, { getState }) => {
      const state = getState() as { auth?: { accessToken?: string | null } };
      const token = state.auth?.accessToken;
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
      return headers;
    },
  }),
  endpoints: (builder) => ({
    login: builder.mutation<AuthStepOneResponse, LoginRequest>({
      query: (body) => ({
        url: "/auth/login",
        method: "POST",
        body,
      }),
      transformResponse: (response: ApiEnvelope<AuthStepOneResponse>) => response.data,
    }),
    register: builder.mutation<AuthStepOneResponse, RegisterRequest>({
      query: (body) => ({
        url: "/auth/register",
        method: "POST",
        body,
      }),
      transformResponse: (response: ApiEnvelope<AuthStepOneResponse>) => response.data,
    }),
    verifyLoginOtp: builder.mutation<AuthTokenResponse, { email: string; otp: string }>({
      query: (body) => ({
        url: "/auth/verify-login-otp",
        method: "POST",
        body,
      }),
      transformResponse: (response: ApiEnvelope<AuthTokenResponse>) => response.data,
    }),
    forgotPassword: builder.mutation<ForgotPasswordResponse, ForgotPasswordRequest>({
      query: (body) => ({
        url: "/auth/forgot-password",
        method: "POST",
        body,
      }),
      transformResponse: (response: ApiEnvelope<null>) => ({ message: response.message }),
    }),
    refreshToken: builder.mutation<Omit<AuthTokenResponse, "userId">, RefreshTokenRequest>({
      query: (body) => ({
        url: "/auth/refresh-token",
        method: "POST",
        body,
      }),
      transformResponse: (response: ApiEnvelope<Omit<AuthTokenResponse, "userId">>) => response.data,
    }),
    verifyEmail: builder.mutation<AuthTokenResponse, VerifyEmailRequest>({
      query: (body) => ({
        url: "/auth/verify-email",
        method: "POST",
        body,
      }),
      transformResponse: (response: ApiEnvelope<AuthTokenResponse>) => response.data,
    }),
    resetPassword: builder.mutation<{ message: string }, ResetPasswordRequest>({
      query: (body) => ({
        url: "/auth/reset-password",
        method: "POST",
        body,
      }),
      transformResponse: (response: ApiEnvelope<null>) => ({ message: response.message }),
    }),
    logout: builder.mutation<{ message: string }, { accessToken?: string | null }>({
      query: ({ accessToken }) => ({
        url: "/auth/logout",
        method: "POST",
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      }),
      transformResponse: (response: ApiEnvelope<null>) => ({ message: response.message }),
    }),
  }),
});

export const {
  useLoginMutation,
  useRegisterMutation,
  useVerifyLoginOtpMutation,
  useForgotPasswordMutation,
  useRefreshTokenMutation,
  useVerifyEmailMutation,
  useResetPasswordMutation,
  useLogoutMutation,
} = authApi;
