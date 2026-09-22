import React, { useState } from 'react';
import { View, StyleSheet, Image, TouchableOpacity, Platform } from 'react-native';
import { AppText as Text } from '@/components/common/app-text';
import { colors, spacing, typography } from '@/constants/theme';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Copy01Icon, CopyCheckIcon, SparklesIcon } from '@hugeicons/core-free-icons';
import * as Clipboard from 'expo-clipboard';
import { ChatMessage } from '../../types';
import { ChatCitationPill } from './ChatCitationPill';
import { ChatDeckCard } from './ChatDeckCard';
import { ChatStudyCard } from './ChatStudyCard';

// Hoisted static asset to prevent flickering on keystrokes/re-renders
const MOMO_AVATAR_IMG = require('@/assets/animations/thinking_momo.png');

interface ChatMessageItemProps {
  message: ChatMessage;
  onSelectQuickReply?: (reply: string) => void;
}

// Comprehensive Unicode emoji pattern covering emoticons, symbols, pictographs, flags
const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}]|[\u{1FA00}-\u{1FAFF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{FE00}-\u{FE0F}]|[\u{1F000}-\u{1F02F}]|[\u{1F0A0}-\u{1F0FF}]|[\u{20D0}-\u{20FF}]|[\u{2300}-\u{23FF}]|[\u{2B50}]|[\u{2B55}]|[\u{2934}-\u{2935}]|[\u{25AA}-\u{25FE}]/gu;

export function stripEmojis(text: string): string {
  if (!text) return '';
  return text.replace(EMOJI_REGEX, '').replace(/[ ]{2,}/g, ' ');
}

function formatTime(isoString?: string): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

/**
 * Render inline formatted fragments (bold **text** and code `code`)
 */
function renderInlineText(text: string, isUser: boolean) {
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);

  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return (
        <Text
          key={idx}
          style={[styles.boldText, isUser ? styles.userBoldText : styles.assistantBoldText]}
        >
          {part.slice(2, -2)}
        </Text>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <Text
          key={idx}
          style={[styles.codeSpan, isUser ? styles.userCodeSpan : styles.assistantCodeSpan]}
        >
          {part.slice(1, -1)}
        </Text>
      );
    }
    return part;
  });
}

/**
 * Robust native markdown parser supporting headings, callouts, lists, and dividers
 */
function FormattedChatText({ content, isUser }: { content: string; isUser: boolean }) {
  const safeText = (content || '').trim();
  if (!safeText) {
    return null;
  }

  const lines = safeText.split('\n');

  return (
    <View style={styles.textContainer}>
      {lines.map((line, lineIdx) => {
        const trimmed = line.trim();

        // Empty line spacing
        if (!trimmed) {
          return <View key={lineIdx} style={styles.emptyLineSpacer} />;
        }

        // Horizontal Divider (---, ***, ___)
        if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
          return (
            <View
              key={lineIdx}
              style={[styles.divider, isUser ? styles.userDivider : styles.assistantDivider]}
            />
          );
        }

        // Headings (###, ##, #)
        if (trimmed.startsWith('### ')) {
          return (
            <Text
              key={lineIdx}
              style={[styles.h3Text, isUser ? styles.userBoldText : styles.assistantH3Text]}
            >
              {renderInlineText(trimmed.slice(4), isUser)}
            </Text>
          );
        }
        if (trimmed.startsWith('## ')) {
          return (
            <Text
              key={lineIdx}
              style={[styles.h2Text, isUser ? styles.userBoldText : styles.assistantH2Text]}
            >
              {renderInlineText(trimmed.slice(3), isUser)}
            </Text>
          );
        }
        if (trimmed.startsWith('# ')) {
          return (
            <Text
              key={lineIdx}
              style={[styles.h1Text, isUser ? styles.userBoldText : styles.assistantH1Text]}
            >
              {renderInlineText(trimmed.slice(2), isUser)}
            </Text>
          );
        }

        // Callout box / blockquote (> Quote)
        if (trimmed.startsWith('> ')) {
          const calloutText = trimmed.slice(2);
          return (
            <View
              key={lineIdx}
              style={[
                styles.calloutBox,
                isUser ? styles.userCalloutBox : styles.assistantCalloutBox,
              ]}
            >
              <Text
                style={[
                  styles.calloutText,
                  isUser ? styles.userText : styles.assistantCalloutText,
                ]}
              >
                {renderInlineText(calloutText, isUser)}
              </Text>
            </View>
          );
        }

        // Bullet list item (- or *)
        const isBullet = trimmed.startsWith('- ') || trimmed.startsWith('* ');
        if (isBullet) {
          const itemText = trimmed.slice(2);
          return (
            <View key={lineIdx} style={styles.listRow}>
              <Text style={[styles.bulletDot, isUser ? styles.userText : styles.bulletDotAssistant]}>
                •
              </Text>
              <Text style={[styles.listContentText, isUser ? styles.userText : styles.assistantText]}>
                {renderInlineText(itemText, isUser)}
              </Text>
            </View>
          );
        }

        // Numbered list item (1. )
        const numberedMatch = trimmed.match(/^(\d+\.)\s(.*)/);
        if (numberedMatch) {
          const prefix = numberedMatch[1];
          const itemText = numberedMatch[2];
          return (
            <View key={lineIdx} style={styles.listRow}>
              <Text
                style={[
                  styles.numberedPrefix,
                  isUser ? styles.userText : styles.numberedPrefixAssistant,
                ]}
              >
                {prefix}
              </Text>
              <Text style={[styles.listContentText, isUser ? styles.userText : styles.assistantText]}>
                {renderInlineText(itemText, isUser)}
              </Text>
            </View>
          );
        }

        // Regular paragraph line
        return (
          <Text
            key={lineIdx}
            style={[styles.paragraphText, isUser ? styles.userText : styles.assistantText]}
          >
            {renderInlineText(line, isUser)}
          </Text>
        );
      })}
    </View>
  );
}

export const ChatMessageItem = React.memo<ChatMessageItemProps>(
  function ChatMessageItem({ message, onSelectQuickReply }) {
    const isUser = message.role === 'user';
    const [copied, setCopied] = useState(false);

    // Guarantee non-empty content fallback for assistant (without emojis)
    const rawContent = (message.content || '').trim()
      ? message.content
      : message.study_card
      ? 'I generated a study card for you! Review the concept and import it to your library below:'
      : message.created_deck
      ? 'I have generated your study set! Review the cards below or start studying now.'
      : message.citations && message.citations.length > 0
      ? 'Here is what was found in your uploaded study notes:'
      : "Hello! I'm Momo, your AI study buddy. Ask me anything from your study materials!";

    const displayContent = stripEmojis(rawContent);

    const handleCopy = async () => {
      await Clipboard.setStringAsync(displayContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    // --- USER MESSAGE ---
    if (isUser) {
      return (
        <View style={styles.userContainer}>
          <View style={styles.userBubbleWrapper}>
            <View style={styles.userBubble}>
              <FormattedChatText content={displayContent} isUser={true} />
            </View>
            <Text style={styles.userTimestamp}>{formatTime(message.created_at)}</Text>
          </View>
        </View>
      );
    }

    // --- ASSISTANT (MOMO) MESSAGE ---
    return (
      <View style={styles.assistantContainer}>
        {/* Momo Avatar Column */}
        <View style={styles.avatarColumn}>
          <View style={styles.avatarRing}>
            <Image
              source={MOMO_AVATAR_IMG}
              style={styles.avatar}
              resizeMode="contain"
              fadeDuration={0}
            />
          </View>
        </View>

        {/* Assistant Content Column */}
        <View style={styles.assistantContent}>
          {/* Meta Header */}
          <View style={styles.assistantMetaRow}>
            <View style={styles.nameRow}>
              <Text style={styles.assistantName}>Momo</Text>
              <View style={styles.aiTag}>
                <Text style={styles.aiTagText}>AI Study Buddy</Text>
              </View>
            </View>
            <Text style={styles.assistantTimestamp}>{formatTime(message.created_at)}</Text>
          </View>

          {/* Message Bubble */}
          <View style={styles.assistantBubble}>
            <FormattedChatText content={displayContent} isUser={false} />

            {/* Copy Action */}
            <View style={styles.bubbleFooter}>
              <TouchableOpacity
                style={styles.copyButton}
                onPress={handleCopy}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <HugeiconsIcon
                  icon={copied ? CopyCheckIcon : Copy01Icon}
                  size={13}
                  color={copied ? '#12B76A' : colors.textSecondary}
                />
                <Text style={[styles.copyText, copied && styles.copiedText]}>
                  {copied ? 'Copied' : 'Copy'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Citations list */}
          {message.citations && message.citations.length > 0 && (
            <View style={styles.citationsContainer}>
              <View style={styles.citationHeader}>
                <HugeiconsIcon icon={SparklesIcon} size={13} color={colors.primary} />
                <Text style={styles.citationsLabel}>Grounded Sources:</Text>
              </View>
              <View style={styles.citationsList}>
                {message.citations.map((c, idx) => (
                  <ChatCitationPill key={idx} citation={c} />
                ))}
              </View>
            </View>
          )}

          {/* Generated Single Study Card (with import to library button) */}
          {message.study_card && <ChatStudyCard card={message.study_card} />}

          {/* Generated Deck Card */}
          {message.created_deck && <ChatDeckCard deck={message.created_deck} />}

          {/* Interactive Quick Reply Chips */}
          {message.quick_replies && message.quick_replies.length > 0 && (
            <View style={styles.quickRepliesContainer}>
              {message.quick_replies.map((rawQr, qIdx) => {
                const qr = stripEmojis(rawQr).trim();
                if (!qr) return null;
                return (
                  <TouchableOpacity
                    key={qIdx}
                    style={styles.quickReplyChip}
                    onPress={() => onSelectQuickReply?.(qr)}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.quickReplyText}>{qr}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </View>
    );
  },
  (prev, next) => (
    prev.message.id === next.message.id &&
    prev.message.content === next.message.content &&
    prev.message.role === next.message.role &&
    prev.message.created_deck?.study_set_id === next.message.created_deck?.study_set_id &&
    prev.message.study_card?.question === next.message.study_card?.question &&
    (prev.message.citations?.length || 0) === (next.message.citations?.length || 0) &&
    (prev.message.quick_replies?.length || 0) === (next.message.quick_replies?.length || 0)
  )
);

const styles = StyleSheet.create({
  // User Message Layout
  userContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 14,
    paddingLeft: 44,
  },
  userBubbleWrapper: {
    alignItems: 'flex-end',
    maxWidth: '85%',
  },
  userBubble: {
    backgroundColor: '#7F56D9',
    borderRadius: 18,
    borderBottomRightRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#7F56D9',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 2,
    alignSelf: 'flex-end',
  },
  userTimestamp: {
    fontSize: 10,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
    marginTop: 4,
    marginRight: 4,
  },

  // Assistant Message Layout
  assistantContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 18,
    paddingRight: 16,
  },
  avatarColumn: {
    marginRight: 10,
    paddingTop: 2,
  },
  avatarRing: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  avatar: {
    width: 34,
    height: 34,
  },
  assistantContent: {
    flex: 1,
    alignItems: 'flex-start',
  },
  assistantMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  assistantName: {
    fontSize: 13,
    fontFamily: typography.fontFamily.bold,
    color: colors.text,
  },
  aiTag: {
    backgroundColor: '#F4EBFF',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: '#E9D7FE',
  },
  aiTagText: {
    fontSize: 9,
    fontFamily: typography.fontFamily.semiBold,
    color: '#7F56D9',
  },
  assistantTimestamp: {
    fontSize: 10,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
  },
  assistantBubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderTopLeftRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    shadowColor: '#101828',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    maxWidth: '100%',
    alignSelf: 'flex-start',
  },

  // Formatted Text Layout
  textContainer: {
    width: '100%',
  },
  emptyLineSpacer: {
    height: 6,
  },
  h1Text: {
    fontSize: 16,
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 4,
  },
  assistantH1Text: {
    color: '#6941C6',
  },
  h2Text: {
    fontSize: 15,
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    marginTop: 6,
    marginBottom: 4,
  },
  assistantH2Text: {
    color: '#6941C6',
  },
  h3Text: {
    fontSize: 14,
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    marginTop: 5,
    marginBottom: 3,
  },
  assistantH3Text: {
    color: '#1D2939',
  },
  calloutBox: {
    borderRadius: 8,
    borderLeftWidth: 3.5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginVertical: 4,
  },
  assistantCalloutBox: {
    backgroundColor: '#F9F5FF',
    borderLeftColor: '#7F56D9',
  },
  userCalloutBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderLeftColor: '#FFFFFF',
  },
  calloutText: {
    fontSize: 13,
    fontFamily: typography.fontFamily.medium,
    lineHeight: 19,
  },
  assistantCalloutText: {
    color: '#42307D',
  },
  divider: {
    height: 1,
    marginVertical: 8,
    width: '100%',
  },
  assistantDivider: {
    backgroundColor: '#EAECF0',
  },
  userDivider: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  paragraphText: {
    fontSize: 14,
    fontFamily: typography.fontFamily.regular,
    lineHeight: 21,
    marginBottom: 4,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
    paddingLeft: 2,
  },
  bulletDot: {
    fontSize: 14,
    lineHeight: 21,
    marginRight: 6,
  },
  bulletDotAssistant: {
    color: colors.primary,
  },
  numberedPrefix: {
    fontSize: 13,
    fontFamily: typography.fontFamily.bold,
    lineHeight: 21,
    marginRight: 6,
  },
  numberedPrefixAssistant: {
    color: colors.primary,
  },
  listContentText: {
    flex: 1,
    fontSize: 14,
    fontFamily: typography.fontFamily.regular,
    lineHeight: 21,
  },

  // Colors & Typography
  userText: {
    color: '#FFFFFF',
  },
  assistantText: {
    color: '#1D2939',
  },
  boldText: {
    fontFamily: typography.fontFamily.bold,
  },
  userBoldText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  assistantBoldText: {
    color: '#101828',
    fontWeight: '700',
  },
  codeSpan: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  userCodeSpan: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    color: '#FFFFFF',
  },
  assistantCodeSpan: {
    backgroundColor: '#F4EBFF',
    color: '#6941C6',
  },

  // Bubble Footer (Copy)
  bubbleFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 6,
    paddingTop: 4,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  copyText: {
    fontSize: 11,
    fontFamily: typography.fontFamily.medium,
    color: colors.textSecondary,
  },
  copiedText: {
    color: '#12B76A',
  },

  // Citations
  citationsContainer: {
    marginTop: 8,
    width: '100%',
  },
  citationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 5,
  },
  citationsLabel: {
    fontSize: 11,
    fontFamily: typography.fontFamily.semiBold,
    color: colors.primary,
  },
  citationsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  // Quick Reply Chips
  quickRepliesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
    width: '100%',
  },
  quickReplyChip: {
    backgroundColor: '#F4EBFF',
    borderWidth: 1.5,
    borderColor: '#D6BBFB',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 1,
  },
  quickReplyText: {
    fontSize: 12,
    fontFamily: typography.fontFamily.semiBold,
    color: colors.primary,
  },
});
