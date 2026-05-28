import { pushToast, removeToast, type AppToastVariant } from "@/store/slices/notificationSlice";
import { store } from "@/store/store";

const DEFAULT_MS = 3200;
const ERROR_MS = 4500;

function enqueue(message: string, variant: AppToastVariant, duration: number) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  store.dispatch(pushToast({ id, message, variant }));
  if (duration > 0) {
    setTimeout(() => {
      store.dispatch(removeToast(id));
    }, duration);
  }
}

/** Thông báo nổi giống react-toastify trên web. */
export const toast = {
  success: (message: string, duration = DEFAULT_MS) => enqueue(message, "success", duration),
  error: (message: string, duration = ERROR_MS) => enqueue(message, "error", duration),
  info: (message: string, duration = DEFAULT_MS) => enqueue(message, "info", duration),
  warning: (message: string, duration = DEFAULT_MS) => enqueue(message, "warning", duration),
};
