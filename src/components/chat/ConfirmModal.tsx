import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { X } from "lucide-react-native";
import type { ReactNode } from "react";

/** `dangerSoft`: nút xác nhận nền đỏ nhạt chữ đỏ đậm (kiểu Zalo — giải tán nhóm). */
export type ConfirmModalVariant = "primary" | "danger" | "dangerSoft";

type ConfirmModalProps = {
  visible: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  variant?: ConfirmModalVariant;
  isConfirming?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

const Z = {
  bg: "#FFFFFF",
  text: "#111827",
  sub: "#6B7280",
  line: "rgba(0,0,0,0.06)",
  primary: "#0068FF",
  red: "#DC2626",
  redSoftBg: "#FEE2E2",
  redSoftText: "#B91C1C",
};

export function ConfirmModal({
  visible,
  title,
  description,
  confirmLabel,
  cancelLabel = "Hủy",
  variant = "primary",
  isConfirming = false,
  onClose,
  onConfirm,
}: ConfirmModalProps) {
  const confirmBtnVariantStyle =
    variant === "danger"
      ? styles.confirmBtnDanger
      : variant === "dangerSoft"
        ? styles.confirmBtnDangerSoft
        : styles.confirmBtnPrimary;
  const confirmTextVariantStyle =
    variant === "dangerSoft" ? styles.confirmBtnTextDangerSoft : styles.confirmBtnTextLight;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={() => {
        if (!isConfirming) onClose();
      }}
    >
      <Pressable
        style={styles.overlay}
        onPress={() => {
          if (!isConfirming) onClose();
        }}
        accessibilityRole="button"
        accessibilityLabel="Đóng"
      >
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title} accessibilityRole="header">
              {title}
            </Text>
            <Pressable
              hitSlop={12}
              disabled={isConfirming}
              onPress={onClose}
              accessibilityLabel="Đóng"
              style={({ pressed }) => [
                styles.closeBtn,
                pressed && !isConfirming && { opacity: 0.6 },
              ]}
            >
              <X size={22} color={Z.sub} strokeWidth={2} />
            </Pressable>
          </View>

          {description ? (
            <View style={styles.body}>
              {typeof description === "string" ? (
                <Text style={styles.description}>{description}</Text>
              ) : (
                description
              )}
            </View>
          ) : null}

          <View style={styles.footer}>
            <Pressable
              disabled={isConfirming}
              onPress={onClose}
              style={[styles.cancelBtn, isConfirming && styles.btnDisabled]}
              android_ripple={{ color: "rgba(0,0,0,0.08)" }}
            >
              <Text style={styles.cancelBtnText}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              disabled={isConfirming}
              onPress={onConfirm}
              style={[
                styles.confirmBtn,
                confirmBtnVariantStyle,
                isConfirming && styles.btnDisabled,
              ]}
              android_ripple={{ color: "rgba(255,255,255,0.2)" }}
            >
              <Text style={[styles.confirmBtnText, confirmTextVariantStyle]}>
                {isConfirming ? "Đang xử lý…" : confirmLabel}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: Z.bg,
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Z.line,
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
    color: Z.text,
    marginRight: 8,
  },
  closeBtn: {
    padding: 4,
  },
  body: {
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "500",
    color: Z.sub,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 12,
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: Z.text,
    textAlign: "center",
  },
  confirmBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 88,
  },
  confirmBtnPrimary: {
    backgroundColor: Z.primary,
  },
  confirmBtnDanger: {
    backgroundColor: Z.red,
  },
  confirmBtnDangerSoft: {
    backgroundColor: Z.redSoftBg,
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
  confirmBtnTextLight: {
    color: "#FFFFFF",
  },
  confirmBtnTextDangerSoft: {
    color: Z.redSoftText,
  },
  btnDisabled: {
    opacity: 0.5,
  },
});
