import React, { useState } from 'react';
import { colors, spacing, typography } from '@/constants/theme';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { AppText as Text } from '@/components/common/app-text';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  Shield01Icon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  File01Icon,
  BookOpen01Icon,
  Layers01Icon,
} from '@hugeicons/core-free-icons';
import { SourceMetadata } from '../../types';
import { isMeaningfulSection } from '../../utils/formatters';

interface Props {
  source?: SourceMetadata;
  defaultExpanded?: boolean;
}

export const SourceAttribution: React.FC<Props> = ({ source, defaultExpanded = false }) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (!source || (!source.page && !source.section && !source.document_name && !source.snippet)) {
    return null;
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.headerRow}
        onPress={() => setExpanded((prev) => !prev)}
        activeOpacity={0.7}
      >
        <View style={styles.titleRow}>
          <View style={styles.shieldIconBox}>
            <HugeiconsIcon icon={Shield01Icon} size={14} color={colors.primary} strokeWidth={2.4} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>DOCUMENT REFERENCE</Text>
            <Text style={styles.sublabel}>Verified directly against your material</Text>
          </View>
        </View>
        <View style={styles.expandToggleRow}>
          <Text style={styles.expandToggleText}>{expanded ? 'Collapse' : 'Expand'}</Text>
          <HugeiconsIcon
            icon={expanded ? ArrowUp01Icon : ArrowDown01Icon}
            size={14}
            color={colors.primaryLight}
            strokeWidth={2.4}
          />
        </View>
      </TouchableOpacity>

      {/* Source Reference Chips */}
      <View style={styles.chipsRow}>
        {source.document_name ? (
          <View style={styles.chipDocument}>
            <HugeiconsIcon icon={File01Icon} size={13} color={colors.textSecondary} strokeWidth={2.2} />
            <Text style={styles.chipDocumentText} numberOfLines={1}>
              {source.document_name}
            </Text>
          </View>
        ) : null}

        {source.page ? (
          <View style={styles.chipPage}>
            <HugeiconsIcon icon={BookOpen01Icon} size={12} color={colors.primary} strokeWidth={2.2} />
            <Text style={styles.chipPageText}>Page {source.page}</Text>
          </View>
        ) : null}

        {isMeaningfulSection(source.section) ? (
          <View style={styles.chipSection}>
            <HugeiconsIcon icon={Layers01Icon} size={12} color={colors.textSecondary} strokeWidth={2} />
            <Text style={styles.chipSectionText} numberOfLines={1}>
              {source.section}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Expandable Excerpt Block */}
      {source.snippet && expanded ? (
        <View style={styles.snippetContainer}>
          <View style={styles.snippetHeaderRow}>
            <Text style={styles.snippetHeaderLabel}>DOCUMENT EXCERPT</Text>
          </View>
          <View style={styles.snippetQuoteBox}>
            <Text style={styles.snippetText}>"{source.snippet}"</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: spacing[14],
    padding: spacing[14],
    backgroundColor: colors.background,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[10],
  },
  titleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
    paddingRight: spacing[8],
  },
  shieldIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primarySoftStrong,
  },
  label: {
    fontSize: typography.fontSize[10.5],
    fontWeight: typography.fontWeight.extraBold,
    color: colors.primary,
    letterSpacing: typography.letterSpacing[0.5],
  },
  sublabel: {
    fontSize: typography.fontSize[10.5],
    color: colors.textMuted,
    fontWeight: typography.fontWeight.medium,
    marginTop: spacing[1],
  },
  expandToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[4],
    borderRadius: 8,
  },
  expandToggleText: {
    fontSize: typography.fontSize[11],
    fontFamily: typography.fontFamily.bold,
    color: colors.primary,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[7],
    marginTop: spacing[2],
  },
  chipDocument: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[5],
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing[9],
    paddingVertical: spacing[4],
    borderRadius: 8,
    maxWidth: '100%',
  },
  chipDocumentText: {
    fontSize: typography.fontSize[11.5],
    fontWeight: typography.fontWeight.semiBold,
    color: colors.textSecondary,
  },
  chipPage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing[9],
    paddingVertical: spacing[4],
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  chipPageText: {
    fontSize: typography.fontSize[11.5],
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
  chipSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[5],
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing[9],
    paddingVertical: spacing[4],
    borderRadius: 8,
    maxWidth: '100%',
  },
  chipSectionText: {
    fontSize: typography.fontSize[11.5],
    fontWeight: typography.fontWeight.semiBold,
    color: colors.textSecondary,
  },
  snippetContainer: {
    marginTop: spacing[12],
    paddingTop: spacing[10],
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  snippetHeaderRow: {
    marginBottom: spacing[6],
  },
  snippetHeaderLabel: {
    fontSize: typography.fontSize[10],
    fontWeight: typography.fontWeight.extraBold,
    color: colors.textMuted,
    letterSpacing: typography.letterSpacing[0.5],
  },
  snippetQuoteBox: {
    backgroundColor: colors.surface,
    padding: spacing[12],
    borderRadius: 10,
    borderLeftWidth: 3.5,
    borderLeftColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  snippetText: {
    fontSize: typography.fontSize[12.5],
    fontStyle: 'italic',
    color: colors.textSecondary,
    lineHeight: typography.lineHeight[19],
  },
});
