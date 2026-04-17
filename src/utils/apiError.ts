type MutationErrorPayload = {
  data?: {
    message?: string;
    error?: {
      message?: string;
    };
  };
  error?: string;
};

export const extractMutationErrorMessage = (error: unknown): string | null => {
  if (!error || typeof error !== "object") {
    return null;
  }

  const payload = error as MutationErrorPayload;
  return payload.data?.error?.message ?? payload.data?.message ?? payload.error ?? null;
};
