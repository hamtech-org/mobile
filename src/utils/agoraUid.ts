import SparkMD5 from "spark-md5";

/**
 * Cùng quy tắc với backend `generateRtcToken` / web `CallPage`: MD5(userId) → 4 byte đầu (uint32).
 */
export function userIdToAgoraUid(userId: string): number {
  const hex = SparkMD5.hash(userId);
  return (parseInt(hex.slice(0, 8), 16) >>> 0) as number;
}
