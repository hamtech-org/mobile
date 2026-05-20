import { useEffect, useState } from "react";

import { scanJoinSuffixFromImageUrl } from "@/utils/scanJoinQrFromImage";

/**
 * Quét QR trong ảnh tin nhắn (cache theo messageId + uri).
 * Chỉ bật khi tin là ảnh hợp lệ, chưa thu hồi/xóa.
 */
export function useJoinQrInImage(
  imageUri: string | null,
  messageId: string,
  enabled: boolean,
): { joinSuffix: string | null; scanning: boolean } {
  const [joinSuffix, setJoinSuffix] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    if (!enabled || !imageUri) {
      setJoinSuffix(null);
      setScanning(false);
      return;
    }

    let cancelled = false;
    setScanning(true);
    void scanJoinSuffixFromImageUrl(imageUri, messageId).then((suffix) => {
      if (!cancelled) {
        setJoinSuffix(suffix);
        setScanning(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, imageUri, messageId]);

  return { joinSuffix, scanning };
}
