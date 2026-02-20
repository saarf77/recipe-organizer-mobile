import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';

function SkeletonBox({ style }: { style?: object }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 1000 }), -1, true);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      ['#e2e8f0', '#f1f5f9']
    ),
  }));

  return <Animated.View style={[styles.base, style, animatedStyle]} />;
}

export default function SkeletonCard() {
  return (
    <View style={styles.card}>
      <SkeletonBox style={styles.image} />
      <View style={styles.content}>
        <SkeletonBox style={styles.title} />
        <SkeletonBox style={styles.subtitle} />
        <SkeletonBox style={styles.meta} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: 200, borderRadius: 16, overflow: 'hidden', backgroundColor: '#ffffff', marginRight: 12 },
  image: { width: '100%', height: 130, borderRadius: 0 },
  content: { padding: 12, gap: 8 },
  title: { height: 16, width: '85%', borderRadius: 8 },
  subtitle: { height: 12, width: '60%', borderRadius: 8 },
  meta: { height: 12, width: '40%', borderRadius: 8 },
  base: { borderRadius: 8 },
});
