import { Pressable, TextInput, View } from "react-native";
import { Search, XCircle } from "lucide-react-native";

import { useIconColors } from "@/hooks/useIconColors";

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  /** Callback khi nhấn clear (tùy chọn — mặc định clear text) */
  onClear?: () => void;
  autoFocus?: boolean;
}

/**
 * SearchBar — input tìm kiếm với:
 * - Icon kính lúp bên trái
 * - Clear button xuất hiện khi có text
 * - Bo tròn pill shape
 * - Placeholder muted color
 */
export const SearchBar = ({ value, onChangeText, placeholder = "Tìm kiếm...", onClear, autoFocus = false }: SearchBarProps) => {
  const { muted } = useIconColors();
  const handleClear = () => {
    onChangeText("");
    onClear?.();
  };

  return (
    <View className="flex-row items-center bg-muted rounded-full px-3 py-2 gap-2">
      {/* Search icon */}
      <Search size={18} color={muted} strokeWidth={1.5} />

      {/* Text input */}
      <TextInput
        className="flex-1 text-foreground text-sm"
        placeholder={placeholder}
        placeholderTextColor="hsl(215 16% 47%)"
        value={value}
        onChangeText={onChangeText}
        autoFocus={autoFocus}
        returnKeyType="search"
        clearButtonMode="never"
      />

      {/* Clear button — chỉ hiện khi có text */}
      {value.length > 0 ? (
        <Pressable onPress={handleClear} className="active:opacity-70" hitSlop={8}>
          <XCircle size={18} color={muted} strokeWidth={1.5} />
        </Pressable>
      ) : null}
    </View>
  );
};
