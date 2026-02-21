import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { Colors, Spacing, Radii, FontFamily, FontSize, Shadows } from '@/constants';

interface Props {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
}

export default function ConfirmModal({ visible, title, message, confirmLabel = 'Confirm', onConfirm, onCancel, destructive = false }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onCancel}>
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, destructive && styles.confirmBtnDestructive]}
              onPress={onConfirm}
            >
              <Text style={[styles.confirmText, destructive && styles.confirmTextDestructive]}>
                {confirmLabel}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing['2xl'],
  },
  sheet: {
    backgroundColor: Colors.bgWhite,
    borderRadius: Radii.xl,
    padding: Spacing.xl,
    width: '100%',
    maxWidth: 360,
    ...Shadows.elevated,
  },
  title: { fontSize: FontSize.lg.size, fontFamily: FontFamily.bold, color: Colors.textPrimary, marginBottom: Spacing.sm },
  message: { fontSize: FontSize.sm.size, fontFamily: FontFamily.regular, color: Colors.textSlate, lineHeight: FontSize.sm.lineHeight, marginBottom: Spacing.xl },
  actions: { flexDirection: 'row', gap: Spacing.sm + 2 },
  cancelBtn: {
    flex: 1, paddingVertical: 13, borderRadius: Radii.md,
    backgroundColor: Colors.bgMuted, alignItems: 'center',
  },
  cancelText: { fontSize: 15, fontFamily: FontFamily.semibold, color: Colors.textSecondary },
  confirmBtn: {
    flex: 1, paddingVertical: 13, borderRadius: Radii.md,
    backgroundColor: Colors.primaryBg, alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.primaryBorder,
  },
  confirmBtnDestructive: { backgroundColor: Colors.dangerBg, borderColor: Colors.dangerBorder },
  confirmText: { fontSize: 15, fontFamily: FontFamily.semibold, color: Colors.primary },
  confirmTextDestructive: { color: Colors.danger },
});
