const extractTextFromTiptapNode = (node: unknown): string[] => {
  if (node == null) return [];
  if (Array.isArray(node)) return node.flatMap(extractTextFromTiptapNode);
  if (typeof node !== "object") return [];

  const obj = node as Record<string, unknown>;
  if (obj.type === "text" && typeof obj.text === "string") return [obj.text];
  if (obj.type === "hardBreak") return ["\n"];
  if (obj.type === "paragraph") {
    const parts = "content" in obj ? extractTextFromTiptapNode(obj.content) : [];
    return [...parts, "\n"];
  }
  if (obj.type === "listItem") {
    const parts = "content" in obj ? extractTextFromTiptapNode(obj.content) : [];
    return ["• ", ...parts, "\n"];
  }
  if (obj.type === "bulletList" || obj.type === "orderedList") {
    const parts = "content" in obj ? extractTextFromTiptapNode(obj.content) : [];
    return [...parts, "\n"];
  }
  if ("content" in obj) return extractTextFromTiptapNode(obj.content);
  return [];
};

export const extractTextFromTiptapJson = (content: string): string => {
  try {
    const parsed = JSON.parse(content);
    const extracted = extractTextFromTiptapNode(parsed)
      .join("")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    return extracted ? extracted : content;
  } catch {
    return content;
  }
};
