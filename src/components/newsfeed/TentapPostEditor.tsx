import React, { useEffect, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Pressable, StyleSheet, Text, View } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { RichText, useEditorBridge } from "@10play/tentap-editor";
import { Bold, Image as ImageIcon, Italic, Strikethrough } from "lucide-react-native";

type Props = {
  value: string; // Tiptap JSON string (stored in backend)
  onChange: (nextValue: string) => void; // JSON string
  onRequestImageUpload: () => Promise<string>; // returns image URL
};

const parseMaybeJson = (raw: string): any => {
  const s = raw?.trim?.() ?? "";
  if (!s) return { type: "doc", content: [{ type: "paragraph" }] };
  try {
    const parsed = JSON.parse(s) as any;
    if (parsed && parsed.type === "doc") return parsed;
  } catch {
    // ignore
  }

  // fallback: treat as plain text
  return { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: s }] }] };
};

export default function TentapPostEditor({ value, onChange, onRequestImageUpload }: Props) {
  const lastValueRef = useRef<string>(value);
  const lastRequestedRef = useRef<string>("");
  const [formatValue, setFormatValue] = useState<"paragraph" | "h1" | "h2" | "h3">("paragraph");
  const [listValue, setListValue] = useState<"none" | "bullet" | "ordered">("none");

  const exampleStyles = useMemo(
    () =>
      StyleSheet.create({
        fullScreen: { flex: 1 },
        keyboardAvoidingView: {
          position: "absolute",
          width: "100%",
          bottom: 0,
        },
      }),
    [],
  );

  const editor = useEditorBridge({
    editable: true,
    autofocus: false,
    avoidIosKeyboard: true,
    dynamicHeight: true,
    initialContent: parseMaybeJson(value),
    onChange: () => {
      // debounce by delaying getJSON requests from WebView
      clearTimeout((editor as any).__onChangeTimer);
      (editor as any).__onChangeTimer = setTimeout(async () => {
        if (!editor) return;
        const json = await editor.getJSON();
        const next = JSON.stringify(json);
        if (next !== lastValueRef.current && next !== lastRequestedRef.current) {
          lastValueRef.current = next;
          lastRequestedRef.current = next;
          onChange(next);
        }
      }, 250);
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (value === lastValueRef.current) return;
    editor.setContent(parseMaybeJson(value));
    lastValueRef.current = value;
  }, [value, editor]);

  const insertImage = async () => {
    const url = await onRequestImageUpload();
    if (!url) return;
    editor.setImage(url);
  };

  const applyFormat = (next: "paragraph" | "h1" | "h2" | "h3") => {
    if (!editor) return;
    setFormatValue(next);
    if (next === "paragraph") {
      const st = editor.getEditorState() as any;
      const currentLevel = st?.headingLevel as number | undefined;
      if (typeof currentLevel === "number") editor.toggleHeading(currentLevel as any);
      return;
    }
    const level = next === "h1" ? 1 : next === "h2" ? 2 : 3;
    editor.toggleHeading(level as any);
  };

  const applyList = (next: "none" | "bullet" | "ordered") => {
    if (!editor) return;
    setListValue(next);
    if (next === "none") {
      const st = editor.getEditorState() as any;
      if (st?.isBulletListActive) editor.toggleBulletList();
      if (st?.isOrderedListActive) editor.toggleOrderedList();
      return;
    }
    if (next === "bullet") {
      editor.toggleBulletList();
      return;
    }
    editor.toggleOrderedList();
  };

  return (
    <View style={exampleStyles.fullScreen}>
      <RichText editor={editor} />
      <KeyboardAvoidingView behavior="padding" style={exampleStyles.keyboardAvoidingView}>
        <View className="px-3 pb-2 pt-2">
          <View className="flex-row items-center justify-between gap-2">
            <Pressable
              className="size-11 items-center justify-center rounded-2xl bg-muted/30"
              onPress={() => editor?.toggleBold()}
            >
              <Bold size={20} />
            </Pressable>
            <Pressable
              className="size-11 items-center justify-center rounded-2xl bg-muted/30"
              onPress={() => editor?.toggleItalic()}
            >
              <Italic size={20} />
            </Pressable>
            <Pressable
              className="size-11 items-center justify-center rounded-2xl bg-muted/30"
              onPress={() => editor?.toggleStrike()}
            >
              <Strikethrough size={20} />
            </Pressable>
            <Pressable
              className="size-11 items-center justify-center rounded-2xl bg-blue-600"
              onPress={() => void insertImage()}
            >
              <ImageIcon size={20} color="#fff" />
            </Pressable>
          </View>

          <View className="mt-2 gap-2">
            <View className="gap-1.5">
              <Text className="font-bold">Định dạng</Text>
              <View className="overflow-hidden rounded-2xl border border-border/40">
                <Picker selectedValue={formatValue} onValueChange={(v) => applyFormat(v as any)}>
                  <Picker.Item label="Đoạn" value="paragraph" />
                  <Picker.Item label="Tiêu đề 1" value="h1" />
                  <Picker.Item label="Tiêu đề 2" value="h2" />
                  <Picker.Item label="Tiêu đề 3" value="h3" />
                </Picker>
              </View>
            </View>

            <View className="gap-1.5">
              <Text className="font-bold">Danh sách</Text>
              <View className="overflow-hidden rounded-2xl border border-border/40">
                <Picker selectedValue={listValue} onValueChange={(v) => applyList(v as any)}>
                  <Picker.Item label="Không" value="none" />
                  <Picker.Item label="Gạch đầu dòng" value="bullet" />
                  <Picker.Item label="Đánh số" value="ordered" />
                </Picker>
              </View>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
