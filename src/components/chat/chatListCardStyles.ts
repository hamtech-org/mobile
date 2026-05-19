import { Platform, StyleSheet } from "react-native";

export const CHAT_LIST_CARD_BORDER = "#D1D5DB";
export const CHAT_LIST_CARD_RADIUS = 14;

/** Shell card danh sách chat (file, tin ghim, …) — border hiển thị ổn trên Android. */
export const chatListCardStyles = StyleSheet.create({
  pressable: {
    width: "100%",
  },
  pressablePressed: {
    opacity: 0.92,
  },
  card: {
    width: "100%",
    borderRadius: CHAT_LIST_CARD_RADIUS,
    borderWidth: 1,
    borderColor: CHAT_LIST_CARD_BORDER,
    backgroundColor: "#FFFFFF",
    paddingVertical: 14,
    paddingHorizontal: 14,
    ...Platform.select({
      ios: {
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
      },
      android: {},
    }),
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: "#202124",
    lineHeight: 22,
  },
  meta: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "400",
    color: "#70757A",
    lineHeight: 18,
  },
  preview: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "400",
    color: "#5F6368",
    lineHeight: 18,
  },
});
