import { apiClient } from "@/services/api";

export interface LiveRtcTokenPayload {
  token: string;
  uid: number;
  channel: string;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message: string;
}

export async function fetchLiveRtcToken(
  channelName: string,
  role: "publisher" | "subscriber",
): Promise<LiveRtcTokenPayload> {
  const res = await apiClient.get<ApiEnvelope<LiveRtcTokenPayload>>("/agora/rtc-token", {
    params: { channelName, role },
  });
  return res.data.data;
}
