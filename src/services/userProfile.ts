import { apiClient } from "@/services/api";
import type { AuthUser } from "@/store/slices/authSlice";

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message: string;
}

interface UserProfileResponse {
  userId: string;
  email: string;
  displayName: string;
  avatar?: string | null;
}

export const fetchCurrentUserProfile = async (): Promise<AuthUser | null> => {
  try {
    const response = await apiClient.get<ApiEnvelope<UserProfileResponse>>("/users/me");
    return {
      userId: response.data.data.userId,
      email: response.data.data.email,
      displayName: response.data.data.displayName,
      avatar: response.data.data.avatar ?? null,
    };
  } catch {
    return null;
  }
};
