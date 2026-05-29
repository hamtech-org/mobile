import {
  useCallback,
  useEffect,
  useState,
  useRef,
  useMemo,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { escapeMentionLabel } from "@/utils/mentionHelper";
import {
  BarChart2,
  CheckSquare,
  ClipboardPaste,
  Image as ImageIcon,
  Mic,
  Paperclip,
  SendHorizontal,
  Smile,
  Sparkles,
  ThumbsUp,
  X,
} from "lucide-react-native";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import EmojiPicker, { EmojiType } from "rn-emoji-keyboard";
import { Audio } from "expo-av";

import { AiQuickRepliesMobile } from "@/components/chat/AiQuickRepliesMobile";
import {
  ChatPendingAttachmentsStrip,
  type PendingAttachment,
} from "@/components/chat/ChatPendingAttachmentsStrip";
import {
  CHAT_DOCUMENT_MIME_TYPES,
  MAX_PENDING_FILES,
  roughMaxBytesForMime,
} from "@/constants/chat-page.constants";
import { useIconColors } from "@/hooks/useIconColors";
import { apiClient } from "@/services/api";
import { pendingAttachmentFromImagePickerAsset } from "@/utils/chatMediaMime";
import {
  isClipboardPasteButtonAvailable,
  pendingAttachmentFromClipboardImageData,
  readPastedImageFromClipboard,
} from "@/utils/chatMediaDownload";
import { toast } from "@/utils/appToast";
import type { IMessage } from "@/types/chat.types";
import { formatChatPreviewLine } from "@/utils/messageDisplay";

export type { PendingAttachment };

type VoiceUiState = "idle" | "active-ui" | "cancelled-ui";

interface ChatInputProps {
  onSend: (content: string, mentions?: string[]) => void | Promise<void>;
  onSendMedia?: (attachments: PendingAttachment[], caption: string) => void | Promise<void>;
  onSendVoice?: (uri: string, duration: number) => void | Promise<void>;
  replyingTo?: IMessage | null;
  currentUserId?: string;
  onClearReply?: () => void;
  onTyping?: () => void;
  activeConversationId?: string | null;
  conversationName?: string;
  isGroup?: boolean;
  onOpenPoll?: () => void;
  onOpenTask?: () => void;
  onOpenAiSummary?: () => void;
  groupMembers?: {
    userId: string;
    displayName: string | null;
    avatar?: string | null;
    name?: string | null;
  }[];
}

/**
 * Ô nhập chat — layout khớp web `ChatComposer.tsx`:
 * toolbar → gợi ý AI → preview tệp (tối đa 10) → ô soạn + gửi.
 */
export const ChatInput = ({
  onSend,
  onSendMedia,
  onSendVoice,
  replyingTo,
  currentUserId = "",
  onClearReply,
  onTyping,
  activeConversationId = null,
  conversationName,
  isGroup = false,
  onOpenPoll,
  onOpenTask,
  onOpenAiSummary,
  groupMembers = [],
}: ChatInputProps) => {
  const [content, setContent] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [showAiQuickReplies, setShowAiQuickReplies] = useState(true);
  const [aiReplyLoading, setAiReplyLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const { muted, primary, foreground } = useIconColors();

  // Mentions autocomplete states
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionSearchTerm, setMentionSearchTerm] = useState("");
  const [mentionTriggerIndex, setMentionTriggerIndex] = useState(-1);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [mentionsMetadata, setMentionsMetadata] = useState<
    { userId: string; displayName: string }[]
  >([]);

  const textInputRef = useRef<TextInput>(null);

  // Filtered mention list
  const filteredMentionMembers = useMemo(() => {
    if (!showMentionDropdown || !isGroup) return [];

    const list = groupMembers.filter((m) => {
      if (m.userId === currentUserId) return false; // Không tự tag chính mình
      const nameLower = (m.displayName || m.name || "").toLowerCase();
      return nameLower.includes(mentionSearchTerm.toLowerCase());
    });

    const showAll =
      "cả nhóm".includes(mentionSearchTerm.toLowerCase()) ||
      "all".includes(mentionSearchTerm.toLowerCase()) ||
      mentionSearchTerm === "";

    if (showAll) {
      return [
        { userId: "all", displayName: "Cả nhóm", name: "Cả nhóm (@All)", avatar: "" },
        ...list,
      ];
    }
    return list;
  }, [showMentionDropdown, isGroup, groupMembers, mentionSearchTerm, currentUserId]);

  useEffect(() => {
    if (showMentionDropdown && filteredMentionMembers.length === 0) {
      setShowMentionDropdown(false);
    }
  }, [showMentionDropdown, filteredMentionMembers]);

  const handleSelectMention = useCallback(
    (member: { userId: string; displayName?: string | null; name?: string | null }) => {
      if (mentionTriggerIndex === -1) return;
      const name = member.displayName || member.name || "Thành viên";
      const escapedName = escapeMentionLabel(name);

      // Thêm thông tin tag vào metadata local để đổi sang markdown khi bấm gửi
      setMentionsMetadata((prev) => [...prev, { userId: member.userId, displayName: escapedName }]);

      const tag = `@${escapedName} `;

      const beforeAt = content.slice(0, mentionTriggerIndex);
      const afterCursor = content.slice(mentionTriggerIndex + mentionSearchTerm.length + 1);

      const newText = beforeAt + tag + afterCursor;
      setContent(newText);
      setShowMentionDropdown(false);
      onTyping?.();

      setTimeout(() => {
        textInputRef.current?.focus();
      }, 50);
    },
    [content, mentionTriggerIndex, mentionSearchTerm, onTyping],
  );
  const placeholder = conversationName ? `Nhập tin nhắn đến ${conversationName}` : "Nhập tin nhắn";
  const hasText = content.trim().length > 0;
  const hasSendable = hasText || pendingAttachments.length > 0;
  const inputDisabled = !activeConversationId || isUploading;

  // ─── Logic ghi âm Voice (expo-av) ───
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== "granted") {
        toast.error("Cần quyền truy cập microphone để ghi âm.");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );

      setRecording(newRecording);
      setIsRecording(true);
      setRecordingDuration(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => {
          if (prev >= 300) {
            // 5 phút
            void stopRecording(true);
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      console.error("Lỗi bắt đầu ghi âm:", err);
      toast.error("Không thể khởi động ghi âm.");
    }
  };

  const stopRecording = async (shouldSend: boolean) => {
    if (!recording) return;

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    setIsRecording(false);
    setRecording(null);

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      const durationAtStop = recordingDuration;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      if (shouldSend && uri) {
        if (durationAtStop < 1) {
          toast.warning("Tin nhắn thoại quá ngắn.");
          return;
        }
        setIsUploading(true);
        try {
          if (onSendVoice) {
            await onSendVoice(uri, durationAtStop);
          }
        } catch (err) {
          console.error("Gửi voice tin thất bại:", err);
        } finally {
          setIsUploading(false);
        }
      }
    } catch (err) {
      console.error("Lỗi dừng ghi âm:", err);
    }
  };

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setPendingAttachments([]);
  }, [activeConversationId]);

  const handleEmojiSelected = (emojiObject: EmojiType) => {
    setContent((prev) => prev + emojiObject.emoji);
    onTyping?.();
  };

  const removePendingAttachment = useCallback((localId: string) => {
    setPendingAttachments((prev) => prev.filter((p) => p.localId !== localId));
  }, []);

  const addPendingAttachments = useCallback((incoming: PendingAttachment[]) => {
    if (incoming.length === 0) return;
    setPendingAttachments((prev) => {
      if (prev.length >= MAX_PENDING_FILES) {
        toast.warning(`Tối đa ${MAX_PENDING_FILES} tệp mỗi lần gửi.`);
        return prev;
      }
      const next = [...prev];
      let oversizedSkipped = 0;
      let overLimitSkipped = 0;
      for (const item of incoming) {
        if (next.length >= MAX_PENDING_FILES) {
          overLimitSkipped += 1;
          continue;
        }
        const size = item.size;
        if (size != null && size > 0 && size > roughMaxBytesForMime(item.mimeType)) {
          oversizedSkipped += 1;
          continue;
        }
        next.push({
          ...item,
          localId: item.localId || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        });
      }
      if (oversizedSkipped > 0) {
        toast.warning(`${oversizedSkipped} tệp vượt dung lượng đã bị bỏ qua.`);
      }
      if (overLimitSkipped > 0) {
        toast.info(`${overLimitSkipped} tệp vượt quá giới hạn ${MAX_PENDING_FILES}.`);
      }
      return next;
    });
  }, []);

  const handleSend = useCallback(async () => {
    if (isUploading) return;

    if (pendingAttachments.length > 0) {
      if (!onSendMedia) {
        toast.error("Không thể gửi file trong hội thoại này.");
        return;
      }
      const batch = pendingAttachments;
      const cap = content.trim();

      // Chuyển đổi caption thô sang dạng markdown tag
      let processedCaption = cap;
      const sortedMetadata = [...mentionsMetadata].sort(
        (a, b) => b.displayName.length - a.displayName.length,
      );
      for (const item of sortedMetadata) {
        const escapedNameForRegex = item.displayName.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
        const regex = new RegExp(`@${escapedNameForRegex}`, "g");
        const replacement =
          item.userId === "all"
            ? `@[Cả nhóm](mention:all)`
            : `@[${item.displayName}](mention:${item.userId})`;
        processedCaption = processedCaption.replace(regex, replacement);
      }

      setIsUploading(true);
      try {
        await onSendMedia(batch, processedCaption);
        setPendingAttachments([]);
        setContent("");
        setMentionsMetadata([]);
      } catch {
        /* toast trong handleSendMedia */
      } finally {
        setIsUploading(false);
      }
      return;
    }

    const text = content.trim();
    if (!text) return;
    setContent("");

    // Chuyển đổi nội dung thô hiển thị sang định dạng markdown chứa userId
    let processedText = text;
    const sortedMetadata = [...mentionsMetadata].sort(
      (a, b) => b.displayName.length - a.displayName.length,
    );
    for (const item of sortedMetadata) {
      const escapedNameForRegex = item.displayName.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
      const regex = new RegExp(`@${escapedNameForRegex}`, "g");
      const replacement =
        item.userId === "all"
          ? `@[Cả nhóm](mention:all)`
          : `@[${item.displayName}](mention:${item.userId})`;
      processedText = processedText.replace(regex, replacement);
    }

    // Trích xuất danh sách userId từ markdown tag nhắc tên
    const mentionsRegex = /@\[.*?\]\(mention:([a-zA-Z0-9-]+|all)\)/g;
    const mentions: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = mentionsRegex.exec(processedText)) !== null) {
      mentions.push(match[1]);
    }
    const uniqueMentions = Array.from(new Set(mentions));

    setMentionsMetadata([]);

    try {
      await Promise.resolve(onSend(processedText, uniqueMentions));
    } catch {
      setContent(text);
    }
  }, [content, pendingAttachments, onSend, onSendMedia, isUploading, mentionsMetadata]);

  const pickImage = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        toast.error("Cần quyền truy cập thư viện ảnh để gửi media.");
        return;
      }
      const remaining = MAX_PENDING_FILES - pendingAttachments.length;
      if (remaining <= 0) {
        toast.warning(`Tối đa ${MAX_PENDING_FILES} tệp mỗi lần gửi.`);
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images", "videos"],
        quality: 0.8,
        allowsMultipleSelection: true,
        selectionLimit: remaining,
      });
      if (result.canceled || !result.assets.length) return;
      const mapped = result.assets.map((asset) => {
        const picked = pendingAttachmentFromImagePickerAsset(asset);
        return {
          localId: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          ...picked,
        };
      });
      addPendingAttachments(mapped);
    } catch {
      toast.error("Không mở được thư viện ảnh.");
    }
  }, [pendingAttachments.length, addPendingAttachments]);

  const applyPastedAttachment = useCallback(
    (pasted: Omit<PendingAttachment, "localId">) => {
      addPendingAttachments([
        {
          localId: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          uri: pasted.uri,
          name: pasted.name,
          mimeType: pasted.mimeType,
          size: pasted.size,
        },
      ]);
      toast.success("Đã dán ảnh");
    },
    [addPendingAttachments],
  );

  const pasteImageFromClipboard = useCallback(async () => {
    if (inputDisabled) return;
    try {
      const pasted = await readPastedImageFromClipboard();
      if (!pasted) {
        toast.info("Không có ảnh trong bộ nhớ tạm. Hãy copy ảnh trước (giữ tin → Copy hình ảnh).");
        return;
      }
      applyPastedAttachment(pasted);
    } catch {
      toast.error("Không dán được ảnh.");
    }
  }, [inputDisabled, applyPastedAttachment]);

  const onNativePastePressed = useCallback(
    async (data: { type: string; data?: string }) => {
      if (inputDisabled || data.type !== "image" || !data.data) return;
      try {
        const pasted = await pendingAttachmentFromClipboardImageData(data.data);
        if (!pasted) {
          toast.error("Không dán được ảnh.");
          return;
        }
        applyPastedAttachment(pasted);
      } catch {
        toast.error("Không dán được ảnh.");
      }
    },
    [inputDisabled, applyPastedAttachment],
  );

  const pickFile = useCallback(async () => {
    try {
      const remaining = MAX_PENDING_FILES - pendingAttachments.length;
      if (remaining <= 0) {
        toast.warning(`Tối đa ${MAX_PENDING_FILES} tệp mỗi lần gửi.`);
        return;
      }
      const result = await DocumentPicker.getDocumentAsync({
        type: CHAT_DOCUMENT_MIME_TYPES,
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const mapped = result.assets.slice(0, remaining).map((asset) => ({
        localId: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType ?? "application/octet-stream",
        size: asset.size ?? undefined,
      }));
      addPendingAttachments(mapped);
    } catch {
      toast.error("Không chọn được file.");
    }
  }, [pendingAttachments.length, addPendingAttachments]);

  const handleTextChange = useCallback(
    (text: string) => {
      setContent(text);
      onTyping?.();

      if (!isGroup) {
        setShowMentionDropdown(false);
        return;
      }

      // Detect `@` tag trigger using cursor position (with robust fallback for initial typing)
      const cursorIndex = selection.start === 0 && text.length > 0 ? text.length : selection.start;
      const textBeforeCursor = text.slice(0, cursorIndex);
      const lastAtIndex = textBeforeCursor.lastIndexOf("@");

      if (lastAtIndex !== -1) {
        const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
        // Only trigger if no space exists in the search term
        if (!/\s/.test(textAfterAt)) {
          setShowMentionDropdown(true);
          setMentionTriggerIndex(lastAtIndex);
          setMentionSearchTerm(textAfterAt);
        } else {
          setShowMentionDropdown(false);
        }
      } else {
        setShowMentionDropdown(false);
      }
    },
    [onTyping, isGroup, selection],
  );

  const handleVoiceUiClick = () => {
    if (inputDisabled) return;
    if (isRecording) {
      void stopRecording(false);
    } else {
      void startRecording();
    }
  };

  const handleAiReplySuggest = async () => {
    if (!activeConversationId || !currentUserId || !replyingTo) return;
    if (replyingTo.isRecalled) {
      toast.info("Tin nhắn đã thu hồi, không thể gợi ý trả lời.");
      return;
    }
    setAiReplyLoading(true);
    try {
      const res = await apiClient.post<{
        success: boolean;
        data: { suggestions: string[] };
      }>("/ai/suggest-reply-context", {
        conversationId: activeConversationId,
        meUserId: currentUserId,
        theirUserId: replyingTo.senderId,
        anchorMessageId: replyingTo.messageId,
      });
      const first = (res.data?.data?.suggestions ?? [])[0]?.trim();
      if (!first) {
        toast.info("AI chưa trả về gợi ý phù hợp.");
        return;
      }
      setContent(first);
    } catch {
      toast.error("Gợi ý trả lời thất bại. Vui lòng thử lại.");
    } finally {
      setAiReplyLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      {replyingTo ? (
        <View style={styles.replyBar}>
          <View style={styles.replyBarText}>
            <Text style={[styles.replyTitle, { color: primary }]} numberOfLines={1}>
              Đang trả lời {replyingTo.senderDisplayName ?? replyingTo.senderId}
            </Text>
            <Text style={[styles.replyPreview, { color: muted }]} numberOfLines={2}>
              {replyingTo.isRecalled
                ? "Tin nhắn đã được thu hồi"
                : formatChatPreviewLine(replyingTo, currentUserId)}
            </Text>
          </View>
          <Pressable
            onPress={() => void handleAiReplySuggest()}
            disabled={!activeConversationId || aiReplyLoading || Boolean(replyingTo.isRecalled)}
            style={styles.iconBtn}
            accessibilityLabel="AI gợi ý câu trả lời"
          >
            {aiReplyLoading ? (
              <ActivityIndicator size="small" color={primary} />
            ) : (
              <Sparkles size={16} color={primary} strokeWidth={2} />
            )}
          </Pressable>
          <Pressable
            onPress={onClearReply}
            style={styles.iconBtn}
            hitSlop={8}
            accessibilityLabel="Hủy trả lời"
          >
            <X size={16} color={muted} strokeWidth={2} />
          </Pressable>
        </View>
      ) : null}

      {pendingAttachments.length > 0 ? (
        <ChatPendingAttachmentsStrip
          attachments={pendingAttachments}
          onRemove={removePendingAttachment}
          removeDisabled={isUploading}
        />
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.toolbarScroll}
        contentContainerStyle={styles.toolbarContent}
      >
        <ToolbarIcon
          onPress={() => setIsEmojiPickerOpen(true)}
          accessibilityLabel="Emoji"
          disabled={inputDisabled}
        >
          <Smile size={20} color={muted} strokeWidth={2} />
        </ToolbarIcon>
        <ToolbarIcon
          onPress={() => void pickImage()}
          accessibilityLabel="Thêm ảnh hoặc video"
          disabled={inputDisabled}
        >
          <ImageIcon size={20} color={muted} strokeWidth={2} />
        </ToolbarIcon>
        {isClipboardPasteButtonAvailable && !inputDisabled ? (
          <View style={styles.nativePasteWrap} accessibilityLabel="Dán ảnh từ bộ nhớ tạm">
            <Clipboard.ClipboardPasteButton
              style={styles.nativePasteButton}
              displayMode="iconOnly"
              acceptedContentTypes={["image"]}
              onPress={(data) => void onNativePastePressed(data)}
            />
          </View>
        ) : (
          <ToolbarIcon
            onPress={() => void pasteImageFromClipboard()}
            accessibilityLabel="Dán ảnh từ bộ nhớ tạm"
            disabled={inputDisabled}
          >
            <ClipboardPaste size={20} color={muted} strokeWidth={2} />
          </ToolbarIcon>
        )}
        <ToolbarIcon
          onPress={() => void pickFile()}
          accessibilityLabel="Thêm tệp tài liệu"
          disabled={inputDisabled}
        >
          <Paperclip size={20} color={muted} strokeWidth={2} />
        </ToolbarIcon>
        <ToolbarIcon
          onPress={handleVoiceUiClick}
          accessibilityLabel="Voice recording"
          disabled={inputDisabled}
          active={isRecording}
        >
          <Mic size={20} color={isRecording ? "#ef4444" : muted} strokeWidth={2} />
        </ToolbarIcon>

        <View style={styles.toolbarDivider} />

        <ToolbarIcon
          onPress={() => setShowAiQuickReplies((p) => !p)}
          accessibilityLabel={showAiQuickReplies ? "Tắt gợi ý AI" : "Bật gợi ý AI"}
          disabled={inputDisabled}
          active={showAiQuickReplies}
        >
          <Sparkles size={20} color={showAiQuickReplies ? primary : muted} strokeWidth={2} />
        </ToolbarIcon>

        {isGroup && onOpenPoll ? (
          <ToolbarIcon onPress={onOpenPoll} accessibilityLabel="Tạo bình chọn">
            <BarChart2 size={20} color={muted} strokeWidth={2} />
          </ToolbarIcon>
        ) : null}
        {isGroup && onOpenTask ? (
          <ToolbarIcon onPress={onOpenTask} accessibilityLabel="Giao việc hoặc nhắc hẹn">
            <CheckSquare size={20} color={muted} strokeWidth={2} />
          </ToolbarIcon>
        ) : null}
        {isGroup && onOpenAiSummary ? (
          <Pressable
            onPress={onOpenAiSummary}
            disabled={inputDisabled}
            style={[styles.summaryBtn, inputDisabled && styles.disabled]}
            accessibilityLabel="Tóm tắt tin nhắn"
          >
            <Sparkles size={16} color={primary} strokeWidth={2} />
            <Text style={[styles.summaryBtnText, { color: primary }]}>Tóm tắt Tin nhắn</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      {showAiQuickReplies ? (
        <View style={styles.aiBlock}>
          <AiQuickRepliesMobile
            activeConversationId={activeConversationId}
            inputText={content}
            onPickReply={(text) => {
              setContent(text);
              onTyping?.();
            }}
          />
        </View>
      ) : null}

      <View style={styles.composeWrapper}>
        {showMentionDropdown && filteredMentionMembers.length > 0 ? (
          <View style={styles.mentionDropdown}>
            <ScrollView
              horizontal={false}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
              style={styles.mentionScroll}
              contentContainerStyle={styles.mentionScrollContent}
            >
              {filteredMentionMembers.map((member) => (
                <Pressable
                  key={member.userId}
                  onPress={() => handleSelectMention(member)}
                  style={({ pressed }) => [
                    styles.mentionItem,
                    pressed && styles.mentionItemPressed,
                  ]}
                >
                  <View style={styles.mentionRowContent}>
                    {member.userId === "all" ? (
                      <View style={styles.mentionAvatarAll}>
                        <Text style={styles.mentionAvatarAllText}>@</Text>
                      </View>
                    ) : member.avatar ? (
                      <Image source={{ uri: member.avatar }} style={styles.mentionAvatar} />
                    ) : (
                      <View style={styles.mentionAvatarFallback}>
                        <Text style={styles.mentionAvatarFallbackText}>
                          {(member.displayName || member.name || "U").slice(0, 1).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.mentionName} numberOfLines={1}>
                      {member.userId === "all"
                        ? "Cả nhóm"
                        : member.displayName || member.name || "Thành viên"}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {isRecording ? (
          <View style={styles.recordRow}>
            <View style={styles.recordLeft}>
              <View style={styles.recordDot} />
              <Text style={styles.recordText}>ĐANG GHI ÂM...</Text>
            </View>
            <Text style={styles.recordTimer}>
              {Math.floor(recordingDuration / 60)}:
              {(recordingDuration % 60).toString().padStart(2, "0")}
            </Text>
            <View style={styles.recordRight}>
              <Pressable
                onPress={() => void stopRecording(false)}
                style={styles.recordBtnCancel}
                accessibilityLabel="Hủy ghi âm"
              >
                <X size={18} color="#ef4444" strokeWidth={2.5} />
              </Pressable>
              <Pressable
                onPress={() => void stopRecording(true)}
                style={[styles.recordBtnSend, { backgroundColor: primary }]}
                accessibilityLabel="Gửi tin nhắn thoại"
              >
                <SendHorizontal size={18} color="#fff" strokeWidth={2} />
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.composeRow}>
            <View style={styles.inputBox}>
              <TextInput
                ref={textInputRef}
                placeholder={placeholder}
                placeholderTextColor={muted}
                value={content}
                onChangeText={handleTextChange}
                onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
                multiline
                editable={!inputDisabled}
                style={styles.textInput}
              />
            </View>
            {hasSendable ? (
              <Pressable
                onPress={() => void handleSend()}
                disabled={inputDisabled}
                style={[
                  styles.sendBtn,
                  { backgroundColor: primary },
                  inputDisabled && styles.disabled,
                ]}
                accessibilityLabel="Gửi tin nhắn"
              >
                {isUploading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <SendHorizontal size={20} color="#fff" strokeWidth={2} />
                )}
              </Pressable>
            ) : (
              <Pressable
                onPress={() => void Promise.resolve(onSend("👍")).catch(() => {})}
                disabled={inputDisabled}
                style={[styles.likeBtn, inputDisabled && styles.disabled]}
                accessibilityLabel="Gửi like"
              >
                <ThumbsUp size={20} color={primary} strokeWidth={2} />
              </Pressable>
            )}
          </View>
        )}
      </View>

      {isEmojiPickerOpen ? (
        <EmojiPicker
          open
          onClose={() => setIsEmojiPickerOpen(false)}
          onEmojiSelected={handleEmojiSelected}
          theme={{
            backdrop: "#00000088",
            knob: primary,
            container: "#1e1e1e",
            header: foreground,
            skinTonesContainer: "#252427",
            category: {
              icon: muted,
              iconActive: primary,
              container: "#252427",
              containerActive: "#333333",
            },
          }}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  composeWrapper: {
    position: "relative",
  },
  mentionDropdown: {
    position: "absolute",
    bottom: "100%",
    left: 0,
    right: 0,
    zIndex: 999,
    maxHeight: 200,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  mentionScroll: {
    flexGrow: 0,
  },
  mentionScrollContent: {
    paddingVertical: 4,
  },
  mentionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.03)",
  },
  mentionItemPressed: {
    opacity: 0.6,
    backgroundColor: "rgba(0,0,0,0.02)",
  },
  mentionRowContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  mentionAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  mentionAvatarAll: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(249, 115, 22, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  mentionAvatarAllText: {
    color: "#f97316",
    fontSize: 15,
    fontWeight: "bold",
  },
  mentionAvatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(59, 130, 246, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  mentionAvatarFallbackText: {
    color: "#3b82f6",
    fontSize: 13,
    fontWeight: "bold",
  },
  mentionName: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 12,
    flex: 1,
    textAlign: "left",
  },
  root: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.08)",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
  },
  replyBar: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#0068FF",
    backgroundColor: "rgba(0,0,0,0.04)",
  },
  replyBarText: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  replyTitle: {
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 2,
  },
  replyPreview: {
    fontSize: 12,
  },
  iconBtn: {
    padding: 6,
    marginLeft: 4,
  },
  toolbarScroll: {
    marginBottom: 12,
    flexGrow: 0,
  },
  toolbarContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 8,
  },
  nativePasteWrap: {
    marginRight: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  nativePasteButton: {
    width: 36,
    height: 36,
  },
  toolbarDivider: {
    width: 1,
    height: 20,
    backgroundColor: "rgba(0,0,0,0.12)",
    marginHorizontal: 4,
  },
  summaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 4,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(0,104,255,0.2)",
    backgroundColor: "rgba(0,104,255,0.05)",
  },
  summaryBtnText: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: "700",
  },
  aiBlock: {
    marginBottom: 12,
  },
  composeRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  recordRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(239, 68, 68, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.2)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    height: 44,
    gap: 8,
  },
  recordLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  recordDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ef4444",
  },
  recordText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#ef4444",
    letterSpacing: 0.5,
  },
  recordTimer: {
    fontSize: 14,
    fontWeight: "700",
    color: "#050505",
    flex: 1,
    textAlign: "center",
  },
  recordRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  recordBtnCancel: {
    padding: 6,
  },
  recordBtnSend: {
    width: 32,
    height: 32,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  inputBox: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
    backgroundColor: "rgba(0,0,0,0.04)",
    overflow: "hidden",
  },
  textInput: {
    margin: 0,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
    color: "#050505",
    minHeight: 40,
    maxHeight: 128,
    textAlignVertical: "top",
  },
  sendBtn: {
    width: 40,
    height: 40,
    flexShrink: 0,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  likeBtn: {
    width: 40,
    height: 40,
    flexShrink: 0,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
    backgroundColor: "rgba(0,0,0,0.04)",
  },
  disabled: {
    opacity: 0.4,
  },
});

function ToolbarIcon({
  children,
  onPress,
  accessibilityLabel,
  disabled,
  active,
}: {
  children: ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  disabled?: boolean;
  active?: boolean;
}): ReactElement {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      style={[
        toolbarIconStyles.btn,
        active && toolbarIconStyles.btnActive,
        disabled && toolbarIconStyles.btnDisabled,
      ]}
    >
      {children}
    </Pressable>
  );
}

const toolbarIconStyles = StyleSheet.create({
  btn: {
    borderRadius: 8,
    padding: 8,
    marginRight: 2,
  },
  btnActive: {
    backgroundColor: "rgba(0,104,255,0.1)",
  },
  btnDisabled: {
    opacity: 0.4,
  },
});
