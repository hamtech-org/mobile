import React, { useRef, useState, useEffect } from "react";
import { View, Text, Pressable } from "react-native";
import { ThumbsUp } from "lucide-react-native";
import LottieView from "lottie-react-native";
import { EmojiPicker } from "./EmojiPicker";
import { type ReactionType, REACTION_META } from "@/types/reaction.types";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

interface ReactionButtonProps {
  currentUserReaction?: ReactionType | null;
  onReact: (type: ReactionType | null) => void;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

export const ReactionButton: React.FC<ReactionButtonProps> = ({
  currentUserReaction,
  onReact,
  size = "md",
  showLabel = true,
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const [anchorY, setAnchorY] = useState<number | undefined>(undefined);
  const [anchorX, setAnchorX] = useState<number | undefined>(undefined);
  const buttonRef = useRef<View>(null);
  const lottieRef = useRef<LottieView>(null);
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Logic: Chạy animation 1 lần khi reaction thay đổi
  useEffect(() => {
    if (currentUserReaction && lottieRef.current) {
      lottieRef.current.play(0, -1);
    }
  }, [currentUserReaction]);

  const handleReact = (type: ReactionType) => {
    setShowPicker(false);
    if (currentUserReaction === type) {
      onReact(null);
    } else {
      onReact(type);
    }
  };

  const handlePress = () => {
    scale.value = withSpring(0.85, { damping: 10, stiffness: 150 }, () => {
      scale.value = withSpring(1);
    });
    if (currentUserReaction) {
      onReact(null);
    } else {
      handleReact("like");
    }
  };

  const handleLongPress = () => {
    buttonRef.current?.measureInWindow((x, y, _width, _height) => {
      setAnchorX(x);
      setAnchorY(y);
      setShowPicker(true);
    });
  };

  const currentMeta = currentUserReaction ? REACTION_META[currentUserReaction] : null;
  const iconSize = size === "sm" ? 13 : 17;
  const iconColor = currentMeta ? currentMeta.color : "#64748b";
  const containerSize = size === "sm" ? 20 : 24;

  return (
    <View ref={buttonRef} className="h-full flex-1 items-stretch justify-center">
      <Pressable
        onPress={handlePress}
        onLongPress={handleLongPress}
        delayLongPress={350}
        className={`flex-1 flex-row items-center justify-center ${size === "sm" ? "px-1" : "px-2"}`}
      >
        <Animated.View
          style={[
            animatedStyle,
            {
              width: containerSize,
              height: containerSize,
              alignItems: "center",
              justifyContent: "center",
            },
          ]}
        >
          {currentMeta ? (
            <LottieView
              ref={lottieRef}
              source={currentMeta.lottie}
              autoPlay={true}
              loop={false}
              style={{ width: containerSize, height: containerSize }}
            />
          ) : (
            <ThumbsUp size={iconSize} color={iconColor} />
          )}
        </Animated.View>

        {showLabel && (
          <Text
            allowFontScaling={false}
            className={`ml-1.5 font-semibold ${size === "sm" ? "text-[12px]" : "text-[14px]"}`}
            style={{ color: currentMeta ? currentMeta.color : "#64748b" }}
          >
            {currentMeta ? currentMeta.label : "Thích"}
          </Text>
        )}
      </Pressable>

      <EmojiPicker
        isVisible={showPicker}
        onReact={handleReact}
        onClose={() => setShowPicker(false)}
        anchorY={anchorY}
        anchorX={anchorX}
      />
    </View>
  );
};
