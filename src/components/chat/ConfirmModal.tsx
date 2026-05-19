import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { X } from "lucide-react-native";
import type { ReactNode } from "react";

/** `dangerSoft`: nút xác nhận nền đỏ nhạt chữ đỏ đậm (kiểu Zalo). */
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
  const confirmBtnStyle =
    variant === "danger"
      ? styles.confirmDanger
      : variant === "dangerSoft"
        ? styles.confirmDangerSoft
        : styles.confirmPrimary;

  const confirmTextStyle =
    variant === "dangerSoft" ? styles.confirmDangerSoftText : styles.confirmBtnText;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
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
              style={({ pressed }) => [
                styles.cancelBtn,
                pressed && !isConfirming && { opacity: 0.85 },
                isConfirming && styles.btnDisabled,
              ]}
            >
              <Text style={styles.cancelBtnText}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              disabled={isConfirming}
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.confirmBtn,
                confirmBtnStyle,
                pressed && !isConfirming && { opacity: 0.9 },
                isConfirming && styles.btnDisabled,
              ]}
            >
              {isConfirming ? (
                <ActivityIndicator
                  size="small"
                  color={variant === "dangerSoft" ? Z.redSoftText : "#fff"}
                />
              ) : (
                <Text style={confirmTextStyle} numberOfLines={2}>
                  {confirmLabel}
                </Text>
              )}
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
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: Z.bg,
    borderRadius: 16,
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
    paddingHorizontal: 20,
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
    paddingHorizontal: 20,
    paddingVertical: 18,
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
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  cancelBtn: {
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.05)",
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: Z.text,
  },
  confirmBtn: {
    minWidth: 100,
    maxWidth: "58%",
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmPrimary: {
    backgroundColor: Z.primary,
  },
  confirmDanger: {
    backgroundColor: Z.red,
  },
  confirmDangerSoft: {
    backgroundColor: Z.redSoftBg,
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
  },
  confirmDangerSoftText: {
    fontSize: 15,
    fontWeight: "700",
    color: Z.redSoftText,
    textAlign: "center",
  },
  btnDisabled: {
    opacity: 0.55,
  },
});
