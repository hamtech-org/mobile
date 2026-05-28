import React, { useRef } from "react";
import {
  View,
  Pressable,
  StyleSheet,
  Modal,
  TouchableWithoutFeedback,
  Dimensions,
} from "react-native";
import Animated, {
  FadeInDown,
  FadeOutDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import LottieView from "lottie-react-native";
import { REACTION_META, ReactionType } from "@/types/reaction.types";

interface EmojiPickerProps {
  isVisible: boolean;
  onReact: (type: ReactionType) => void;
  onClose: () => void;
  /** Screen-absolute Y position of the anchor button (top edge) */
  anchorY?: number;
  /** Screen-absolute X position of the anchor button (left edge) */
  anchorX?: number;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const PICKER_HEIGHT = 54; // approximate height of the picker card
const PICKER_MARGIN = 4; // reduced margin to bring it closer to the button

export const EmojiPicker: React.FC<EmojiPickerProps> = ({
  isVisible,
  onReact,
  onClose,
  anchorY,
  anchorX,
}) => {
  // Position the picker above the anchor button
  const pickerTop =
    anchorY !== undefined
      ? Math.max(8, anchorY - PICKER_HEIGHT - PICKER_MARGIN)
      : SCREEN_HEIGHT * 0.6;

  // Keep picker from clipping off right edge
  const pickerLeft = anchorX !== undefined ? Math.min(anchorX, SCREEN_WIDTH - 320 - 8) : 16;

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <Animated.View
              entering={FadeInDown.springify().damping(18).stiffness(200)}
              exiting={FadeOutDown.duration(150)}
              style={[styles.card, { top: pickerTop, left: pickerLeft }]}
            >
              {(
                Object.entries(REACTION_META) as [
                  ReactionType,
                  (typeof REACTION_META)[ReactionType],
                ][]
              ).map(([type, meta]) => (
                <EmojiItem key={type} type={type} meta={meta} onReact={onReact} />
              ))}
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const EmojiItem = ({
  type,
  meta,
  onReact,
}: {
  type: ReactionType;
  meta: { emoji: string; label: string; color: string; lottie: any; gif: string };
  onReact: (type: ReactionType) => void;
}) => {
  const scale = useSharedValue(1);
  const lottieRef = useRef<LottieView>(null);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(1.5, { damping: 8, stiffness: 120 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 10, stiffness: 120 });
  };

  return (
    <Pressable
      onPress={() => onReact(type)}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.emojiBtn}
    >
      <Animated.View style={animatedStyle}>
        <LottieView
          ref={lottieRef}
          source={meta.lottie}
          autoPlay={true}
          loop={true}
          style={styles.emojiLottie}
        />
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  card: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 30,
    paddingHorizontal: 8,
    paddingVertical: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 16,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  emojiBtn: {
    padding: 5,
    marginHorizontal: 1,
  },
  emojiLottie: {
    width: 36,
    height: 36,
  },
});
