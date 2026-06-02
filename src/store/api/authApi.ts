import { createApi } from "@reduxjs/toolkit/query/react";

import { baseQueryWithReauth } from "@/store/api/baseQueryWithReauth";

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

interface FaceLivenessStartResponse {
  sessionId: string;
}

interface FaceLoginRequest {
  email: string;
  livenessSessionId: string;
}

interface EnableFaceLoginRequest {
  password: string;
  livenessSessionId: string;
}

interface SessionDeviceInfo {
  userAgent: string;
  os?: string;
  osVersion?: string;
  browser?: string;
  deviceName?: string;
  model?: string;
  brand?: string;
  manufacturer?: string;
  appClient?: string;
}

export interface AuthSessionSummary {
  sessionId: string;
  deviceInfo: SessionDeviceInfo;
  ipAddress: string;
  location: {
    city: string;
    region: string;
    country: string;
    countryCode: string;
  } | null;
  expiresAt: number;
  isRevoked: boolean;
  createdAt: string;
  updatedAt: string;
  isCurrent: boolean;
  isActive: boolean;
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
  baseQuery: baseQueryWithReauth,
  tagTypes: ["AuthSessions"],
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
      transformResponse: (response: ApiEnvelope<Omit<AuthTokenResponse, "userId">>) =>
        response.data,
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
    createFaceLivenessSession: builder.mutation<FaceLivenessStartResponse, void>({
      query: () => ({
        url: "/auth/face-liveness/start",
        method: "POST",
      }),
      transformResponse: (response: ApiEnvelope<FaceLivenessStartResponse>) => response.data,
    }),
    faceLogin: builder.mutation<AuthTokenResponse, FaceLoginRequest>({
      query: (body) => ({
        url: "/auth/face-login",
        method: "POST",
        body,
      }),
      transformResponse: (response: ApiEnvelope<AuthTokenResponse>) => response.data,
    }),
    enableFaceLogin: builder.mutation<ApiEnvelope<null>, EnableFaceLoginRequest>({
      query: (body) => ({
        url: "/auth/face-login/enable",
        method: "POST",
        body,
      }),
    }),
    disableFaceLogin: builder.mutation<ApiEnvelope<null>, void>({
      query: () => ({
        url: "/auth/face-login/disable",
        method: "DELETE",
      }),
    }),
    getSessions: builder.query<ApiEnvelope<AuthSessionSummary[]>, void>({
      query: () => ({
        url: "/auth/sessions",
        method: "GET",
      }),
      providesTags: ["AuthSessions"],
    }),
    revokeSession: builder.mutation<ApiEnvelope<null>, string>({
      query: (sessionId) => ({
        url: `/auth/sessions/${sessionId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["AuthSessions"],
    }),
    logout: builder.mutation<
      { message: string },
      { accessToken?: string | null; deviceToken?: string }
    >({
      query: ({ accessToken, deviceToken }) => ({
        url: "/auth/logout",
        method: "POST",
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        body: deviceToken ? { deviceToken } : undefined,
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
  useCreateFaceLivenessSessionMutation,
  useFaceLoginMutation,
  useEnableFaceLoginMutation,
  useDisableFaceLoginMutation,
  useGetSessionsQuery,
  useRevokeSessionMutation,
  useLogoutMutation,
} = authApi;
