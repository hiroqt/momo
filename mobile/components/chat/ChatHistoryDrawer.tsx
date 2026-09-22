import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  Animated,
  Dimensions,
  ActivityIndicator,
  Alert,
  TouchableWithoutFeedback,
} from 'react-native';
import { AppText as Text } from '@/components/common/app-text';
import { colors, spacing, typography } from '@/constants/theme';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  Clock01Icon,
  Cancel01Icon,
  Delete02Icon,
  Add01Icon,
  Chat01Icon,
  BubbleChatIcon,
} from '@hugeicons/core-free-icons';
import { ChatSession } from '../../types';

interface ChatHistoryDrawerProps {
  visible: boolean;
  onClose: () => void;
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (session: ChatSession) => void;
  onNewChat: () => void;
  onDeleteSession: (sessionId: string) => Promise<void>;
  loading?: boolean;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.84, 340);

function formatRelativeTime(dateString?: string): string {
  if (!dateString) return '';
  try {
    const d = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 7) {
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
    if (diffDays >= 1) {
      return diffDays === 1 ? 'Yesterday' : `${diffDays}d ago`;
    }
    if (diffHours >= 1) {
      return `${diffHours}h ago`;
    }
    if (diffMin >= 1) {
      return `${diffMin}m ago`;
    }
    return 'Just now';
  } catch {
    return '';
  }
}

export const ChatHistoryDrawer: React.FC<ChatHistoryDrawerProps> = ({
  visible,
  onClose,
  sessions,
  activeSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  loading = false,
}) => {
  const slideAnim = useRef(new Animated.Value(DRAWER_WIDTH)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 24,
          stiffness: 220,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: DRAWER_WIDTH,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleDeletePress = (session: ChatSession) => {
    Alert.alert(
      'Delete Chat',
      `Are you sure you want to delete "${session.title || 'this chat'}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(session.id);
            try {
              await onDeleteSession(session.id);
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  const handleSelect = (session: ChatSession) => {
    onSelectSession(session);
    onClose();
  };

  const handleNewChatPress = () => {
    onNewChat();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.modalOverlay}>
        {/* Animated Dim Backdrop */}
        <TouchableWithoutFeedback onPress={onClose}>
          <Animated.View
            style={[
              styles.backdrop,
              {
                opacity: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.5],
                }),
              },
            ]}
          />
        </TouchableWithoutFeedback>

        {/* Sliding Drawer Container */}
        <Animated.View
          style={[
            styles.drawerContainer,
            {
              width: DRAWER_WIDTH,
              transform: [{ translateX: slideAnim }],
            },
          ]}
        >
          {/* Drawer Header */}
          <View style={styles.drawerHeader}>
            <View style={styles.headerTitleGroup}>
              <View style={styles.headerIconBubble}>
                <HugeiconsIcon icon={Clock01Icon} size={18} color={colors.primary} />
              </View>
              <View>
                <Text style={styles.drawerTitle}>Conversations</Text>
                <Text style={styles.drawerSubtitle}>
                  {sessions.length} {sessions.length === 1 ? 'saved conversation' : 'saved conversations'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <HugeiconsIcon icon={Cancel01Icon} size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* New Chat Primary Action Button */}
          <View style={styles.newChatWrapper}>
            <TouchableOpacity
              style={styles.newChatAction}
              onPress={handleNewChatPress}
              activeOpacity={0.8}
            >
              <HugeiconsIcon icon={Add01Icon} size={18} color="#FFFFFF" />
              <Text style={styles.newChatActionText}>New Chat</Text>
            </TouchableOpacity>
          </View>

          {/* History Section Header */}
          <View style={styles.historySectionHeader}>
            <Text style={styles.historySectionTitle}>History</Text>
            {sessions.length > 0 && (
              <View style={styles.historyCountBadge}>
                <Text style={styles.historyCountBadgeText}>{sessions.length}</Text>
              </View>
            )}
          </View>

          {/* Sessions List */}
          {loading && sessions.length === 0 ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.loadingText}>Loading history...</Text>
            </View>
          ) : sessions.length === 0 ? (
            <View style={styles.emptyBox}>
              <View style={styles.emptyIconCircle}>
                <HugeiconsIcon icon={BubbleChatIcon} size={28} color="#98A2B3" />
              </View>
              <Text style={styles.emptyTitle}>No past chats</Text>
              <Text style={styles.emptySub}>
                Your conversations with Momo will appear here.
              </Text>
            </View>
          ) : (
            <FlatList
              data={sessions}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => {
                const isActive = item.id === activeSessionId;
                const isDeleting = deletingId === item.id;

                return (
                  <TouchableOpacity
                    style={[styles.sessionCard, isActive && styles.sessionCardActive]}
                    onPress={() => handleSelect(item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.sessionCardLeft}>
                      <View
                        style={[
                          styles.chatIconWrapper,
                          isActive && styles.chatIconWrapperActive,
                        ]}
                      >
                        <HugeiconsIcon
                          icon={Chat01Icon}
                          size={15}
                          color={isActive ? colors.primary : colors.textSecondary}
                        />
                      </View>
                      <View style={styles.sessionInfo}>
                        <Text
                          style={[
                            styles.sessionTitle,
                            isActive && styles.sessionTitleActive,
                          ]}
                          numberOfLines={1}
                        >
                          {item.title || 'Untitled Chat'}
                        </Text>
                        <View style={styles.sessionMetaRow}>
                          <Text style={styles.sessionMetaTime}>
                            {formatRelativeTime(item.updated_at || item.created_at)}
                          </Text>
                          {item.message_count !== undefined && item.message_count > 0 && (
                            <>
                              <Text style={styles.metaDot}>•</Text>
                              <Text style={styles.sessionMetaCount}>
                                {item.message_count} {item.message_count === 1 ? 'msg' : 'msgs'}
                              </Text>
                            </>
                          )}
                        </View>
                      </View>
                    </View>

                    {/* Delete action button */}
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDeletePress(item)}
                      disabled={isDeleting}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      {isDeleting ? (
                        <ActivityIndicator size="small" color="#F04438" />
                      ) : (
                        <HugeiconsIcon
                          icon={Delete02Icon}
                          size={15}
                          color={isActive ? '#98A2B3' : '#D0D5DD'}
                        />
                      )}
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              }}
            />
          )}

          {/* Drawer Footer info */}
          <View style={styles.drawerFooter}>
            <Text style={styles.footerNote}>Chats are synced with your study cloud</Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000000',
  },
  drawerContainer: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
    paddingTop: 56,
    display: 'flex',
    flexDirection: 'column',
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F4F7',
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconBubble: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F4EBFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  drawerTitle: {
    fontSize: 16,
    fontFamily: typography.fontFamily.bold,
    color: colors.text,
  },
  drawerSubtitle: {
    fontSize: 11,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
    marginTop: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F8F9FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  newChatWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  newChatAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 11,
    borderRadius: 14,
    gap: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  newChatActionText: {
    fontSize: 14,
    fontFamily: typography.fontFamily.semiBold,
    color: '#FFFFFF',
  },
  historySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 8,
  },
  historySectionTitle: {
    fontSize: 12,
    fontFamily: typography.fontFamily.bold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  historyCountBadge: {
    backgroundColor: '#F4EBFF',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 1.5,
  },
  historyCountBadgeText: {
    fontSize: 11,
    fontFamily: typography.fontFamily.semiBold,
    color: colors.primary,
  },
  listContent: {
    paddingHorizontal: 14,
    paddingBottom: 20,
  },
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F2F4F7',
  },
  sessionCardActive: {
    backgroundColor: '#F9F5FF',
    borderColor: '#D6BBFB',
  },
  sessionCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  chatIconWrapper: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#F2F4F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  chatIconWrapperActive: {
    backgroundColor: '#ECE9FE',
  },
  sessionInfo: {
    flex: 1,
  },
  sessionTitle: {
    fontSize: 13,
    fontFamily: typography.fontFamily.medium,
    color: colors.text,
    marginBottom: 2,
  },
  sessionTitleActive: {
    fontFamily: typography.fontFamily.bold,
    color: colors.primary,
  },
  sessionMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sessionMetaTime: {
    fontSize: 11,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
  },
  metaDot: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  sessionMetaCount: {
    fontSize: 11,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
  },
  deleteButton: {
    padding: 6,
    borderRadius: 8,
  },
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 12,
    fontFamily: typography.fontFamily.medium,
    color: colors.textSecondary,
  },
  emptyBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F2F4F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 14,
    fontFamily: typography.fontFamily.semiBold,
    color: colors.text,
  },
  emptySub: {
    fontSize: 12,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 17,
  },
  drawerFooter: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#F2F4F7',
    alignItems: 'center',
  },
  footerNote: {
    fontSize: 10,
    fontFamily: typography.fontFamily.regular,
    color: '#98A2B3',
  },
});
