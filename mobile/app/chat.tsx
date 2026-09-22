import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  ScrollView,
  Keyboard,
} from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from '@/components/common/app-text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors, spacing, typography } from '@/constants/theme';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  SentIcon,
  Add01Icon,
  Clock01Icon,
  File01Icon,
  Cancel01Icon,
  ArrowLeft02Icon,
  MoreHorizontalIcon,
} from '@hugeicons/core-free-icons';
import { ChatMessage, DocumentItem, ChatSession } from '@/types';
import {
  createChatSession,
  listChatSessions,
  getChatSession,
  deleteChatSession,
  sendChatMessage,
  quickChat,
} from '@/lib/api/chat';
import { listDocuments } from '@/lib/api/documents';
import { localDb } from '@/lib/storage/localDb';
import { ChatMessageItem } from '@/components/chat/ChatMessageItem';
import { ChatHistoryDrawer } from '@/components/chat/ChatHistoryDrawer';
import { GlassButton } from '@/components/glass';

// Hoisted static assets to prevent re-instantiation and avatar flickering
const MOMO_THINKING_IMG = require('@/assets/animations/thinking_momo.png');
const MOMO_CHEER_IMG = require('@/assets/animations/cheer_momo.png');
const MOMO_HAPPY_IMG = require('@/assets/animations/happy_momo.png');

const PROMPT_SUGGESTIONS = [
  'Build a 10-card flashcard deck',
  'Generate an educational diagram',
  'What documents do I have in my library?',
  'Search my notes for key concepts',
  'Quiz me on my uploaded material',
];

interface ChatHeaderProps {
  topInset: number;
  sessionCount: number;
  onOpenMenu: () => void;
  onBack?: () => void;
}

/**
 * Strictly memoized ChatHeader so keystrokes in the input field NEVER cause the avatar/header to re-render
 */
const ChatHeader = React.memo<ChatHeaderProps>(
  function ChatHeader({
    topInset,
    sessionCount,
    onOpenMenu,
    onBack,
  }) {
    return (
      <View style={[styles.header, { paddingTop: topInset + 8 }]}>
        <View style={styles.headerLeft}>
          {onBack && (
            <GlassButton
              variant="subtle"
              size="icon"
              radius={18}
              haptic="light"
              onPress={onBack}
              accessibilityLabel="Go back"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.backBtn}
              contentStyle={{ width: 36, height: 36 }}
            >
              <HugeiconsIcon icon={ArrowLeft02Icon} size={20} color={colors.text} />
            </GlassButton>
          )}
          <View style={styles.avatarWrapper}>
            <Image
              source={MOMO_HAPPY_IMG}
              style={styles.avatar}
              resizeMode="contain"
              fadeDuration={0}
            />
            <View style={styles.onlineBadge} />
          </View>
          <View style={styles.headerInfo}>
            <View style={styles.titleRow}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                Momo AI
              </Text>
              <View style={styles.companionBadge}>
                <Text style={styles.companionBadgeText}>Agent</Text>
              </View>
            </View>
            <View style={styles.statusRow}>
              <View style={styles.statusPulseDot} />
              <Text style={styles.headerSubtitle} numberOfLines={1} ellipsizeMode="tail">
                Ready to help you study
              </Text>
            </View>
          </View>
        </View>

        {/* Sleek Three Dots Button (Opens Drawer with New Chat & History) */}
        <GlassButton
          variant="subtle"
          size="icon"
          radius={19}
          haptic="light"
          onPress={onOpenMenu}
          accessibilityLabel="Open conversations and options"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.moreButton}
          contentStyle={{ width: 38, height: 38 }}
        >
          <HugeiconsIcon icon={MoreHorizontalIcon} size={20} color={colors.text} />
          {sessionCount > 0 && (
            <View style={styles.moreBadge}>
              <Text style={styles.moreBadgeText}>{sessionCount}</Text>
            </View>
          )}
        </GlassButton>
      </View>
    );
  },
  (prev, next) =>
    prev.topInset === next.topInset &&
    prev.sessionCount === next.sessionCount &&
    prev.onBack === next.onBack
);

export default function ChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ initialPrompt?: string }>();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);

  const [session, setSession] = useState<ChatSession | null>(null);
  const [allSessions, setAllSessions] = useState<ChatSession[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState(params.initialPrompt || '');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  // Sync initialPrompt param if it updates
  useEffect(() => {
    if (params.initialPrompt) {
      setInputText(params.initialPrompt);
      inputTextRef.current = params.initialPrompt;
    }
  }, [params.initialPrompt]);

  // Stable refs to decouple callbacks and FlatList re-renders from user typing
  const inputTextRef = useRef('');
  const sessionRef = useRef<ChatSession | null>(session);
  const selectedDocIdRef = useRef<string | null>(selectedDocId);
  const sendingRef = useRef(sending);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    selectedDocIdRef.current = selectedDocId;
  }, [selectedDocId]);

  useEffect(() => {
    sendingRef.current = sending;
    if (sending) {
      const timer = setTimeout(() => {
        setSending(false);
      }, 15000);
      return () => clearTimeout(timer);
    }
  }, [sending]);

  const handleInputChange = useCallback((text: string) => {
    inputTextRef.current = text;
    setInputText(text);
  }, []);

  // Monitor keyboard visibility for responsive floating dock padding
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setIsKeyboardOpen(true)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setIsKeyboardOpen(false)
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    initChat();
    loadDocuments();
  }, []);

  const initChat = async () => {
    setLoading(true);
    try {
      const sessions = await listChatSessions();
      setAllSessions(sessions || []);
      if (sessions && sessions.length > 0) {
        const active = sessions[0];
        setSession(active);
        // Load local cache first for instant feedback
        const cached = await localDb.getChatMessages(active.id);
        if (cached.length > 0) {
          setMessages(cached);
        }
        try {
          const detail = await getChatSession(active.id);
          setMessages(detail.messages || []);
          await localDb.saveChatMessages(active.id, detail.messages || []);
        } catch {
          // If network fetch fails, keep cached messages
        }
      } else {
        const newSession = await createChatSession('Chat with Momo');
        setSession(newSession);
        setAllSessions([newSession]);
        setMessages([]);
      }
    } catch (e) {
      console.warn('Could not initialize remote chat session, using local session:', e);
      const fallback: ChatSession = {
        id: 'local-session-default',
        user_id: 'me',
        title: 'Chat with Momo',
        message_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setSession(fallback);
      setAllSessions([fallback]);
      const cached = await localDb.getChatMessages('local-session-default');
      setMessages(cached);
    } finally {
      setLoading(false);
    }
  };

  const loadDocuments = async () => {
    try {
      const docs = await listDocuments();
      setDocuments(docs.filter((d) => d.processing_status === 'READY'));
    } catch (e) {
      console.warn('Could not load documents for chat context:', e);
    }
  };

  const refreshSessions = async () => {
    try {
      setHistoryLoading(true);
      const list = await listChatSessions();
      setAllSessions(list || []);
    } catch (e) {
      console.warn('Could not refresh sessions list:', e);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleOpenHistory = useCallback(() => {
    setIsHistoryOpen(true);
    refreshSessions();
  }, []);

  const handleSelectSession = async (selected: ChatSession) => {
    if (selected.id === session?.id) return;

    setSession(selected);
    setLoading(true);

    // 1. Instant local cache restore
    const cached = await localDb.getChatMessages(selected.id);
    if (cached.length > 0) {
      setMessages(cached);
    } else {
      setMessages([]);
    }

    // 2. Fetch fresh from server
    try {
      const detail = await getChatSession(selected.id);
      setMessages(detail.messages || []);
      await localDb.saveChatMessages(selected.id, detail.messages || []);
    } catch (e) {
      console.warn('Could not fetch session detail:', e);
    } finally {
      setLoading(false);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 80);
    }
  };

  const handleNewChat = useCallback(async () => {
    try {
      setLoading(true);
      const newSession = await createChatSession('Chat with Momo');
      setSession(newSession);
      setAllSessions((prev) => [newSession, ...prev.filter((s) => s.id !== newSession.id)]);
      setMessages([]);
    } catch (e) {
      console.warn('Failed to start remote chat session, using local session:', e);
      const localId = `local-session-${Date.now()}`;
      const localSession: ChatSession = {
        id: localId,
        user_id: 'me',
        title: 'Chat with Momo',
        message_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setSession(localSession);
      setAllSessions((prev) => [localSession, ...prev]);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await deleteChatSession(sessionId);
    } catch (e) {
      console.warn('Could not delete session on backend:', e);
    }

    await localDb.deleteChatMessages(sessionId);
    const updated = allSessions.filter((s) => s.id !== sessionId);
    setAllSessions(updated);

    // If active session was deleted, switch to the next available or create a fresh one
    if (session?.id === sessionId) {
      if (updated.length > 0) {
        handleSelectSession(updated[0]);
      } else {
        handleNewChat();
      }
    }
  };

  const handleSendMessage = useCallback(async (textToSend?: string) => {
    const text = (textToSend !== undefined ? textToSend : inputTextRef.current).trim();
    if (!text || sendingRef.current) return;

    inputTextRef.current = '';
    setInputText('');
    setSending(true);

    const currentSession = sessionRef.current;
    const currentDocId = selectedDocIdRef.current;

    // Optimistic user message
    const tempUserMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      session_id: currentSession?.id || 'default',
      user_id: 'me',
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      let assistantMsg: ChatMessage;
      if (currentSession && !currentSession.id.startsWith('local-')) {
        assistantMsg = await sendChatMessage(currentSession.id, text, currentDocId || undefined);
      } else {
        assistantMsg = await quickChat(text, currentDocId || undefined);
        if (currentSession && currentSession.id.startsWith('local-') && assistantMsg.session_id) {
          setSession((prev) => (prev ? { ...prev, id: assistantMsg.session_id } : null));
        }
      }

      const msgsToAdd = [assistantMsg];
      if (assistantMsg.follow_up_message) {
        msgsToAdd.push(assistantMsg.follow_up_message);
      }

      setMessages((prev) => {
        const updated = [...prev.filter((m) => m.id !== tempUserMsg.id), tempUserMsg, ...msgsToAdd];
        if (currentSession) {
          localDb.saveChatMessages(currentSession.id, updated);
        }
        return updated;
      });

      // Update session title / count in history list
      setAllSessions((prev) =>
        prev.map((s) => {
          if (s.id === currentSession?.id) {
            return {
              ...s,
              title: s.title === 'Chat with Momo' ? text.slice(0, 30) : s.title,
              message_count: (s.message_count || 0) + 1 + msgsToAdd.length,
              updated_at: new Date().toISOString(),
            };
          }
          return s;
        })
      );
    } catch (e: any) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        session_id: currentSession?.id || 'default',
        user_id: 'assistant',
        role: 'assistant',
        content: `Momo says: I couldn't reach the study server right now. (${e?.message || 'Connection issue'}). Please check that your phone is on the same Wi-Fi as your development machine!`,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setSending(false);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 150);
    }
  }, []);

  const handleSelectQuickReply = useCallback(
    (reply: string) => {
      handleSendMessage(reply);
    },
    [handleSendMessage]
  );

  const renderItem = useCallback(
    ({ item }: { item: ChatMessage }) => (
      <ChatMessageItem
        message={item}
        onSelectQuickReply={handleSelectQuickReply}
      />
    ),
    [handleSelectQuickReply]
  );

  const keyExtractor = useCallback((item: ChatMessage) => item.id, []);

  const selectedDoc = documents.find((d) => d.id === selectedDocId);

  const renderDocFilter = () => {
    if (documents.length === 0) return null;

    return (
      <View style={styles.filterSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          <TouchableOpacity
            style={[styles.filterChip, selectedDocId === null && styles.filterChipActive]}
            onPress={() => setSelectedDocId(null)}
          >
            <Text style={[styles.filterChipText, selectedDocId === null && styles.filterChipTextActive]}>
              All Notes
            </Text>
          </TouchableOpacity>
          {documents.map((doc) => {
            const active = selectedDocId === doc.id;
            return (
              <TouchableOpacity
                key={doc.id}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setSelectedDocId(active ? null : doc.id)}
              >
                <HugeiconsIcon
                  icon={File01Icon}
                  size={12}
                  color={active ? '#FFFFFF' : colors.textSecondary}
                />
                <Text
                  style={[styles.filterChipText, active && styles.filterChipTextActive]}
                  numberOfLines={1}
                >
                  {doc.original_filename}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Image
        source={MOMO_CHEER_IMG}
        style={styles.emptyMascot}
        resizeMode="contain"
      />
      <Text style={styles.emptyTitle}>Hey there, scholar!</Text>
      <Text style={styles.emptySubtitle}>
        I'm Momo, your personal AI tutor. Ask me anything from your study materials or tell me to build a practice deck!
      </Text>

      <View style={styles.suggestionsGrid}>
        {PROMPT_SUGGESTIONS.map((suggestion, idx) => (
          <TouchableOpacity
            key={idx}
            style={styles.suggestionChip}
            onPress={() => handleSendMessage(suggestion)}
            activeOpacity={0.7}
          >
            <Text style={styles.suggestionText}>{suggestion}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderThinkingFooter = useCallback(() => {
    if (!sending) return null;
    return (
      <View style={styles.thinkingAssistantRow}>
        <View style={styles.thinkingAvatarColumn}>
          <View style={styles.thinkingAvatarRing}>
            <Image
              source={MOMO_THINKING_IMG}
              style={styles.thinkingAvatar}
              resizeMode="contain"
              fadeDuration={0}
            />
          </View>
        </View>

        <View style={styles.thinkingContentColumn}>
          <View style={styles.thinkingMetaRow}>
            <View style={styles.thinkingNameRow}>
              <Text style={styles.thinkingAssistantName}>Momo</Text>
              <View style={styles.thinkingAiTag}>
                <Text style={styles.thinkingAiTagText}>Thinking</Text>
              </View>
            </View>
          </View>

          <View style={styles.thinkingBubble}>
            <View style={styles.thinkingPulseRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <View style={styles.thinkingTextGroup}>
                <Text style={styles.thinkingTitle}>Momo is formulating your answer...</Text>
                <Text style={styles.thinkingSubtitle}>Analyzing notes and key concepts</Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  }, [sending]);

  return (
    <View style={styles.container}>
      <ChatHeader
        topInset={insets.top}
        sessionCount={allSessions.length}
        onOpenMenu={handleOpenHistory}
        onBack={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/(tabs)');
          }
        }}
      />
      {renderDocFilter()}

      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Momo is preparing notes...</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            contentContainerStyle={[
              styles.messageList,
              messages.length === 0 && styles.messageListEmpty,
              {
                paddingBottom: isKeyboardOpen
                  ? 20
                  : Platform.OS === 'ios'
                    ? Math.max(insets.bottom, 12) + 70
                    : Math.max(insets.bottom + 12, 22) + 70,
              },
            ]}
            ListEmptyComponent={renderEmptyState}
            ListFooterComponent={renderThinkingFooter}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          />
        )}

        {/* Enhanced Floating "Ask Momo" Input Field Layout */}
        <View
          style={[
            styles.floatingDockContainer,
            {
              paddingBottom: isKeyboardOpen
                ? 8
                : Platform.OS === 'ios'
                  ? Math.max(insets.bottom, 12)
                  : Math.max(insets.bottom + 12, 22),
            },
          ]}
        >
          <View
            style={[
              styles.dockCard,
              (isInputFocused || inputText.length > 0) && styles.dockCardFocused,
            ]}
          >
            {/* Context Badge if a specific document is locked for grounding */}
            {selectedDoc && (
              <View style={styles.contextBadgeRow}>
                <View style={styles.contextBadge}>
                  <HugeiconsIcon icon={File01Icon} size={12} color={colors.primary} />
                  <Text style={styles.contextBadgeText} numberOfLines={1}>
                    Grounded on: {selectedDoc.original_filename}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setSelectedDocId(null)}
                    style={styles.clearContextBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <HugeiconsIcon icon={Cancel01Icon} size={11} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Live Typing Header Bar: Lets user see live character count & clear action */}
            {inputText.length > 0 && (
              <View style={styles.liveTypingHeader}>
                <View style={styles.liveTypingIndicator}>
                  <View style={styles.typingDot} />
                  <Text style={styles.liveTypingText}>
                    Draft ({inputText.trim().split(/\s+/).filter(Boolean).length} words, {inputText.length} chars)
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleInputChange('')}
                  style={styles.clearTextBtn}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Text style={styles.clearTextLabel}>Clear</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Input & Action Buttons Row */}
            <View style={styles.dockInnerRow}>
              <TextInput
                style={styles.dockTextInput}
                placeholder={
                  selectedDoc
                    ? `Ask about ${selectedDoc.original_filename}...`
                    : `Ask Momo anything or say "Build a deck"...`
                }
                placeholderTextColor="#98A2B3"
                value={inputText}
                onChangeText={handleInputChange}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => setIsInputFocused(false)}
                multiline
                maxLength={2000}
                editable={!sending}
                textAlignVertical="top"
                cursorColor="#7F56D9"
                selectionColor="rgba(127, 86, 217, 0.25)"
                autoCapitalize="sentences"
                autoCorrect={true}
              />

              {/* Elevated Send Button */}
              <GlassButton
                variant={inputText.trim() ? "primary" : "subtle"}
                size="icon"
                radius={19}
                haptic={inputText.trim() ? "medium" : false}
                onPress={() => handleSendMessage()}
                disabled={!inputText.trim() || sending}
                style={[
                  styles.dockSendButton,
                  inputText.trim() && !sending && styles.dockSendButtonActive,
                  (!inputText.trim() || sending) && styles.dockSendButtonDisabled,
                ]}
                contentStyle={{ width: 38, height: 38 }}
                accessibilityLabel="Send message"
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <HugeiconsIcon
                    icon={SentIcon}
                    size={17}
                    color={inputText.trim() ? '#FFFFFF' : '#98A2B3'}
                  />
                )}
              </GlassButton>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Slide-in Chat History Drawer */}
      <ChatHistoryDrawer
        visible={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        sessions={allSessions}
        activeSessionId={session?.id || null}
        onSelectSession={handleSelectSession}
        onNewChat={handleNewChat}
        onDeleteSession={handleDeleteSession}
        loading={historyLoading}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FE',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F2F4F7',
    shadowColor: '#101828',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    zIndex: 10,
    width: '100%',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexShrink: 1,
    marginRight: 10,
  },
  backBtn: {
    marginRight: 8,
    flexShrink: 0,
  },
  avatarWrapper: {
    position: 'relative',
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    backgroundColor: 'transparent',
    flexShrink: 0,
  },
  avatar: {
    width: 42,
    height: 42,
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#12B76A',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  headerInfo: {
    flex: 1,
    flexShrink: 1,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: typography.fontFamily.bold,
    color: colors.text,
  },
  companionBadge: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  companionBadgeText: {
    fontSize: 10,
    fontFamily: typography.fontFamily.bold,
    color: colors.primary,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 1,
  },
  statusPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#12B76A',
    flexShrink: 0,
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: typography.fontFamily.medium,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  moreButton: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    position: 'relative',
  },
  moreBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.primary,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  moreBadgeText: {
    fontSize: 10,
    fontFamily: typography.fontFamily.bold,
    color: '#FFFFFF',
  },
  filterSection: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EAECF0',
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: '#F2F4F7',
    gap: 4,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
  },
  filterChipText: {
    fontSize: 11,
    fontFamily: typography.fontFamily.medium,
    color: colors.textSecondary,
    maxWidth: 140,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    fontFamily: typography.fontFamily.medium,
    color: colors.textSecondary,
  },
  messageList: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  messageListEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  emptyMascot: {
    width: 100,
    height: 100,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: typography.fontFamily.bold,
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 24,
  },
  suggestionsGrid: {
    width: '100%',
    gap: 8,
  },
  suggestionChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E7EC',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  suggestionText: {
    fontSize: 13,
    fontFamily: typography.fontFamily.medium,
    color: colors.text,
  },
  // Momo Thinking / Formulating Indicator Styles
  thinkingAssistantRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 2,
    marginBottom: 12,
  },
  thinkingAvatarColumn: {
    marginRight: 10,
    paddingTop: 2,
  },
  thinkingAvatarRing: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  thinkingAvatar: {
    width: 36,
    height: 36,
  },
  thinkingContentColumn: {
    flex: 1,
    alignItems: 'flex-start',
  },
  thinkingMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  thinkingNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  thinkingAssistantName: {
    fontSize: 13,
    fontFamily: typography.fontFamily.bold,
    color: colors.text,
  },
  thinkingAiTag: {
    backgroundColor: '#F4EBFF',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: '#E9D7FE',
  },
  thinkingAiTagText: {
    fontSize: 9,
    fontFamily: typography.fontFamily.semiBold,
    color: '#7F56D9',
  },
  thinkingBubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderTopLeftRadius: 4,
    paddingHorizontal: 15,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    shadowColor: '#101828',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    maxWidth: '92%',
  },
  thinkingPulseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  thinkingTextGroup: {
    flex: 1,
  },
  thinkingTitle: {
    fontSize: 13,
    fontFamily: typography.fontFamily.semiBold,
    color: colors.text,
    marginBottom: 2,
  },
  thinkingSubtitle: {
    fontSize: 11,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
  },
  // Floating "Ask Momo" Dock Layout
  floatingDockContainer: {
    paddingHorizontal: 16,
    paddingTop: 6,
    backgroundColor: 'transparent',
  },
  dockCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E4E7EC',
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#101828',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
  },
  dockCardFocused: {
    borderColor: '#7F56D9',
    shadowColor: '#7F56D9',
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  liveTypingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 6,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F4EBFF',
  },
  liveTypingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#7F56D9',
  },
  liveTypingText: {
    fontSize: 11,
    fontFamily: typography.fontFamily.medium,
    color: '#6941C6',
  },
  clearTextBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#F4EBFF',
    borderRadius: 6,
  },
  clearTextLabel: {
    fontSize: 11,
    fontFamily: typography.fontFamily.medium,
    color: '#7F56D9',
  },
  contextBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  contextBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4EBFF',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 5,
    maxWidth: '94%',
    borderWidth: 1,
    borderColor: '#E9D7FE',
  },
  contextBadgeText: {
    fontSize: 11,
    fontFamily: typography.fontFamily.medium,
    color: colors.primary,
    flexShrink: 1,
  },
  clearContextBtn: {
    padding: 2,
  },
  dockInnerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  dockTextInput: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: '#101828',
    maxHeight: 120,
    minHeight: 42,
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 4,
  },
  dockSendButton: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
    marginLeft: 6,
  },
  dockSendButtonActive: {},
  dockSendButtonDisabled: {},
});
