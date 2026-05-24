import { useEffect, useState } from "react";

import { scanChatQrFromImageUrl, type ChatQrScanResult } from "@/utils/scanJoinQrFromImage";

export function useChatQrInImage(
  imageUri: string | null,
  messageId: string,
  enabled: boolean,
): { qrResult: ChatQrScanResult | null; scanning: boolean } {
  const [qrResult, setQrResult] = useState<ChatQrScanResult | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    if (!enabled || !imageUri) {
      setQrResult(null);
      setScanning(false);
      return;
    }

    let cancelled = false;
    setScanning(true);
    void scanChatQrFromImageUrl(imageUri, messageId).then((result) => {
      if (!cancelled) {
        setQrResult(result);
        setScanning(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, imageUri, messageId]);

  return { qrResult, scanning };
}
