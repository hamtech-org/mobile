import React from "react";
import { Image, Text, View } from "react-native";

type Props = { content: string };

type TiptapNode = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type?: string }[];
  content?: TiptapNode[];
};

const parseMaybeJson = (raw: string): TiptapNode => {
  const s = raw?.trim?.() ?? "";
  if (!s) return { type: "doc", content: [{ type: "paragraph" }] };
  try {
    const parsed = JSON.parse(s) as TiptapNode;
    if (parsed && parsed.type === "doc") return parsed;
  } catch {
    // ignore
  }

  return { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: s }] }] };
};

const renderInlineNode = (node: TiptapNode, key: string): React.ReactNode => {
  if (node.type === "text") {
    const isBold = node.marks?.some((mark) => mark.type === "bold");
    const isItalic = node.marks?.some((mark) => mark.type === "italic");
    const isStrike = node.marks?.some((mark) => mark.type === "strike");
    const isUnderline = node.marks?.some((mark) => mark.type === "underline");
    const isCode = node.marks?.some((mark) => mark.type === "code");
    const isHighlight = node.marks?.some((mark) => mark.type === "highlight");
    return (
      <Text
        key={key}
        className="text-sm leading-6 text-foreground"
        style={{
          fontWeight: isBold ? "700" : "400",
          fontStyle: isItalic ? "italic" : "normal",
          textDecorationLine:
            isStrike && isUnderline
              ? "underline line-through"
              : isStrike
                ? "line-through"
                : isUnderline
                  ? "underline"
                  : "none",
          fontFamily: isCode ? "monospace" : undefined,
          backgroundColor: isHighlight ? "rgba(250, 204, 21, 0.35)" : undefined,
        }}
      >
        {node.text ?? ""}
      </Text>
    );
  }

  if (node.type === "hardBreak") {
    return (
      <Text key={key} className="text-sm leading-6 text-foreground">
        {"\n"}
      </Text>
    );
  }

  return (node.content ?? []).map((child, index) => renderInlineNode(child, `${key}-${index}`));
};

const renderBlockNode = (
  node: TiptapNode,
  key: string,
  orderedListIndex?: number,
): React.ReactNode => {
  switch (node.type) {
    case "paragraph":
      return (
        <Text key={key} className="text-sm leading-6 text-foreground">
          {(node.content ?? []).map((child, index) => renderInlineNode(child, `${key}-${index}`))}
        </Text>
      );
    case "heading": {
      const level = Number(node.attrs?.level ?? 1);
      const className =
        level === 1
          ? "text-2xl font-bold text-foreground"
          : level === 2
            ? "text-xl font-bold text-foreground"
            : "text-lg font-bold text-foreground";
      return (
        <Text key={key} className={className}>
          {(node.content ?? []).map((child, index) => renderInlineNode(child, `${key}-${index}`))}
        </Text>
      );
    }
    case "bulletList":
      return (
        <View key={key} className="gap-2">
          {(node.content ?? []).map((child, index) => renderBlockNode(child, `${key}-${index}`))}
        </View>
      );
    case "orderedList":
      return (
        <View key={key} className="gap-2">
          {(node.content ?? []).map((child, index) =>
            renderBlockNode(child, `${key}-${index}`, index + 1),
          )}
        </View>
      );
    case "listItem":
      return (
        <View key={key} className="flex-row items-start gap-2">
          <Text className="text-sm leading-6 text-foreground">
            {orderedListIndex ? `${orderedListIndex}.` : "\u2022"}
          </Text>
          <View className="flex-1 gap-2">
            {(node.content ?? []).map((child, index) => renderBlockNode(child, `${key}-${index}`))}
          </View>
        </View>
      );
    case "image": {
      const src = typeof node.attrs?.src === "string" ? node.attrs.src : "";
      if (!src) return null;
      return (
        <Image
          key={key}
          source={{ uri: src }}
          className="h-56 w-full rounded-2xl"
          resizeMode="cover"
        />
      );
    }
    default:
      return (
        <View key={key} className="gap-2">
          {(node.content ?? []).map((child, index) => renderBlockNode(child, `${key}-${index}`))}
        </View>
      );
  }
};

export default function TentapPostReadOnly({ content }: Props) {
  const parsed = parseMaybeJson(content);
  return (
    <View className="gap-3">
      {(parsed.content ?? []).map((node, index) => renderBlockNode(node, `node-${index}`))}
    </View>
  );
}
