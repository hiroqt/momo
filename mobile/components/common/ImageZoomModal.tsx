import React from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  Platform,
  StatusBar,
} from 'react-native';
import { AppText as Text } from './app-text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Cancel01Icon, SparklesIcon } from '@hugeicons/core-free-icons';
import { typography } from '@/constants/theme';

interface ImageZoomModalProps {
  visible: boolean;
  onClose: () => void;
  imageBase64?: string | null;
  title?: string;
  caption?: string;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const ImageZoomModal: React.FC<ImageZoomModalProps> = ({
  visible,
  onClose,
  imageBase64,
  title = 'Educational Diagram',
  caption,
}) => {
  const insets = useSafeAreaInsets();

  if (!visible || !imageBase64) return null;

  const isJpeg = imageBase64.startsWith('/9j/') || imageBase64.startsWith('/9j');
  const mime = isJpeg ? 'image/jpeg' : 'image/png';
  const imageUri =
    imageBase64.startsWith('data:') || imageBase64.startsWith('http')
      ? imageBase64
      : `data:${mime};base64,${imageBase64}`;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <View style={styles.backdrop}>
        {/* Top Header */}
        <View
          style={[
            styles.header,
            { paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 44 : 20) + 12 },
          ]}
        >
          <View style={styles.headerLeft}>
            <View style={styles.badge}>
              <HugeiconsIcon icon={SparklesIcon} size={13} color="#D6BBFB" />
              <Text style={styles.badgeText}>MOMO VISUAL AID</Text>
            </View>
            <Text style={styles.titleText} numberOfLines={1}>
              {title}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.8}
            accessibilityLabel="Close image preview"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={20} color="#FFFFFF" strokeWidth={2.4} />
          </TouchableOpacity>
        </View>

        {/* Center Image Container */}
        <TouchableOpacity
          style={styles.imageWrapper}
          activeOpacity={1}
          onPress={onClose}
        >
          <View style={styles.imageCard}>
            <Image
              source={{ uri: imageUri }}
              style={styles.image}
              resizeMode="contain"
            />
          </View>
        </TouchableOpacity>

        {/* Bottom Caption */}
        {caption ? (
          <View
            style={[
              styles.footer,
              { paddingBottom: Math.max(insets.bottom, 20) + 12 },
            ]}
          >
            <Text style={styles.captionText}>{caption}</Text>
          </View>
        ) : (
          <View style={{ height: Math.max(insets.bottom, 20) + 12 }} />
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.12)',
  },
  headerLeft: {
    flex: 1,
    marginRight: 16,
    gap: 4,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(127, 86, 217, 0.3)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(214, 187, 251, 0.3)',
  },
  badgeText: {
    fontSize: 10,
    fontFamily: typography.fontFamily.bold,
    color: '#D6BBFB',
    letterSpacing: 0.5,
  },
  titleText: {
    fontSize: 16,
    fontFamily: typography.fontFamily.bold,
    color: '#FFFFFF',
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  imageWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  imageCard: {
    width: '100%',
    maxWidth: Math.min(SCREEN_WIDTH - 32, 540),
    height: Math.min(SCREEN_HEIGHT * 0.55, 480),
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#7F56D9',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(214, 187, 251, 0.5)',
  },
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: '#FFFFFF',
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    alignItems: 'center',
  },
  captionText: {
    fontSize: 13,
    fontFamily: typography.fontFamily.medium,
    color: '#E4E7EC',
    textAlign: 'center',
    lineHeight: 18,
  },
});
