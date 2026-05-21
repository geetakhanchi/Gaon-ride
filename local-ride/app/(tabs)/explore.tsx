import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, StatusBar, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { fetchRideHistory, deleteRide } from '@/services/api';
import { useAppSettings } from '@/context/AppSettingsContext';
import { t } from '@/translations';

const YELLOW = '#FFC82C';
const GREEN  = '#4CAF50';
const RED    = '#FF3B30';

// Map rideType (from DB enum) → display icon + color
const RIDE_TYPE_META: Record<string, { icon: string; color: string }> = {
  bike:        { icon: 'motorbike',    color: '#BF360C' },
  auto:        { icon: 'rickshaw',     color: '#2E7D32' },
  private_car: { icon: 'car-hatchback',color: '#1565C0' },
  bike_taxi:   { icon: 'moped',       color: '#6A1B9A' },
  jeep:        { icon: 'car-estate',  color: '#E65100' },
  private_bus: { icon: 'van-utility', color: '#283593' },
  govt_bus:    { icon: 'bus',          color: '#00695C' },
  car_taxi:    { icon: 'taxi',         color: '#AD1457' },
};
const getMeta = (rideType: string) =>
  RIDE_TYPE_META[rideType] ?? { icon: 'car', color: '#757575' };

const getRideId = (ride: any): string => ride._id ?? ride.id ?? '';

const DEFAULT_RIDES = [
  {
    _id: 'd1', rideType: 'bike', date: '25 Apr · 10:30 AM',
    pickup: 'Sector 18, Noida', dropoff: 'Connaught Place, Delhi',
    fare: '₹245', duration: '45 min', rating: 4.8, status: 'completed',
  },
  {
    _id: 'd2', rideType: 'auto', date: '24 Apr · 2:15 PM',
    pickup: 'Model Town, Panipat', dropoff: 'GT Road, Panipat',
    fare: '₹85', duration: '12 min', rating: 4.5, status: 'completed',
  },
];

export default function RidesScreen() {
  const { colors, isDark, language } = useAppSettings();
  const lang = language.code;
  const s = makeStyles(colors, isDark);

  const [rides, setRides]           = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected]     = useState<Set<string>>(new Set());
  const [deleting, setDeleting]     = useState(false);

  React.useEffect(() => { loadRides(); }, []);

  const loadRides = async () => {
    setLoading(true); setError(null);
    try {
      const data = await fetchRideHistory('user-001');
      setRides(data?.length > 0 ? data : []);
    } catch (err: any) {
      const msg = err?.message ?? 'Unknown error';
      setError(`Could not reach server (${msg}). Showing sample data.`);
      setRides(DEFAULT_RIDES);
    } finally { setLoading(false); }
  };

  // ── Selection ──────────────────────────────────────────────────────────────
  const enterSelectMode = useCallback((id: string) => {
    setSelectMode(true);
    setSelected(new Set([id]));
  }, []);

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelected(new Set());
  }, []);

  const toggleItem = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handlePress = useCallback((id: string) => {
    if (selectMode) toggleItem(id);
  }, [selectMode, toggleItem]);

  const allSelected = rides.length > 0 && selected.size === rides.length;

  const toggleSelectAll = useCallback(() => {
    setSelected(allSelected ? new Set() : new Set(rides.map(getRideId)));
  }, [allSelected, rides]);

  // ── Delete ─────────────────────────────────────────────────────────────────
  const confirmDeleteSingle = useCallback((id: string, rideType: string) => {
    Alert.alert(
      'Delete Ride',
      `Remove this ${rideType.replace(/_/g, ' ')} ride from history?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await deleteRide(id);
              setRides(prev => prev.filter(r => getRideId(r) !== id));
            } catch {
              Alert.alert('Error', 'Could not delete this ride. Please try again.');
            }
          },
        },
      ],
    );
  }, []);

  const confirmDeleteSelected = useCallback(() => {
    const count = selected.size;
    Alert.alert(
      `Delete ${count} Ride${count > 1 ? 's' : ''}`,
      `Remove ${count} ride${count > 1 ? 's' : ''} from history? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Delete ${count}`, style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              const ids = Array.from(selected);
              await Promise.all(ids.map(id => deleteRide(id).catch(() => null)));
              setRides(prev => prev.filter(r => !selected.has(getRideId(r))));
              exitSelectMode();
            } catch {
              Alert.alert('Error', 'Some rides could not be deleted.');
            } finally { setDeleting(false); }
          },
        },
      ],
    );
  }, [selected, exitSelectMode]);

  // ── Row ────────────────────────────────────────────────────────────────────
  const renderRide = useCallback(({ item }: { item: any }) => {
    const id          = getRideId(item);
    const meta        = getMeta(item.rideType);
    const isSelected  = selected.has(id);
    const statusColor = item.status === 'cancelled' ? RED : GREEN;

    return (
      <TouchableOpacity
        style={[s.row, isSelected && s.rowSelected]}
        onPress={() => handlePress(id)}
        onLongPress={() => { if (!selectMode) enterSelectMode(id); }}
        activeOpacity={0.7}
        delayLongPress={350}
      >
        {/* Left: checkbox or icon */}
        {selectMode ? (
          <View style={[s.checkbox, isSelected && s.checkboxActive]}>
            {isSelected && <Ionicons name="checkmark" size={14} color="#1A1A1A" />}
          </View>
        ) : (
          <View style={s.iconBox}>
            <MaterialCommunityIcons name={meta.icon as any} size={22} color={meta.color} />
          </View>
        )}

        {/* Centre: ride details */}
        <View style={s.rowBody}>
          <View style={s.rowTop}>
            <Text style={s.rideTypeTxt}>
              {item.rideType ? t(item.rideType as any, lang) : 'Ride'}
            </Text>
            <View style={[s.statusPill, { backgroundColor: statusColor + '18' }]}>
              <View style={[s.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[s.statusTxt, { color: statusColor }]}>
                {item.status ?? 'completed'}
              </Text>
            </View>
          </View>

          <Text style={s.dateTxt}>{item.date}</Text>

          <View style={s.routeWrap}>
            <View style={s.routeLine}>
              <View style={s.dotGreen} />
              <View style={s.routeConnector} />
              <View style={s.dotRed} />
            </View>
            <View style={s.routeLabels}>
              <Text style={s.routeTxt} numberOfLines={1}>{item.pickup}</Text>
              <Text style={s.routeTxt} numberOfLines={1}>{item.dropoff}</Text>
            </View>
          </View>

          <View style={s.fareRow}>
            <Text style={s.fareTxt}>{item.fare}</Text>
            <Text style={s.dotSep}>·</Text>
            <Ionicons name="time-outline" size={12} color={colors.subText} />
            <Text style={s.durationTxt}>{item.duration}</Text>
            {item.rating > 0 && (
              <>
                <Text style={s.dotSep}>·</Text>
                <Ionicons name="star" size={11} color={YELLOW} />
                <Text style={s.ratingTxt}>{item.rating}</Text>
              </>
            )}
          </View>
        </View>

        {/* Right: trash (normal mode only) */}
        {!selectMode && (
          <TouchableOpacity
            style={s.deleteBtn}
            onPress={() => confirmDeleteSingle(id, item.rideType ?? 'ride')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="trash-outline" size={18} color={colors.subText} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  }, [selectMode, selected, handlePress, enterSelectMode, confirmDeleteSingle, colors, lang]);

  // ── Header ─────────────────────────────────────────────────────────────────
  const renderHeader = () => {
    if (selectMode) {
      return (
        <View style={[s.header, s.selectHeader]}>
          <TouchableOpacity style={s.selectAllBtn} onPress={toggleSelectAll}>
            <View style={[s.checkbox, allSelected && s.checkboxActive]}>
              {allSelected && <Ionicons name="checkmark" size={14} color="#1A1A1A" />}
            </View>
            <Text style={s.selectAllTxt}>{allSelected ? 'Deselect all' : 'Select all'}</Text>
          </TouchableOpacity>

          <Text style={s.selectedCount}>
            {selected.size > 0 ? `${selected.size} selected` : 'Tap to select'}
          </Text>

          <View style={s.selectActions}>
            {selected.size > 0 && (
              <TouchableOpacity
                style={s.bulkDeleteBtn}
                onPress={confirmDeleteSelected}
                disabled={deleting}
              >
                {deleting
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name="trash" size={16} color="#fff" />
                }
                <Text style={s.bulkDeleteTxt}>
                  {deleting ? 'Deleting…' : `Delete (${selected.size})`}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={s.cancelBtn} onPress={exitSelectMode}>
              <Ionicons name="close" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>
      );
    }
    return (
      <View style={s.header}>
        <Text style={s.headerTitle}>{t('ride_history', lang)}</Text>
        <TouchableOpacity onPress={loadRides} style={s.refreshBtn}>
          <Ionicons name="refresh" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {renderHeader()}

      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator size="large" color={YELLOW} />
          <Text style={s.subText}>{t('loading_rides', lang)}</Text>
        </View>
      ) : error && rides.length === 0 ? (
        <View style={s.centered}>
          <Ionicons name="alert-circle-outline" size={48} color={RED} />
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={loadRides}>
            <Text style={s.retryBtnText}>{t('retry', lang)}</Text>
          </TouchableOpacity>
        </View>
      ) : rides.length === 0 ? (
        <View style={s.centered}>
          <Ionicons name="car-outline" size={64} color={colors.subText} />
          <Text style={s.emptyTitle}>{t('no_rides_yet', lang)}</Text>
          <Text style={s.emptySub}>Your completed rides will appear here</Text>
        </View>
      ) : (
        <>
          {error && (
            <View style={s.errorBanner}>
              <Ionicons name="information-circle-outline" size={16} color={YELLOW} />
              <Text style={s.errorBannerTxt}>{error}</Text>
            </View>
          )}
          {!selectMode && (
            <Text style={s.hintTxt}>Long-press any ride to select</Text>
          )}
          <FlatList
            data={rides}
            keyExtractor={(item, index) => item._id ?? item.id ?? String(index)}
            renderItem={renderRide}
            contentContainerStyle={s.listContent}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={s.separator} />}
          />
        </>
      )}
    </SafeAreaView>
  );
}

const makeStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    safe:           { flex: 1, backgroundColor: colors.bg },

    // Normal header
    header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                      paddingHorizontal: 16, paddingVertical: 14,
                      borderBottomWidth: 1, borderBottomColor: colors.border,
                      backgroundColor: colors.card },
    headerTitle:    { fontSize: 22, fontWeight: '700', color: colors.text },
    refreshBtn:     { padding: 8 },

    // Selection header
    selectHeader:   { paddingVertical: 10, minHeight: 56 },
    selectAllBtn:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
    selectAllTxt:   { fontSize: 13, color: colors.text, fontWeight: '500' },
    selectedCount:  { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text, textAlign: 'center' },
    selectActions:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
    bulkDeleteBtn:  { flexDirection: 'row', alignItems: 'center', gap: 6,
                      backgroundColor: RED, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
    bulkDeleteTxt:  { color: '#fff', fontSize: 13, fontWeight: '600' },
    cancelBtn:      { padding: 6 },

    // Checkbox
    checkbox:       { width: 22, height: 22, borderRadius: 6, borderWidth: 2,
                      borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
    checkboxActive: { backgroundColor: YELLOW, borderColor: YELLOW },

    // List
    listContent:    { paddingBottom: 24 },
    separator:      { height: 1, backgroundColor: colors.border, marginLeft: 72 },
    hintTxt:        { textAlign: 'center', fontSize: 11, color: colors.subText,
                      paddingVertical: 5, backgroundColor: colors.card,
                      borderBottomWidth: 1, borderBottomColor: colors.border },

    // Row
    row:            { flexDirection: 'row', alignItems: 'center',
                      paddingHorizontal: 16, paddingVertical: 14,
                      backgroundColor: colors.card },
    rowSelected:    { backgroundColor: isDark ? '#2C2B18' : '#FFFDE7' },
    iconBox:        { width: 44, height: 44, borderRadius: 12,
                      alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    rowBody:        { flex: 1, gap: 4 },
    rowTop:         { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    rideTypeTxt:    { fontSize: 15, fontWeight: '700', color: colors.text },
    statusPill:     { flexDirection: 'row', alignItems: 'center', gap: 4,
                      paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
    statusDot:      { width: 6, height: 6, borderRadius: 3 },
    statusTxt:      { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
    dateTxt:        { fontSize: 12, color: colors.subText },

    // Route
    routeWrap:      { flexDirection: 'row', alignItems: 'stretch', gap: 10, marginVertical: 2 },
    routeLine:      { alignItems: 'center', paddingVertical: 2 },
    dotGreen:       { width: 9, height: 9, borderRadius: 5, backgroundColor: GREEN },
    routeConnector: { width: 2, flex: 1, minHeight: 10, backgroundColor: colors.border, marginVertical: 2 },
    dotRed:         { width: 9, height: 9, borderRadius: 5, backgroundColor: RED },
    routeLabels:    { flex: 1, justifyContent: 'space-between', gap: 6 },
    routeTxt:       { fontSize: 13, color: colors.subText },

    // Fare row
    fareRow:        { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
    fareTxt:        { fontSize: 14, fontWeight: '700', color: colors.text },
    dotSep:         { fontSize: 12, color: colors.subText },
    durationTxt:    { fontSize: 12, color: colors.subText },
    ratingTxt:      { fontSize: 12, fontWeight: '600', color: colors.text },
    deleteBtn:      { padding: 10, marginLeft: 4 },

    // Error banner (shown when fallback data used)
    errorBanner:    { flexDirection: 'row', alignItems: 'center', gap: 8,
                      backgroundColor: isDark ? '#2A1F00' : '#FFF8E1',
                      paddingHorizontal: 16, paddingVertical: 8,
                      borderBottomWidth: 1, borderBottomColor: colors.border },
    errorBannerTxt: { flex: 1, fontSize: 12, color: colors.subText },

    // States
    centered:       { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
    subText:        { marginTop: 12, fontSize: 14, color: colors.subText, textAlign: 'center' },
    errorText:      { marginTop: 12, fontSize: 14, color: colors.text, textAlign: 'center', marginBottom: 16 },
    retryBtn:       { backgroundColor: YELLOW, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
    retryBtnText:   { color: '#1A1A1A', fontWeight: 'bold', fontSize: 14 },
    emptyTitle:     { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: 16 },
    emptySub:       { fontSize: 14, color: colors.subText, marginTop: 8, textAlign: 'center' },
  });

