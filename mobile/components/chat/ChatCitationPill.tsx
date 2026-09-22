import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { AppText as Text } from '@/components/common/app-text';
import { colors, spacing, typography } from '@/constants/theme';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { BookOpen01Icon, Cancel01Icon, LinkSquare02Icon } from '@hugeicons/core-free-icons';
import { CitationItem } from '../../types';

interface ChatCitationPillProps {
  citation: CitationItem;
}

export const ChatCitationPill: React.FC<ChatCitationPillProps> = ({ citation }) => {
  const [modalVisible, setModalVisible] = useState(false);

  const pageText = citation.page_start
    ? citation.page_end && citation.page_end !== citation.page_start
      ? `P. ${citation.page_start}-${citation.page_end}`
      : `P. ${citation.page_start}`
    : null;

  return (
    <>
      <TouchableOpacity
        style={styles.pillContainer}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.7}
      >
        <HugeiconsIcon icon={BookOpen01Icon} size={13} color={colors.primary} />
        <Text style={styles.pillText} numberOfLines={1}>
          {citation.document_name}
        </Text>
        {pageText && (
          <View style={styles.pageBadge}>
            <Text style={styles.pageText}>{pageText}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Snippet Preview Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.titleRow}>
                <HugeiconsIcon icon={BookOpen01Icon} size={18} color={colors.primary} />
                <Text style={styles.modalTitle} numberOfLines={1}>
                  {citation.document_name}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <HugeiconsIcon icon={Cancel01Icon} size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {citation.section && (
              <View style={styles.sectionRow}>
                <Text style={styles.sectionLabel}>Section:</Text>
                <Text style={styles.sectionValue}>{citation.section}</Text>
              </View>
            )}

            {pageText && (
              <View style={styles.sectionRow}>
                <Text style={styles.sectionLabel}>Location:</Text>
                <Text style={styles.sectionValue}>{pageText}</Text>
              </View>
            )}

            <View style={styles.divider} />

            <Text style={styles.snippetLabel}>Evidence Excerpt:</Text>
            <View style={styles.snippetBox}>
              <Text style={styles.snippetText}>{citation.snippet}</Text>
            </View>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setModalVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.closeButtonText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  pillContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3EDF7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#E8DEF8',
    maxWidth: 200,
  },
  pillText: {
    fontSize: 11,
    fontFamily: typography.fontFamily.medium,
    color: colors.primary,
    marginLeft: 4,
    flexShrink: 1,
  },
  pageBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 4,
  },
  pageText: {
    fontSize: 9,
    fontFamily: typography.fontFamily.semiBold,
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxHeight: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: typography.fontFamily.semiBold,
    color: colors.text,
    marginLeft: 8,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: typography.fontFamily.medium,
    color: colors.textSecondary,
    width: 65,
  },
  sectionValue: {
    fontSize: 12,
    fontFamily: typography.fontFamily.semiBold,
    color: colors.primary,
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 12,
  },
  snippetLabel: {
    fontSize: 12,
    fontFamily: typography.fontFamily.medium,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  snippetBox: {
    backgroundColor: '#F8F9FE',
    padding: 12,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    marginBottom: 16,
  },
  snippetText: {
    fontSize: 13,
    fontFamily: typography.fontFamily.regular,
    color: colors.text,
    lineHeight: 18,
  },
  closeButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 14,
    fontFamily: typography.fontFamily.semiBold,
    color: '#FFFFFF',
  },
});
