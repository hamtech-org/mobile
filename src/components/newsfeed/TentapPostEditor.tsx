import React, { useEffect, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import {
  RichText,
  TenTapStartKit,
  PlaceholderBridge,
  useEditorBridge,
} from "@10play/tentap-editor";

type Props = {
  value: string;
  onChange: (nextValue: string) => void;
  placeholderText?: string;
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
  return { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: s }] }] };
};

export default function TentapPostEditor({
  value,
  onChange,
  placeholderText = "Bạn đang nghĩ gì thế?",
}: Props) {
  const lastValueRef = useRef<string>(value);
  const lastRequestedRef = useRef<string>("");

  const styles = useMemo(
    () =>
      StyleSheet.create({
        editorContainer: { minHeight: 150 },
      }),
    [],
  );

  const bridgeExtensions = useMemo(() => {
    return TenTapStartKit.map((ext) =>
      ext.name === "placeholder" ? ext.configureExtension({ placeholder: placeholderText }) : ext,
    );
  }, [placeholderText]);

  const editor = useEditorBridge({
    bridgeExtensions,
    editable: true,
    autofocus: false,
    avoidIosKeyboard: true,
    dynamicHeight: true,
    initialContent: parseMaybeJson(value),
    onChange: () => {
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

  return (
    <View style={styles.editorContainer}>
      <RichText editor={editor} />
    </View>
  );
}
