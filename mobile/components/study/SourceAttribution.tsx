import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
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
            <HugeiconsIcon icon={Shield01Icon} size={14} color="#4F46E5" strokeWidth={2.4} />
          </View>
          <View>
            <Text style={styles.label}>GROUNDED SOURCE CITATION</Text>
            <Text style={styles.sublabel}>Verified directly against your material</Text>
          </View>
        </View>
        <View style={styles.expandToggleRow}>
          <Text style={styles.expandToggleText}>{expanded ? 'Hide Excerpt' : 'View Excerpt'}</Text>
          <HugeiconsIcon
            icon={expanded ? ArrowUp01Icon : ArrowDown01Icon}
            size={14}
            color="#6366F1"
            strokeWidth={2.4}
          />
        </View>
      </TouchableOpacity>

      {/* Grounding Chips */}
      <View style={styles.chipsRow}>
        {source.document_name ? (
          <View style={styles.chipDocument}>
            <HugeiconsIcon icon={File01Icon} size={13} color="#475569" strokeWidth={2.2} />
            <Text style={styles.chipDocumentText} numberOfLines={1}>
              {source.document_name}
            </Text>
          </View>
        ) : null}

        {source.page ? (
          <View style={styles.chipPage}>
            <HugeiconsIcon icon={BookOpen01Icon} size={12} color="#4F46E5" strokeWidth={2.2} />
            <Text style={styles.chipPageText}>Page {source.page}</Text>
          </View>
        ) : null}

        {source.section ? (
          <View style={styles.chipSection}>
            <HugeiconsIcon icon={Layers01Icon} size={12} color="#475569" strokeWidth={2} />
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
    marginTop: 14,
    padding: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shieldIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  label: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#4F46E5',
    letterSpacing: 0.5,
  },
  sublabel: {
    fontSize: 10.5,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 1,
  },
  expandToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  expandToggleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 2,
  },
  chipDocument: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    maxWidth: '100%',
  },
  chipDocumentText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#334155',
  },
  chipPage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  chipPageText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#4F46E5',
  },
  chipSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    maxWidth: '100%',
  },
  chipSectionText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#475569',
  },
  snippetContainer: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  snippetHeaderRow: {
    marginBottom: 6,
  },
  snippetHeaderLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  snippetQuoteBox: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 10,
    borderLeftWidth: 3.5,
    borderLeftColor: '#4F46E5',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  snippetText: {
    fontSize: 12.5,
    fontStyle: 'italic',
    color: '#334155',
    lineHeight: 19,
  },
});
