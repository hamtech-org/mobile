import { Image, Text, View } from "react-native";

import { normalizeMediaUrl } from "@/utils/url";

// Kích thước avatar — map sang NativeWind size classes
type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

interface AvatarProps {
  /** URI ảnh từ S3/CDN */
  uri?: string | null;
  /** Tên hiển thị — dùng để fallback chữ cái đầu */
  name?: string;
  size?: AvatarSize;
  /** Hiển thị chấm online màu xanh */
  showOnlineDot?: boolean;
  /** Chế độ group: hiển thị chữ G thay vì ký tự đầu */
  isGroup?: boolean;
}

const SIZE_CLASS: Record<AvatarSize, string> = {
  xs: "size-6",
  sm: "size-8",
  md: "size-10",
  lg: "size-14",
  xl: "size-24",
};

const TEXT_CLASS: Record<AvatarSize, string> = {
  xs: "text-[10px]",
  sm: "text-xs",
  md: "text-sm",
  lg: "text-xl",
  xl: "text-3xl",
};

const DOT_CLASS: Record<AvatarSize, string> = {
  xs: "size-1.5 -bottom-0 -right-0",
  sm: "size-2 bottom-0 right-0",
  md: "size-2.5 bottom-0 right-0",
  lg: "size-3.5 bottom-0.5 right-0.5",
  xl: "size-5 bottom-1 right-1",
};

/**
 * Lấy 1-2 ký tự đầu từ tên để hiển thị fallback
 */
function getInitials(name?: string, isGroup?: boolean): string {
  if (isGroup) return "G";
  if (!name) return "?";
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].charAt(0).toUpperCase();
  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
}

/**
 * Avatar component — hỗ trợ:
 * - Ảnh từ URI (S3/CDN)
 * - Fallback chữ cái đầu với bg primary accent
 * - Online dot indicator
 * - Group mode (icon G)
 */
export const Avatar = ({
  uri,
  name,
  size = "md",
  showOnlineDot = false,
  isGroup = false,
}: AvatarProps) => {
  const sizeClass = SIZE_CLASS[size];
  const textClass = TEXT_CLASS[size];
  const dotClass = DOT_CLASS[size];
  const initials = getInitials(name, isGroup);
  const imageUri = uri ? normalizeMediaUrl(uri) : undefined;

  return (
    <View className="relative">
      {imageUri ? (
        <Image
          source={{ uri: imageUri }}
          className={`${sizeClass} rounded-full bg-muted`}
          resizeMode="cover"
        />
      ) : (
        <View
          className={`${sizeClass} rounded-full bg-primary/20 items-center justify-center`}
        >
          <Text className={`${textClass} font-semibold text-primary`}>
            {initials}
          </Text>
        </View>
      )}

      {/* Online dot indicator */}
      {showOnlineDot && (
        <View
          className={`absolute ${dotClass} bg-green-500 rounded-full border-2 border-background`}
        />
      )}
    </View>
  );
};
