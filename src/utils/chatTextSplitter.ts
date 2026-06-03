/**
 * Hàm phân tách chuỗi văn bản thành các đoạn nhỏ hơn giới hạn quy định,
 * ưu tiên cắt tại các ranh giới tự nhiên như dấu xuống dòng (\n),
 * dấu chấm câu (. , ? , ! ), hoặc khoảng trắng ( ) để tránh đứt mạch từ ngữ.
 *
 * @param content Nội dung tin nhắn cần phân tách
 * @param limit Giới hạn độ dài tối đa cho mỗi đoạn (mặc định 2000)
 */
export function splitMessageContent(content: string, limit: number = 2000): string[] {
  if (content.length <= limit) {
    return [content];
  }

  const chunks: string[] = [];
  let remaining = content;

  while (remaining.length > 0) {
    if (remaining.length <= limit) {
      chunks.push(remaining);
      break;
    }

    // Cố gắng tìm vị trí ngắt thích hợp trong phạm vi giới hạn
    let splitIndex = limit;
    const subStr = remaining.slice(0, limit);

    // 1. Tìm dấu xuống dòng (\n) trong 40% cuối của chunk
    const lastNewline = subStr.lastIndexOf("\n");
    if (lastNewline > limit * 0.6) {
      splitIndex = lastNewline + 1; // Cắt sau dấu xuống dòng để giữ \n ở chunk hiện tại
    } else {
      // 2. Tìm dấu chấm câu (. , ? , ! ) trong 30% cuối của chunk
      const lastSentenceBoundary = Math.max(
        subStr.lastIndexOf(". "),
        subStr.lastIndexOf("? "),
        subStr.lastIndexOf("! "),
      );
      if (lastSentenceBoundary > limit * 0.7) {
        splitIndex = lastSentenceBoundary + 2; // Cắt sau khoảng trắng của dấu chấm câu
      } else {
        // 3. Tìm khoảng trắng ( ) trong 20% cuối của chunk
        const lastSpace = subStr.lastIndexOf(" ");
        if (lastSpace > limit * 0.8) {
          splitIndex = lastSpace + 1;
        }
      }
    }

    const chunk = remaining.slice(0, splitIndex);
    chunks.push(chunk);
    remaining = remaining.slice(splitIndex);

    // Phòng ngừa vòng lặp vô hạn nếu splitIndex = 0 hoặc chunk rỗng
    if (chunk.length === 0) {
      chunks.push(remaining.slice(0, limit));
      remaining = remaining.slice(limit);
    }
  }

  return chunks;
}
