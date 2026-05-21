import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  SafeAreaView, StatusBar, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAppSettings } from '@/context/AppSettingsContext';
import { useNotifications, AppNotification, NotificationCategory } from '@/context/NotificationContext';

const YELLOW = '#FFC82C';

// ── Icon & color per category ──────────────────────────────────────────────
const CATEGORY_META: Record<NotificationCategory, { icon: string; color: string; bg: string }> = {
  ride:    { icon: 'car',                  color: '#1565C0', bg: '#E3F2FD' },
  payment: { icon: 'wallet',               color: '#2E7D32', bg: '#E8F5E9' },
  safety:  { icon: 'shield-checkmark',     color: '#C62828', bg: '#FFEBEE' },
  promo:   { icon: 'pricetag',             color: '#E65100', bg: '#FFF3E0' },
  system:  { icon: 'notifications-circle', color: '#6A1B9A', bg: '#F3E5F5' },
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)  return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function NotifItem({ item, onPress }: { item: AppNotification; onPress: () => void }) {
  const meta = CATEGORY_META[item.category];
  return (
    <TouchableOpacity
      style={[styles.item, !item.read && styles.itemUnread]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {/* Unread dot */}
      {!item.read && <View style={styles.unreadDot} />}

      {/* Icon */}
      <View style={[styles.iconWrap, { backgroundColor: meta.bg }]}>
        <Ionicons name={meta.icon as any} size={22} color={meta.color} />
      </View>

      {/* Text */}
      <View style={styles.textBlock}>
        <Text style={[styles.title, !item.read && styles.titleUnread]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.body} numberOfLines={2}>{item.body}</Text>
        <Text style={styles.time}>{timeAgo(item.timestamp)}</Text>
      </View>

      {item.actionRoute && (
        <Ionicons name="chevron-forward" size={16} color="#AAAAAA" style={{ marginTop: 2 }} />
      )}
    </TouchableOpacity>
  );
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppSettings();
  const { notifications, unreadCount, markRead, markAllRead, clearAll } = useNotifications();

  const handlePress = (item: AppNotification) => {
    markRead(item.id);
    if (item.actionRoute) {
      router.push(item.actionRoute as any);
    }
  };

  const handleClearAll = () => {
    Alert.alert('Clear all notifications?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: clearAll },
    ]);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Notifications</Text>
        <View style={styles.headerActions}>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={markAllRead} style={styles.actionBtn}>
              <Text style={styles.actionTxt}>Mark all read</Text>
            </TouchableOpacity>
          )}
          {notifications.length > 0 && (
            <TouchableOpacity onPress={handleClearAll} style={styles.actionBtn}>
              <Ionicons name="trash-outline" size={18} color="#FF4444" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category filter bar (visual grouping — future: filter by category) */}
      {notifications.length > 0 && (
        <View style={[styles.filterBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          {(['ride', 'payment', 'safety', 'promo', 'system'] as NotificationCategory[]).map(cat => {
            const m = CATEGORY_META[cat];
            const count = notifications.filter(n => n.category === cat && !n.read).length;
            return (
              <View key={cat} style={styles.filterChip}>
                <Ionicons name={m.icon as any} size={14} color={m.color} />
                {count > 0 && (
                  <View style={[styles.chipBadge, { backgroundColor: m.color }]}>
                    <Text style={styles.chipBadgeTxt}>{count}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      <FlatList
        data={notifications}
        keyExtractor={item => item.id}
        contentContainerStyle={notifications.length === 0 ? styles.emptyContainer : styles.listContent}
        ItemSeparatorComponent={() => <View style={[styles.sep, { backgroundColor: colors.border }]} />}
        renderItem={({ item }) => <NotifItem item={item} onPress={() => handlePress(item)} />}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="notifications-off-outline" size={64} color="#CCCCCC" />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No notifications</Text>
            <Text style={[styles.emptyBody, { color: colors.subText }]}>
              Ride updates, payment confirmations and safety alerts will appear here.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:         { flex: 1 },
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1 },
  backBtn:      { padding: 6, marginRight: 6 },
  headerTitle:  { flex: 1, fontSize: 18, fontWeight: '700' },
  headerActions:{ flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionBtn:    { padding: 6 },
  actionTxt:    { fontSize: 13, color: '#FFC82C', fontWeight: '600' },

  filterBar:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: 1 },
  filterChip:   { position: 'relative', padding: 6 },
  chipBadge:    { position: 'absolute', top: 0, right: 0, minWidth: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  chipBadgeTxt: { fontSize: 9, color: '#fff', fontWeight: '700' },

  listContent:  { paddingBottom: 32 },
  emptyContainer:{ flex: 1 },

  sep:          { height: 1, marginLeft: 76 },
  item:         { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingVertical: 14, position: 'relative', backgroundColor: 'transparent' },
  itemUnread:   { backgroundColor: 'rgba(255, 200, 44, 0.06)' },
  unreadDot:    { position: 'absolute', left: 6, top: 20, width: 6, height: 6, borderRadius: 3, backgroundColor: YELLOW },
  iconWrap:     { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginRight: 12, flexShrink: 0 },
  textBlock:    { flex: 1 },
  title:        { fontSize: 14, fontWeight: '500', color: '#555', marginBottom: 3 },
  titleUnread:  { fontWeight: '700', color: '#1A1A1A' },
  body:         { fontSize: 13, color: '#777', lineHeight: 18, marginBottom: 4 },
  time:         { fontSize: 11, color: '#AAAAAA' },

  emptyWrap:    { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 120, paddingHorizontal: 40 },
  emptyTitle:   { fontSize: 18, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  emptyBody:    { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
