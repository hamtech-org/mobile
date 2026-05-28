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
    return extracted || content;
  } catch {
    // If JSON parsing fails (e.g. because it was truncated), try regex extraction
  }

  try {
    const textRegex = /"text"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
    let match;
    const texts: string[] = [];
    while ((match = textRegex.exec(content)) !== null) {
      try {
        texts.push(JSON.parse(`"${match[1]}"`));
      } catch {
        texts.push(match[1]);
      }
    }
    if (texts.length > 0) {
      return texts.join(" ").trim();
    }
  } catch {
    // Fall back to returning the original string
  }

  return content;
};
