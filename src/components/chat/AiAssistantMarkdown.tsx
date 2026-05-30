import { Image } from "expo-image";
import { Linking, Text, useColorScheme, View } from "react-native";
import Markdown, {
  type ASTNode,
  type RenderImageFunction,
  type RenderLinkFunction,
} from "react-native-markdown-display";
import { isAiAssistantImageUrl, preprocessAiAssistantMarkdown } from "@/utils/aiAssistantMarkdown";

type AiAssistantMarkdownProps = {
  content: string;
  variant?: "assistant" | "user";
};

const markdownStyles = {
  body: { fontSize: 14, lineHeight: 20 },
  paragraph: { marginTop: 0, marginBottom: 8 },
  bullet_list: { marginBottom: 8 },
  ordered_list: { marginBottom: 8 },
  list_item: { marginBottom: 4 },
  strong: { fontWeight: "700" as const },
  link: { textDecorationLine: "underline" as const },
};

export function AiAssistantMarkdown({ content, variant = "assistant" }: AiAssistantMarkdownProps) {
  const prepared = preprocessAiAssistantMarkdown(content);
  const isDark = useColorScheme() === "dark";
  const textColor = variant === "user" ? "#ffffff" : isDark ? "#f8fafc" : "#0f172a";

  const renderAvatarImage = (node: ASTNode, uri: string) => (
    <View key={node.key} className="mt-1">
      <Image
        source={{ uri }}
        accessibilityLabel="Ảnh đại diện"
        style={{ width: 96, height: 96, borderRadius: 48 }}
        contentFit="cover"
      />
    </View>
  );

  const rules = {
    image: ((node) => {
      const uri = String(node.attributes?.src ?? "");
      if (!uri) return null;
      return renderAvatarImage(node, uri);
    }) as RenderImageFunction,
    link: ((node, children, _parent, _styles, onLinkPress) => {
      const href = String(node.attributes?.href ?? "");
      if (href && isAiAssistantImageUrl(href)) {
        return renderAvatarImage(node, href);
      }
      return (
        <Text
          key={node.key}
          style={{
            color: variant === "user" ? "#dbeafe" : "#2563eb",
            textDecorationLine: "underline",
          }}
          onPress={() => {
            if (!href) return;
            if (onLinkPress?.(href) === false) return;
            void Linking.openURL(href);
          }}
        >
          {children}
        </Text>
      );
    }) as RenderLinkFunction,
  };

  return (
    <Markdown
      style={{
        ...markdownStyles,
        body: { ...markdownStyles.body, color: textColor },
        text: { color: textColor },
        strong: { ...markdownStyles.strong, color: textColor },
      }}
      rules={rules}
    >
      {prepared}
    </Markdown>
  );
}
