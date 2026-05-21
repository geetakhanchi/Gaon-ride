/**
 * Home Screen — Gaon Ride
 * Google Maps (PROVIDER_GOOGLE) + real GPS + reverse-geocode + Places search
 * UX modelled on Rapido / Bolt: full-screen map with bottom-sheet booking panel
 */
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
  StatusBar, ActivityIndicator, Dimensions, TextInput, FlatList,
  Modal, Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { useAppSettings } from '@/context/AppSettingsContext';
import { useNotifications } from '@/context/NotificationContext';
import { t } from '@/translations';
import {
  fetchPlacePredictions,
  fetchPlaceDetails,
  reverseGeocode,
  isWithinIndia,
  INDIA_FALLBACK,
  PlacePrediction,
  PlaceDetail,
} from '@/services/googleMaps';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const YELLOW    = '#FFC82C';
const DARK      = '#0F0F0F';
const BORDER    = '#E0E0E0';
const SECONDARY = '#666';

// ─── Vehicle Data ────────────────────────────────────────────────────────────
interface VehicleOption {
  id: string;
  label: string;
  icon: string;
  color: string;
  fare: string;
}

// Ride → Share
const RIDE_SHARE: VehicleOption[] = [
  { id: 'rs_auto',     label: 'Auto',        icon: 'rickshaw',      color: '#2E7D32', fare: '₹60–90'   },
  { id: 'rs_car',      label: 'Car',         icon: 'car-hatchback', color: '#1565C0', fare: '₹120–160' },
  { id: 'rs_jeep',     label: 'Jeep',        icon: 'car-estate',    color: '#E65100', fare: '₹150–200' },
  { id: 'rs_pvt_bus',  label: 'Private Bus', icon: 'van-utility',   color: '#283593', fare: '₹200–300' },
  { id: 'rs_govt_bus', label: 'Govt Bus',    icon: 'bus',           color: '#00695C', fare: '₹50–100'  },
  { id: 'rs_bike',     label: 'Bike',        icon: 'motorbike',     color: '#BF360C', fare: '₹35–55'   },
];

// Ride → Rent
const RIDE_RENT: VehicleOption[] = [
  { id: 'rr_car',     label: 'Car',         icon: 'car-hatchback', color: '#1565C0', fare: '₹800/hr'  },
  { id: 'rr_jeep',    label: 'Jeep',        icon: 'car-estate',    color: '#E65100', fare: '₹1000/hr' },
  { id: 'rr_pvt_bus', label: 'Private Bus', icon: 'van-utility',   color: '#283593', fare: '₹3000/dy' },
  { id: 'rr_bike',    label: 'Bike',        icon: 'motorbike',     color: '#BF360C', fare: '₹200/hr'  },
];

// Cargo → Share
const CARGO_SHARE: VehicleOption[] = [
  { id: 'cs_trailer', label: 'Truck-Trailer', icon: 'truck-trailer', color: '#4E342E', fare: '₹5000+' },
  { id: 'cs_truck',   label: 'Truck',         icon: 'truck',         color: '#37474F', fare: '₹2000+' },
  { id: 'cs_tractor', label: 'Tractor',       icon: 'tractor',       color: '#558B2F', fare: '₹800+'  },
  { id: 'cs_car',     label: 'Car',           icon: 'car-hatchback', color: '#1565C0', fare: '₹300+'  },
  { id: 'cs_bike',    label: 'Bike',          icon: 'motorbike',     color: '#BF360C', fare: '₹80+'   },
  { id: 'cs_cycle',   label: 'Cycle',         icon: 'bicycle',       color: '#2E7D32', fare: '₹40+'   },
];

// Cargo → Rent
const CARGO_RENT: VehicleOption[] = [
  { id: 'cr_trailer', label: 'Truck-Trailer', icon: 'truck-trailer', color: '#4E342E', fare: '₹15000/dy' },
  { id: 'cr_truck',   label: 'Truck',         icon: 'truck',         color: '#37474F', fare: '₹8000/dy'  },
  { id: 'cr_tractor', label: 'Tractor',       icon: 'tractor',       color: '#558B2F', fare: '₹3000/dy'  },
  { id: 'cr_car',     label: 'Car',           icon: 'car-hatchback', color: '#1565C0', fare: '₹800/hr'   },
];

// All vehicles combined — used for map marker simulation
const ALL_VEHICLES: VehicleOption[] = [...RIDE_SHARE, ...RIDE_RENT, ...CARGO_SHARE, ...CARGO_RENT];

const SERVICES = [
  { id: 'rentals',   key: 'rentals',   icon: 'calendar-outline',  color: '#FF6B00' },
  { id: 'intercity', key: 'intercity', icon: 'trail-sign-outline', color: '#4CAF50' },
  { id: 'package',   key: 'package',   icon: 'cube-outline',       color: '#2196F3' },
  { id: 'scheduled', key: 'scheduled', icon: 'alarm-outline',      color: '#9C27B0' },
];

// ─── Nearby Vehicle Helpers ───────────────────────────────────────────────────
interface NearbyVehicle {
  id: string;
  rideTypeId: string;
  latitude: number;
  longitude: number;
  etaMin: number;     // minutes to pickup
  distanceKm: number;
  driverName: string;
  plate: string;
}

/** djb2 hash → deterministic pseudo-random float in [0,1) */
function _frand(seed: number): number {
  let s = (seed ^ 0xdeadbeef) >>> 0;
  s = Math.imul(s ^ (s >>> 16), 0x45d9f3b) >>> 0;
  s = Math.imul(s ^ (s >>> 16), 0x45d9f3b) >>> 0;
  return (s >>> 0) / 4294967296;
}

const _DRIVER_NAMES = [
  'Ramesh K.','Sunil M.','Deepak P.','Anil S.','Rajesh T.',
  'Mohan B.','Vikas N.','Santosh G.','Pradeep V.','Dinesh C.',
  'Arjun L.','Manoj R.','Hemant D.','Bharat J.','Sanjay A.',
];
const _PLATES = [
  'UP32 AX 4421','UP70 BC 1234','UP78 CD 5678','UP41 EF 9012',
  'MH14 GH 3456','MH02 IJ 7890','DL01 KL 2345','RJ14 MN 6789',
  'GJ01 OP 1357','MP09 QR 2468','BR11 ST 3691','HR26 UV 4802',
  'UK07 WX 5913','CG04 YZ 6024','JH10 AB 7135',
];

/**
 * Generates deterministic nearby vehicles around a center coordinate.
 * Positions spread within ~0.5–2 km radius; each rideType has 1–2 vehicles.
 */
function generateNearbyVehicles(
  center: { latitude: number; longitude: number },
  filterTypeId: string | null,  // null = all types
): NearbyVehicle[] {
  const seed = Math.round(center.latitude * 1000 + center.longitude * 1000);
  const vehicles: NearbyVehicle[] = [];
  let idx = 0;
  for (const rt of ALL_VEHICLES) {
    if (filterTypeId && rt.id !== filterTypeId) continue;
    const count = filterTypeId ? 3 : (_frand(seed + idx * 17) > 0.4 ? 2 : 1);
    for (let i = 0; i < count; i++) {
      const r1 = _frand(seed + idx * 31 + i * 7);
      const r2 = _frand(seed + idx * 53 + i * 13);
      const angle = r1 * 2 * Math.PI;
      const dist  = 0.003 + r2 * 0.012; // ~0.3–1.4 km in degrees
      const lat   = center.latitude  + dist * Math.cos(angle);
      const lng   = center.longitude + dist * Math.sin(angle);
      const distKm = dist * 111;
      const eta    = Math.round(distKm / 0.4 * 1.2);  // ~25 km/h avg
      const nIdx   = (seed + idx * 7 + i * 3) % _DRIVER_NAMES.length;
      const pIdx   = (seed + idx * 11 + i * 5) % _PLATES.length;
      vehicles.push({
        id:         `v-${rt.id}-${i}`,
        rideTypeId: rt.id,
        latitude:   lat,
        longitude:  lng,
        etaMin:     Math.max(1, eta),
        distanceKm: Math.round(distKm * 10) / 10,
        driverName: _DRIVER_NAMES[nIdx],
        plate:      _PLATES[pIdx],
      });
      idx++;
    }
  }
  return vehicles;
}

// ─── Map Picker Modal ─────────────────────────────────────────────────────────
interface MapPickerModalProps {
  visible: boolean;
  mode: 'pickup' | 'destination';
  initialCoords: { latitude: number; longitude: number } | null;
  onConfirm: (detail: PlaceDetail) => void;
  onClose: () => void;
  colors: any;
}

function MapPickerModal({ visible, mode, initialCoords, onConfirm, onClose, colors }: MapPickerModalProps) {
  const fallback = INDIA_FALLBACK;
  const center   = initialCoords ?? fallback;
  const [pin, setPin]         = useState(center);
  const [label, setLabel]     = useState('');
  const [loading, setLoading] = useState(false);
  const mapRef2 = useRef<MapView>(null);
  const accentColor = mode === 'pickup' ? '#4CAF50' : '#F44336';

  useEffect(() => {
    if (visible) {
      const c = initialCoords ?? INDIA_FALLBACK;
      setPin(c);
      setLabel('');
    }
  }, [visible]);

  const onRegionChangeComplete = async (region: Region) => {
    const coords = { latitude: region.latitude, longitude: region.longitude };
    setPin(coords);
    setLoading(true);
    const geo = await reverseGeocode(region.latitude, region.longitude);
    setLabel(geo?.subLocality
      ? `${geo.subLocality}, ${geo.locality}`
      : geo?.formattedAddress ?? `${region.latitude.toFixed(5)}, ${region.longitude.toFixed(5)}`);
    setLoading(false);
  };

  const handleConfirm = () => {
    onConfirm({
      placeId: `map_${pin.latitude}_${pin.longitude}`,
      name: label || 'Selected location',
      formattedAddress: label || `${pin.latitude.toFixed(5)}, ${pin.longitude.toFixed(5)}`,
      lat: pin.latitude,
      lng: pin.longitude,
    });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <StatusBar barStyle="dark-content" />
        {/* Header */}
        <View style={[mpStyles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={mpStyles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[mpStyles.title, { color: colors.text }]}>
            {mode === 'pickup' ? 'Set Pickup on Map' : 'Set Destination on Map'}
          </Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Map */}
        <View style={{ flex: 1 }}>
          <MapView
            ref={mapRef2}
            provider={PROVIDER_GOOGLE}
            style={StyleSheet.absoluteFillObject}
            initialRegion={{ ...center, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
            showsUserLocation
            showsMyLocationButton={false}
            showsCompass={false}
            onRegionChangeComplete={onRegionChangeComplete}
          />
          {/* Fixed centre pin */}
          <View style={mpStyles.pinWrap} pointerEvents="none">
            <View style={[mpStyles.pinCircle, { backgroundColor: accentColor }]}>
              <Ionicons name={mode === 'pickup' ? 'radio-button-on' : 'location'} size={20} color="#fff" />
            </View>
            <View style={[mpStyles.pinTail, { backgroundColor: accentColor }]} />
            <View style={[mpStyles.pinShadow, { backgroundColor: accentColor + '30' }]} />
          </View>
        </View>

        {/* Bottom confirm bar */}
        <View style={[mpStyles.bottomBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <View style={[mpStyles.labelRow, { backgroundColor: colors.bg, borderColor: colors.border }]}>
            <Ionicons name="location-outline" size={18} color={accentColor} />
            {loading
              ? <ActivityIndicator size="small" color={accentColor} style={{ marginLeft: 8 }} />
              : <Text style={[mpStyles.labelTxt, { color: colors.text }]} numberOfLines={2}>
                  {label || 'Move map to set location'}
                </Text>
            }
          </View>
          <TouchableOpacity
            style={[mpStyles.confirmBtn, { backgroundColor: accentColor }]}
            onPress={handleConfirm}
            disabled={loading || !label}
            activeOpacity={0.85}
          >
            <Text style={mpStyles.confirmTxt}>Confirm {mode === 'pickup' ? 'Pickup' : 'Drop'}</Text>
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const mpStyles = StyleSheet.create({
  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1 },
  backBtn:    { padding: 6 },
  title:      { fontSize: 16, fontWeight: '700' },
  pinWrap:    { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  pinCircle:  { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#fff', shadowColor: '#000', shadowOpacity: 0.3, shadowOffset: { width: 0, height: 3 }, shadowRadius: 6, elevation: 8, marginBottom: -4 },
  pinTail:    { width: 3, height: 14, borderRadius: 2 },
  pinShadow:  { width: 20, height: 8, borderRadius: 10, marginTop: -2 },
  bottomBar:  { paddingHorizontal: 16, paddingVertical: 14, paddingBottom: 20, borderTopWidth: 1, gap: 12 },
  labelRow:   { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  labelTxt:   { flex: 1, fontSize: 14, fontWeight: '500' },
  confirmBtn: { borderRadius: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  confirmTxt: { fontSize: 16, fontWeight: '700', color: '#fff' },
});

// ─── Location Search Modal ────────────────────────────────────────────────────
interface LocationSearchModalProps {
  visible: boolean;
  mode: 'pickup' | 'destination';
  initialValue: string;
  onSelect: (detail: PlaceDetail) => void;
  onPickOnMap: () => void;
  onClose: () => void;
  colors: any;
}

function LocationSearchModal({ visible, mode, initialValue, onSelect, onPickOnMap, onClose, colors }: LocationSearchModalProps) {
  const [query, setQuery]             = useState(initialValue);
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [loading, setLoading]         = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef    = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setQuery(initialValue);
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [visible, initialValue]);

  useEffect(() => {
    if (!query.trim()) { setPredictions([]); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const preds = await fetchPlacePredictions(query);
      setPredictions(preds);
      setLoading(false);
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const handleSelect = async (pred: PlacePrediction) => {
    Keyboard.dismiss();
    const detail = await fetchPlaceDetails(pred.placeId);
    if (detail) onSelect(detail);
    else Alert.alert('Error', 'Could not load place details. Try again.');
  };

  const isPickup    = mode === 'pickup';
  const accentColor = isPickup ? '#4CAF50' : '#F44336';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <StatusBar barStyle="dark-content" />
        {/* Header */}
        <View style={[lsStyles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={lsStyles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <View style={[lsStyles.inputWrap, { backgroundColor: colors.inputBg, borderColor: accentColor }]}>
            <View style={[lsStyles.dot, { backgroundColor: accentColor }]} />
            <TextInput
              ref={inputRef}
              style={[lsStyles.input, { color: colors.text }]}
              placeholder={isPickup ? 'Search pickup location…' : 'Search destination…'}
              placeholderTextColor={colors.subText}
              value={query}
              onChangeText={setQuery}
              clearButtonMode="while-editing"
              returnKeyType="search"
            />
            {loading && <ActivityIndicator size="small" color={accentColor} style={{ marginRight: 8 }} />}
          </View>
        </View>
        {/* Pick on Map button */}
        <TouchableOpacity
          style={[lsStyles.mapPickRow, { borderBottomColor: colors.border, backgroundColor: colors.card }]}
          onPress={onPickOnMap}
          activeOpacity={0.8}
        >
          <View style={[lsStyles.rowIcon, { backgroundColor: accentColor + '20' }]}>
            <Ionicons name="map-outline" size={20} color={accentColor} />
          </View>
          <View style={lsStyles.rowText}>
            <Text style={[lsStyles.mainTxt, { color: colors.text }]}>Pick on Map</Text>
            <Text style={[lsStyles.subTxt, { color: colors.subText }]}>Drag the pin to exact location</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.subText} />
        </TouchableOpacity>
        {/* Results */}
        <FlatList
          data={predictions}
          keyExtractor={item => item.placeId}
          keyboardShouldPersistTaps="always"
          ListEmptyComponent={
            query.trim() && !loading
              ? <Text style={[lsStyles.noResult, { color: colors.subText }]}>No results found</Text>
              : null
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={[lsStyles.row, { borderBottomColor: colors.border }]} onPress={() => handleSelect(item)}>
              <View style={[lsStyles.rowIcon, { backgroundColor: colors.iconBg }]}>
                <Ionicons name="location-outline" size={18} color={accentColor} />
              </View>
              <View style={lsStyles.rowText}>
                <Text style={[lsStyles.mainTxt, { color: colors.text }]} numberOfLines={1}>{item.mainText}</Text>
                <Text style={[lsStyles.subTxt,  { color: colors.subText }]} numberOfLines={1}>{item.secondaryText}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.border} />
            </TouchableOpacity>
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}

const lsStyles = StyleSheet.create({
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, gap: 10 },
  backBtn:     { padding: 6 },
  inputWrap:   { flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 2, paddingHorizontal: 10, height: 44, gap: 8 },
  dot:         { width: 10, height: 10, borderRadius: 5 },
  input:       { flex: 1, fontSize: 15, fontWeight: '500' },
  mapPickRow:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, gap: 12 },
  row:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, gap: 12 },
  rowIcon:     { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  rowText:     { flex: 1 },
  mainTxt:     { fontSize: 14, fontWeight: '600' },
  subTxt:   { fontSize: 12, marginTop: 2 },
  noResult: { textAlign: 'center', padding: 32, fontSize: 14 },
});

// ─── Trip Options ─────────────────────────────────────────────────────────────
type TripType = 'one_way' | 'round_trip' | 'schedule';

const TRIP_TYPES = [
  { id: 'one_way',    label: 'One Way',    icon: 'arrow-forward-outline' as const },
  { id: 'round_trip', label: 'Round Trip', icon: 'swap-horizontal-outline' as const },
  { id: 'schedule',   label: 'Schedule',   icon: 'time-outline' as const },
];

function formatScheduledDate(d: Date): string {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const dateStr =
    d.toDateString() === now.toDateString()       ? 'Today'
    : d.toDateString() === tomorrow.toDateString() ? 'Tomorrow'
    : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  const timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${dateStr}, ${timeStr}`;
}

// 5 AM → 10 PM (18 slots)
const SCHED_HOURS = Array.from({ length: 18 }, (_, i) => i + 5);

interface SchedulePickerProps {
  visible: boolean;
  title: string;
  onConfirm: (d: Date) => void;
  onClose: () => void;
  colors: any;
}

function SchedulePickerModal({ visible, title, onConfirm, onClose, colors }: SchedulePickerProps) {
  const today = new Date();
  const days  = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today); d.setDate(today.getDate() + i); return d;
  });
  const [selDay,  setSelDay]  = useState(0);
  const [selHour, setSelHour] = useState<number | null>(null);

  useEffect(() => { if (visible) { setSelDay(0); setSelHour(null); } }, [visible]);

  const confirm = () => {
    if (selHour === null) return;
    const d = new Date(days[selDay]);
    d.setHours(selHour, 0, 0, 0);
    onConfirm(d);
  };

  const dayLabel = (d: Date, i: number) =>
    i === 0 ? 'Today' : i === 1 ? 'Tomorrow'
    : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

  const hourLabel = (h: number) =>
    h === 12 ? '12 PM' : h < 12 ? `${h} AM` : `${h - 12} PM`;

  const isPast = (h: number) => selDay === 0 && h <= today.getHours();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={spm.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1}>
        <View style={[spm.sheet, { backgroundColor: colors.card }]}>
          {/* Header */}
          <View style={[spm.sheetHead, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={colors.text} /></TouchableOpacity>
            <Text style={[spm.sheetTitle, { color: colors.text }]}>{title}</Text>
            <TouchableOpacity onPress={confirm} disabled={selHour === null}>
              <Text style={[spm.sheetDone, selHour === null && { opacity: 0.35 }]}>Confirm</Text>
            </TouchableOpacity>
          </View>
          {/* Day pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={spm.dayRow}>
            {days.map((d, i) => (
              <TouchableOpacity
                key={i}
                style={[spm.dayChip, selDay === i && spm.dayChipOn, { borderColor: selDay === i ? YELLOW : colors.border }]}
                onPress={() => { setSelDay(i); setSelHour(null); }}
              >
                <Text style={[spm.dayTxt, { color: selDay === i ? DARK : colors.subText, fontWeight: selDay === i ? '800' : '600' }]}>
                  {dayLabel(d, i)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {/* Time grid */}
          <Text style={[spm.timeSectionLbl, { color: colors.subText }]}>Select Time</Text>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={spm.timeGrid}>
            {SCHED_HOURS.map(h => {
              const disabled = isPast(h);
              const active   = selHour === h;
              return (
                <TouchableOpacity
                  key={h}
                  disabled={disabled}
                  style={[spm.timeSlot, active && spm.timeSlotOn, disabled && spm.timeSlotOff, { backgroundColor: active ? YELLOW : colors.bg }]}
                  onPress={() => setSelHour(h)}
                >
                  <Text style={[spm.timeTxt, { color: active ? DARK : disabled ? colors.border : colors.text, fontWeight: active ? '800' : '600' }]}>
                    {hourLabel(h)}
                  </Text>
                </TouchableOpacity>
              );
            })}
            <View style={{ height: 8 }} />
          </ScrollView>
        </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const spm = StyleSheet.create({
  overlay:         { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet:           { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: SCREEN_H * 0.72, paddingBottom: 8 },
  sheetHead:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  sheetTitle:      { fontSize: 16, fontWeight: '700' },
  sheetDone:       { fontSize: 15, fontWeight: '700', color: YELLOW },
  dayRow:          { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  dayChip:         { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 22, borderWidth: 1.5 },
  dayChipOn:       { backgroundColor: YELLOW },
  dayTxt:          { fontSize: 13 },
  timeSectionLbl:  { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6, paddingHorizontal: 16, paddingTop: 2, paddingBottom: 8 },
  timeGrid:        { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 8, paddingBottom: 8 },
  timeSlot:        { width: (SCREEN_W - 56) / 4, paddingVertical: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1.5, borderColor: 'transparent' },
  timeSlotOn:      { borderColor: '#D4A017' },
  timeSlotOff:     { opacity: 0.3 },
  timeTxt:         { fontSize: 13 },
});

// ─── Main Home Screen ─────────────────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const { colors, language } = useAppSettings();
  const { unreadCount } = useNotifications();
  const lang = language.code;
  const s = makeStyles(colors);

  const mapRef = useRef<MapView>(null);
  const [selectedRide, setSelectedRide] = useState(RIDE_SHARE[0].id);
  const [mainSection,  setMainSection]  = useState<'ride' | 'cargo'>('ride');
  const [subSection,   setSubSection]   = useState<'share' | 'rent'>('share');

  // Pickup location state
  const [pickupCoords, setPickupCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [pickupLabel,  setPickupLabel]  = useState('Fetching your location…');
  const [pickupSub,    setPickupSub]    = useState('');
  const [locLoading,   setLocLoading]   = useState(true);

  // Destination state
  const [destDetail, setDestDetail] = useState<PlaceDetail | null>(null);

  // Search modal
  const [searchModal, setSearchModal] = useState<{ mode: 'pickup' | 'destination'; initialValue: string; isExtraStop?: boolean } | null>(null);
  // Map picker modal
  const [mapPicker, setMapPicker]     = useState<{ mode: 'pickup' | 'destination' } | null>(null);

  // ── Trip options state ───────────────────────────────────────────────────────
  type TripType = 'one_way' | 'round_trip' | 'schedule';
  const [tripType,       setTripType]       = useState<TripType>('one_way');
  const [passengerCount, setPassengerCount] = useState(1);
  const [extraPickups,   setExtraPickups]   = useState<PlaceDetail[]>([]);
  const [scheduledAt,    setScheduledAt]    = useState<Date | null>(null);
  const [returnAt,       setReturnAt]       = useState<Date | null>(null);
  const [schedulePicker, setSchedulePicker] = useState<'depart' | 'return' | null>(null);

  // ── Fetch real GPS + reverse-geocode ────────────────────────────────────────
  // Nearby vehicles — shown on map once destination is set
  const nearbyVehicles = useMemo<NearbyVehicle[]>(() => {
    if (!pickupCoords) return [];
    return generateNearbyVehicles(
      pickupCoords,
      destDetail ? selectedRide : null,
    );
  }, [pickupCoords, destDetail, selectedRide]);

  const currentVehicles: VehicleOption[] =
    mainSection === 'ride'
      ? (subSection === 'share' ? RIDE_SHARE : RIDE_RENT)
      : (subSection === 'share' ? CARGO_SHARE : CARGO_RENT);

  const fetchLocation = useCallback(async () => {
    setLocLoading(true);
    setPickupLabel('Fetching your location…');
    setPickupSub('');
    try {
      // ── Simulator fast-path: skip GPS, use India fallback instantly ──
      if (!Constants.isDevice) {
        const coords = INDIA_FALLBACK;
        setPickupCoords(coords);
        setLocLoading(false);
        mapRef.current?.animateToRegion({ ...coords, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 800);
        const geo = await reverseGeocode(coords.latitude, coords.longitude);
        if (geo) {
          setPickupLabel(geo.subLocality || geo.locality || 'Panipat');
          setPickupSub(geo.formattedAddress);
        } else {
          setPickupLabel('Panipat, Haryana');
          setPickupSub('Simulator — set custom location via Features → Location');
        }
        return;
      }

      // 1. Permission check
      let { status, canAskAgain } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (!canAskAgain) {
          setPickupLabel('Location permission denied');
          setPickupSub('Enable in Settings → Privacy → Location');
          setLocLoading(false);
          Alert.alert('Location Permission Required',
            'Please enable location access in your device Settings.',
            [{ text: 'OK' }]);
          return;
        }
        const result = await Location.requestForegroundPermissionsAsync();
        status = result.status;
      }
      if (status !== 'granted') {
        setPickupLabel('Location permission denied');
        setPickupSub('Tap to set pickup manually');
        setLocLoading(false);
        return;
      }

      // 2. Use watchPositionAsync — fires on first available fix (even low accuracy)
      //    then improves. Stop after first result to avoid stale updates.
      let resolved = false;
      const sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 0, timeInterval: 0 },
        async (loc) => {
          if (resolved) return;

          const { latitude, longitude } = loc.coords;

          // ── Guard: reject simulator/emulator fake locations outside India ──
          if (!isWithinIndia(latitude, longitude)) {
            console.warn(`[fetchLocation] GPS coords (${latitude.toFixed(4)}, ${longitude.toFixed(4)}) are outside India — likely simulator. Using Panipat fallback.`);
            resolved = true;
            sub.remove();
            const coords = INDIA_FALLBACK;
            setPickupCoords(coords);
            setLocLoading(false);
            mapRef.current?.animateToRegion({ ...coords, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 800);
            const geo = await reverseGeocode(coords.latitude, coords.longitude);
            if (geo) {
              setPickupLabel(geo.subLocality || geo.locality || 'Panipat');
              setPickupSub(geo.formattedAddress);
            } else {
              setPickupLabel('Panipat, Haryana');
              setPickupSub('Set your real location manually');
            }
            return;
          }

          resolved = true;
          sub.remove();

          const coords = { latitude, longitude };
          setPickupCoords(coords);
          setLocLoading(false);
          mapRef.current?.animateToRegion(
            { ...coords, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 800,
          );

          // Reverse-geocode to get human-readable address
          const geo = await reverseGeocode(latitude, longitude);
          if (geo) {
            setPickupLabel(geo.subLocality || geo.locality || 'Current Location');
            setPickupSub(geo.formattedAddress);
          } else {
            setPickupLabel('Current Location');
            setPickupSub(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
          }
        },
      );

      // 3. Fallback: if no fix after 8 s, stop and show error
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          sub.remove();
          setLocLoading(false);
          setPickupLabel('Location unavailable');
          setPickupSub('Tap to set pickup manually');
        }
      }, 8_000);
    } catch (err: any) {
      console.warn('[fetchLocation]', err?.message ?? err);
      setLocLoading(false);
      setPickupLabel('Location unavailable');
      setPickupSub('Tap to set pickup manually');
    }
  }, []);

  useEffect(() => { fetchLocation(); }, [fetchLocation]);

  const handlePickupSelect = (detail: PlaceDetail) => {
    const coords = { latitude: detail.lat, longitude: detail.lng };
    setPickupCoords(coords);
    setPickupLabel(detail.name || detail.formattedAddress);
    setPickupSub(detail.formattedAddress);
    mapRef.current?.animateToRegion({ ...coords, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 600);
    setSearchModal(null);
  };

  const handleDestSelect = (detail: PlaceDetail) => {
    setDestDetail(detail);
    setSearchModal(null);
    if (pickupCoords) {
      const minLat = Math.min(pickupCoords.latitude, detail.lat);
      const maxLat = Math.max(pickupCoords.latitude, detail.lat);
      const minLng = Math.min(pickupCoords.longitude, detail.lng);
      const maxLng = Math.max(pickupCoords.longitude, detail.lng);
      mapRef.current?.animateToRegion({
        latitude:      (minLat + maxLat) / 2,
        longitude:     (minLng + maxLng) / 2,
        latitudeDelta:  (maxLat - minLat) * 1.5 + 0.02,
        longitudeDelta: (maxLng - minLng) * 1.5 + 0.02,
      }, 800);
    }
  };

  const recenterMap = () => {
    if (pickupCoords) mapRef.current?.animateToRegion({ ...pickupCoords, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 600);
    else fetchLocation();
  };

  const goToBooking = (rideType?: string, service?: string) => {
    if (tripType === 'schedule' && !scheduledAt) {
      setSchedulePicker('depart');
      return;
    }
    if (tripType === 'round_trip' && !returnAt) {
      setSchedulePicker('return');
      return;
    }
    router.push({
      pathname: '/booking',
      params: {
        rideType:       rideType ?? selectedRide,
        pickup:         pickupLabel,
        pickupLat:      pickupCoords?.latitude?.toString() ?? '',
        pickupLng:      pickupCoords?.longitude?.toString() ?? '',
        destination:    destDetail?.formattedAddress ?? '',
        destLat:        destDetail?.lat?.toString() ?? '',
        destLng:        destDetail?.lng?.toString() ?? '',
        tripType,
        passengerCount: passengerCount.toString(),
        scheduledAt:    scheduledAt?.toISOString() ?? '',
        returnAt:       returnAt?.toISOString() ?? '',
        extraPickups:   JSON.stringify(extraPickups.map(p => ({ label: p.formattedAddress, lat: p.lat, lng: p.lng }))),
        ...(service ? { service } : {}),
      },
    });
  };

  const handleService = (svcId: string) => {
    const labels: Record<string, string> = {
      rentals: 'Hourly bike/auto rentals', intercity: 'Book intercity rides',
      package: 'Send & receive packages', scheduled: 'Schedule a ride in advance',
    };
    const svc = SERVICES.find(sv => sv.id === svcId);
    const svcTitle = svc ? t(svc.key as any, lang) : svcId;
    Alert.alert(svcTitle, `${labels[svcId] ?? 'Feature'} — Coming soon! 🚀`, [
      { text: t('book_now', lang), onPress: () => goToBooking(selectedRide, svcTitle) },
      { text: t('cancel', lang), style: 'cancel' },
    ]);
  };

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: YELLOW }]} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={YELLOW} />

      {/* ── TOP BAR ── */}
      <View style={s.topBar}>
        <View style={s.locPill}>
          <Ionicons name="location" size={16} color={DARK} />
          <View style={s.locText}>
            <Text style={s.locLabel}>YOUR LOCATION</Text>
            <Text style={s.locCity} numberOfLines={1}>{pickupLabel || 'Fetching…'}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={s.bellBtn}
          onPress={() => router.push('/notifications')}
          activeOpacity={0.8}
        >
          <Ionicons name="notifications-outline" size={22} color={DARK} />
          {unreadCount > 0 && (
            <View style={s.bellBadge}>
              <Text style={s.bellBadgeTxt}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── GOOGLE MAP ── */}
      <View style={s.mapContainer}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={StyleSheet.absoluteFillObject}
          initialRegion={
            pickupCoords
              ? { ...pickupCoords, latitudeDelta: 0.01, longitudeDelta: 0.01 }
              : { ...INDIA_FALLBACK, latitudeDelta: 0.05, longitudeDelta: 0.05 }
          }
          showsUserLocation
          showsMyLocationButton={false}
          showsCompass={false}
          showsTraffic
          pitchEnabled={false}
        >
          {/* Pickup marker */}
          {pickupCoords && (
            <Marker
              coordinate={pickupCoords}
              anchor={{ x: 0.5, y: 1 }}
              onPress={() => setSearchModal({ mode: 'pickup', initialValue: pickupLabel })}
            >
              <View style={s.pickupMarker}>
                <View style={s.pickupMarkerInner}>
                  <Ionicons name="radio-button-on" size={14} color="#fff" />
                </View>
                <View style={s.markerTail} />
              </View>
            </Marker>
          )}

          {/* Destination marker */}
          {destDetail && (
            <Marker
              coordinate={{ latitude: destDetail.lat, longitude: destDetail.lng }}
              anchor={{ x: 0.5, y: 1 }}
            >
              <View style={s.destMarker}>
                <View style={s.destMarkerInner}>
                  <Ionicons name="location" size={14} color="#fff" />
                </View>
                <View style={[s.markerTail, { backgroundColor: '#F44336' }]} />
              </View>
            </Marker>
          )}

          {/* ── Nearby vehicle markers ── */}
          {nearbyVehicles.map((v) => {
            const rt = ALL_VEHICLES.find(r => r.id === v.rideTypeId)!;
            return (
              <Marker
                key={v.id}
                coordinate={{ latitude: v.latitude, longitude: v.longitude }}
                anchor={{ x: 0.5, y: 0.5 }}
                onPress={() => setSelectedRide(v.rideTypeId)}
                tracksViewChanges={false}
              >
                <View style={[s.vehMarker, { borderColor: rt.color }]}>
                  <MaterialCommunityIcons name={rt.icon as any} size={16} color={rt.color} />
                  <Text style={[s.vehEta, { color: rt.color }]}>{v.etaMin}m</Text>
                </View>
              </Marker>
            );
          })}
        </MapView>

        {locLoading && (
          <View style={s.mapLoader}>
            <ActivityIndicator size="large" color={YELLOW} />
            <Text style={s.mapLoaderTxt}>Finding your location…</Text>
          </View>
        )}

        <TouchableOpacity style={s.recenterBtn} onPress={recenterMap} activeOpacity={0.85}>
          <Ionicons name="locate" size={20} color={DARK} />
        </TouchableOpacity>

        {!locLoading && !!pickupLabel && (
          <View style={s.mapPill}>
            <Ionicons name="radio-button-on" size={12} color="#4CAF50" />
            <Text style={s.mapPillTxt} numberOfLines={1}>{pickupLabel}</Text>
          </View>
        )}
      </View>

      {/* ── SCROLLABLE BOTTOM PANEL ── */}
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">

        {/* WHERE TO / ROUTE BAR */}
        <View style={s.card}>
          <View style={s.destBar}>
            <View style={s.destBarDots}>
              <View style={s.dotGreen} />
              <View style={s.dotLine} />
              <View style={s.dotRed} />
            </View>
            <View style={s.destBarTexts}>
              {/* Editable pickup row */}
              <View style={s.destBarRow}>
                <TouchableOpacity
                  style={{ flex: 1 }}
                  onPress={() => setSearchModal({ mode: 'pickup', initialValue: pickupLabel })}
                  activeOpacity={0.8}
                >
                  <Text style={[s.destBarValue, { color: colors.text }]} numberOfLines={1}>
                    {pickupLabel || 'Set pickup location'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setMapPicker({ mode: 'pickup' })}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="map-outline" size={16} color={SECONDARY} style={{ marginLeft: 6 }} />
                </TouchableOpacity>
              </View>
              <View style={s.destBarDivider} />
              {/* Editable destination row */}
              <View style={s.destBarRow}>
                <TouchableOpacity
                  style={{ flex: 1 }}
                  onPress={() => setSearchModal({ mode: 'destination', initialValue: destDetail?.formattedAddress ?? '' })}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[s.destBarValue, !destDetail && s.destBarPlaceholder]}
                    numberOfLines={1}
                  >
                    {destDetail ? destDetail.formattedAddress : t('where_to', lang)}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setMapPicker({ mode: 'destination' })}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="map-outline" size={16} color={SECONDARY} style={{ marginLeft: 6 }} />
                </TouchableOpacity>
              </View>
            </View>
            {destDetail && (
              <TouchableOpacity onPress={() => setDestDetail(null)} style={s.clearDest}>
                <Ionicons name="close-circle" size={20} color={SECONDARY} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── TRIP OPTIONS ── */}
        <View style={s.card}>
          {/* Trip type tabs */}
          <View style={s.tripTabs}>
            {TRIP_TYPES.map(tt => (
              <TouchableOpacity
                key={tt.id}
                style={[s.tripTab, tripType === tt.id && s.tripTabOn]}
                onPress={() => {
                  setTripType(tt.id as TripType);
                  if (tt.id !== 'schedule')   setScheduledAt(null);
                  if (tt.id !== 'round_trip') setReturnAt(null);
                }}
                activeOpacity={0.8}
              >
                <Ionicons name={tt.icon} size={14} color={tripType === tt.id ? DARK : SECONDARY} />
                <Text style={[s.tripTabTxt, tripType === tt.id && s.tripTabTxtOn]}>{tt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Schedule / Return date rows */}
          {(tripType === 'schedule' || tripType === 'round_trip') && (
            <View style={[s.dateSection, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                style={[s.dateRow, { borderColor: colors.border }]}
                onPress={() => setSchedulePicker('depart')}
                activeOpacity={0.8}
              >
                <Ionicons name="time-outline" size={18} color="#E65100" />
                <View style={{ flex: 1 }}>
                  <Text style={[s.dateRowLabel, { color: colors.subText }]}>
                    {tripType === 'schedule' ? 'Departure Time' : 'Going On'}
                  </Text>
                  <Text style={[s.dateRowVal, { color: scheduledAt ? colors.text : SECONDARY }]}>
                    {scheduledAt ? formatScheduledDate(scheduledAt) : 'Set date & time  →'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={15} color={SECONDARY} />
              </TouchableOpacity>
              {tripType === 'round_trip' && (
                <TouchableOpacity
                  style={[s.dateRow, { borderColor: colors.border, marginTop: 8 }]}
                  onPress={() => setSchedulePicker('return')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="return-up-back-outline" size={18} color="#4CAF50" />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.dateRowLabel, { color: colors.subText }]}>Return On</Text>
                    <Text style={[s.dateRowVal, { color: returnAt ? colors.text : SECONDARY }]}>
                      {returnAt ? formatScheduledDate(returnAt) : 'Set return date & time  →'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={15} color={SECONDARY} />
                </TouchableOpacity>
              )}
            </View>
          )}

        </View>

        {/* ── RIDE / CARGO MAIN SECTIONS ── */}
        <View style={s.card}>

          {/* Main section tabs: Ride | Cargo */}
          <View style={s.mainTabRow}>
            <TouchableOpacity
              style={[s.mainTab, mainSection === 'ride' && s.mainTabRideActive]}
              onPress={() => { setMainSection('ride'); setSubSection('share'); setSelectedRide(RIDE_SHARE[0].id); }}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="car" size={20} color={mainSection === 'ride' ? '#fff' : SECONDARY} />
              <Text style={[s.mainTabTxt, mainSection === 'ride' && s.mainTabTxtActive]}>Ride</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.mainTab, mainSection === 'cargo' && s.mainTabCargoActive]}
              onPress={() => { setMainSection('cargo'); setSubSection('share'); setSelectedRide(CARGO_SHARE[0].id); }}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="truck" size={20} color={mainSection === 'cargo' ? '#fff' : SECONDARY} />
              <Text style={[s.mainTabTxt, mainSection === 'cargo' && s.mainTabTxtActive]}>Cargo</Text>
            </TouchableOpacity>
          </View>

          {/* Sub-section tabs: Share | Rent */}
          <View style={s.subTabRow}>
            <TouchableOpacity
              style={[s.subTab, subSection === 'share' && s.subTabShareActive]}
              onPress={() => {
                setSubSection('share');
                setSelectedRide(mainSection === 'ride' ? RIDE_SHARE[0].id : CARGO_SHARE[0].id);
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="people-outline" size={15} color={subSection === 'share' ? '#2E7D32' : SECONDARY} />
              <Text style={[s.subTabTxt, subSection === 'share' && s.subTabShareTxtActive]}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.subTab, subSection === 'rent' && s.subTabRentActive]}
              onPress={() => {
                setSubSection('rent');
                setSelectedRide(mainSection === 'ride' ? RIDE_RENT[0].id : CARGO_RENT[0].id);
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="key-outline" size={15} color={subSection === 'rent' ? '#1565C0' : SECONDARY} />
              <Text style={[s.subTabTxt, subSection === 'rent' && s.subTabRentTxtActive]}>Rent</Text>
            </TouchableOpacity>
          </View>

          {/* Share hint */}
          {subSection === 'share' && (
            <View style={s.neighHint}>
              <Ionicons name="people-circle-outline" size={16} color="#2E7D32" />
              <Text style={[s.neighHintTxt, { color: colors.subText }]}>
                {mainSection === 'ride'
                  ? 'Shared ride — split fare with passengers from your area'
                  : 'Shared cargo — split cost with others sending goods your way'}
              </Text>
            </View>
          )}

          {/* Available vehicles header */}
          {pickupCoords && (
            <View style={s.nearbyHeader}>
              <View style={s.nearbyDot} />
              <Text style={[s.nearbyTitle, { color: colors.text }]}>
                {destDetail
                  ? `${nearbyVehicles.filter(v => currentVehicles.some(c => c.id === v.rideTypeId)).length} vehicles available nearby`
                  : 'Set destination to see available vehicles'}
              </Text>
            </View>
          )}

          {/* Vehicle grid */}
          <View style={s.rideGrid}>
            {currentVehicles.map(vehicle => {
              const count  = nearbyVehicles.filter(v => v.rideTypeId === vehicle.id).length;
              const minEta = nearbyVehicles.filter(v => v.rideTypeId === vehicle.id)
                .reduce<number | null>((m, v) => m === null ? v.etaMin : Math.min(m, v.etaMin), null);
              return (
                <TouchableOpacity
                  key={vehicle.id}
                  style={[s.rideItem, selectedRide === vehicle.id && s.rideItemActive]}
                  onPress={() => goToBooking(vehicle.id)}
                  activeOpacity={0.8}
                >
                  <View style={[s.rideIconWrap, selectedRide === vehicle.id && { backgroundColor: vehicle.color + '18' }]}>
                    <MaterialCommunityIcons name={vehicle.icon as any} size={28} color={vehicle.color} />
                    {count > 0 && (
                      <View style={[s.rideCountBadge, { backgroundColor: vehicle.color }]}>
                        <Text style={s.rideCountTxt}>{count}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[s.rideLabel, selectedRide === vehicle.id && { color: vehicle.color, fontWeight: '700' }]}>
                    {vehicle.label}
                  </Text>
                  {minEta !== null
                    ? <Text style={[s.rideFare, { color: vehicle.color, fontWeight: '700' }]}>{minEta} min · {vehicle.fare}</Text>
                    : <Text style={s.rideFare}>{vehicle.fare}</Text>
                  }
                  {subSection === 'share' && count > 0 && (
                    <View style={s.neighOnVehicle}>
                      <Ionicons name="people" size={9} color="#2E7D32" />
                      <Text style={s.neighOnVehicleTxt}>{count} near</Text>
                    </View>
                  )}
                  {selectedRide === vehicle.id && <View style={[s.rideBar, { backgroundColor: vehicle.color }]} />}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Passenger count — only for Ride section */}
          {mainSection === 'ride' && (
            <View style={[s.passengerRow, { borderTopColor: colors.border, marginTop: 8 }]}>
              <Ionicons name="people-outline" size={20} color="#1565C0" />
              <Text style={[s.passengerLabel, { color: colors.text }]}>Passengers</Text>
              <View style={s.counter}>
                <TouchableOpacity
                  style={[s.counterBtn, passengerCount <= 1 && s.counterBtnOff, { backgroundColor: colors.sectionBg }]}
                  onPress={() => setPassengerCount(c => Math.max(1, c - 1))}
                  disabled={passengerCount <= 1}
                >
                  <Ionicons name="remove" size={18} color={passengerCount > 1 ? DARK : '#CCC'} />
                </TouchableOpacity>
                <Text style={[s.counterVal, { color: colors.text }]}>{passengerCount}</Text>
                <TouchableOpacity
                  style={[s.counterBtn, passengerCount >= 100 && s.counterBtnOff, { backgroundColor: colors.sectionBg }]}
                  onPress={() => setPassengerCount(c => Math.min(100, c + 1))}
                  disabled={passengerCount >= 100}
                >
                  <Ionicons name="add" size={18} color={passengerCount < 100 ? DARK : '#CCC'} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Extra pickup stops — only for Ride section */}
          {mainSection === 'ride' && passengerCount > 1 && (
            <View style={[s.extraSection, { borderTopColor: colors.border }]}>
              <Text style={[s.extraHint, { color: colors.subText }]}>
                📍 Passengers from different villages? Add their pickup stops.
              </Text>
              {extraPickups.map((ep, idx) => (
                <View key={idx} style={[s.extraRow, { borderColor: colors.border }]}>
                  <View style={s.extraDot} />
                  <Text style={[s.extraAddr, { color: colors.text }]} numberOfLines={1}>{ep.formattedAddress}</Text>
                  <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => setExtraPickups(prev => prev.filter((_, i) => i !== idx))}>
                    <Ionicons name="close-circle" size={18} color={SECONDARY} />
                  </TouchableOpacity>
                </View>
              ))}
              {extraPickups.length < 3 && (
                <TouchableOpacity
                  style={s.addStopBtn}
                  onPress={() => setSearchModal({ mode: 'pickup', initialValue: '', isExtraStop: true })}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add-circle-outline" size={16} color="#FF6B00" />
                  <Text style={s.addStopTxt}>Add stop from another location</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* QUICK SERVICES */}
        <View style={[s.card, { flexDirection: 'row', justifyContent: 'space-between' }]}>
          {SERVICES.map(svc => (
            <TouchableOpacity key={svc.id} style={s.svcItem} onPress={() => handleService(svc.id)} activeOpacity={0.8}>
              <View style={[s.svcIcon, { backgroundColor: svc.color + '20' }]}>
                <Ionicons name={svc.icon as any} size={20} color={svc.color} />
              </View>
              <Text style={[s.svcLabel, { color: colors.text }]}>{t(svc.key as any, lang)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* OFFER BANNER */}
        <TouchableOpacity
          style={s.offerBanner}
          onPress={() => Alert.alert('Offer!', 'Apply code GAON50 at checkout to save ₹50 on your first ride!')}
          activeOpacity={0.85}
        >
          <Ionicons name="pricetag" size={18} color={DARK} />
          <Text style={s.offerText}>
            Use code <Text style={s.offerCode}>GAON50</Text> — ₹50 off on first ride!
          </Text>
          <Ionicons name="chevron-forward" size={16} color={DARK} />
        </TouchableOpacity>


      </ScrollView>

      {/* ── LOCATION SEARCH MODAL ── */}
      {searchModal && (
        <LocationSearchModal
          visible
          mode={searchModal.mode}
          initialValue={searchModal.initialValue}
          colors={colors}
          onSelect={searchModal.isExtraStop
            ? (d) => { setExtraPickups(prev => [...prev, d]); setSearchModal(null); }
            : (searchModal.mode === 'pickup' ? handlePickupSelect : handleDestSelect)
          }
          onPickOnMap={() => {
            setSearchModal(null);
            if (!searchModal.isExtraStop) setMapPicker({ mode: searchModal.mode });
          }}
          onClose={() => setSearchModal(null)}
        />
      )}

      {/* ── MAP PICKER MODAL ── */}
      {mapPicker && (
        <MapPickerModal
          visible
          mode={mapPicker.mode}
          initialCoords={
            mapPicker.mode === 'pickup'
              ? pickupCoords
              : destDetail ? { latitude: destDetail.lat, longitude: destDetail.lng } : pickupCoords
          }
          colors={colors}
          onConfirm={(detail) => {
            if (mapPicker.mode === 'pickup') handlePickupSelect(detail);
            else handleDestSelect(detail);
            setMapPicker(null);
          }}
          onClose={() => setMapPicker(null)}
        />
      )}

      {/* ── SCHEDULE PICKER ── */}
      {schedulePicker && (
        <SchedulePickerModal
          visible
          title={schedulePicker === 'depart' ? '📅 Schedule Departure' : '↩️ Set Return Date'}
          onConfirm={(d) => {
            if (schedulePicker === 'depart') setScheduledAt(d);
            else setReturnAt(d);
            setSchedulePicker(null);
          }}
          onClose={() => setSchedulePicker(null)}
          colors={colors}
        />
      )}
    </SafeAreaView>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  safe:         { flex: 1, backgroundColor: YELLOW },
  topBar:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: YELLOW },
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: YELLOW },
  bellBtn:      { position: 'relative', width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.1)', alignItems: 'center', justifyContent: 'center' },
  bellBadge:    { position: 'absolute', top: 4, right: 4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#FF4444', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 1.5, borderColor: YELLOW },
  bellBadgeTxt: { fontSize: 9, color: '#fff', fontWeight: '800' },
  locPill:      { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 },
  locText:      { flex: 1 },
  locLabel:     { fontSize: 10, color: 'rgba(0,0,0,0.55)', fontWeight: '500' },
  locCity:      { fontSize: 14, fontWeight: '800', color: DARK, maxWidth: 200 },
  locSub:       { fontSize: 11, color: 'rgba(0,0,0,0.45)', marginTop: 1 },
  gpsBtn:       { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.1)', alignItems: 'center', justifyContent: 'center' },

  mapContainer: { height: SCREEN_H * 0.30, width: SCREEN_W, backgroundColor: '#c8d8e8', overflow: 'hidden' },
  mapLoader:    { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.75)', alignItems: 'center', justifyContent: 'center', gap: 10 },
  mapLoaderTxt: { fontSize: 13, color: DARK, fontWeight: '600' },
  recenterBtn:  { position: 'absolute', bottom: 12, right: 12, width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.18, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 5 },
  mapPill:      { position: 'absolute', bottom: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, shadowColor: '#000', shadowOpacity: 0.15, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 4, maxWidth: SCREEN_W - 80 },
  mapPillTxt:   { fontSize: 12, fontWeight: '700', color: DARK },

  pickupMarker:      { alignItems: 'center' },
  pickupMarkerInner: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#4CAF50', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  destMarker:        { alignItems: 'center' },
  destMarkerInner:   { width: 30, height: 30, borderRadius: 15, backgroundColor: '#F44336', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  markerTail:        { width: 3, height: 10, backgroundColor: '#4CAF50', borderRadius: 2 },

  scroll:        { flex: 1, backgroundColor: colors.bg },
  scrollContent: { paddingBottom: 32 },

  card:         { backgroundColor: colors.card, marginHorizontal: 16, marginBottom: 12, marginTop: 12, borderRadius: 18, padding: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 2 },

  destBar:            { flexDirection: 'row', alignItems: 'center', gap: 10 },
  destBarDots:        { alignItems: 'center', gap: 2, paddingVertical: 4 },
  dotGreen:           { width: 12, height: 12, borderRadius: 6, backgroundColor: '#4CAF50' },
  dotLine:            { width: 2, height: 22, backgroundColor: BORDER, borderRadius: 1 },
  dotRed:             { width: 12, height: 12, borderRadius: 6, backgroundColor: '#F44336' },
  destBarTexts:       { flex: 1, gap: 0 },
  destBarRow:         { flexDirection: 'row', alignItems: 'center', paddingVertical: 9 },
  destBarDivider:     { height: 1, backgroundColor: colors.border },
  destBarValue:       { fontSize: 14, fontWeight: '600', flex: 1, color: colors.text },
  destBarPlaceholder: { color: SECONDARY, fontWeight: '500' },
  clearDest:          { padding: 4 },

  rideGrid:     { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  rideItem:     { width: '48%', alignItems: 'center', paddingVertical: 12, borderRadius: 14, marginBottom: 12, backgroundColor: colors.card, position: 'relative', overflow: 'hidden' },
  rideItemActive: { shadowColor: '#000', shadowOpacity: 0.15, shadowOffset: { width: 0, height: 4 }, shadowRadius: 8, elevation: 5, borderWidth: 2, borderColor: colors.border },
  rideIconWrap: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', marginBottom: 4, backgroundColor: colors.iconBg, position: 'relative' },
  rideCountBadge: { position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 1.5, borderColor: colors.card },
  rideCountTxt:   { fontSize: 9, fontWeight: '800', color: '#fff' },
  rideLabel:    { fontSize: 12, fontWeight: '700', color: colors.text },
  rideFare:     { fontSize: 10, color: colors.subText, marginTop: 2, fontWeight: '500' },
  rideBar:      { position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, borderRadius: 2 },
  nearbyHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, paddingHorizontal: 4 },
  nearbyDot:    { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4CAF50' },
  nearbyTitle:  { fontSize: 12, fontWeight: '600', flex: 1 },
  // ── Main section tabs (Ride / Cargo) ────────────────────────────────────────
  mainTabRow:         { flexDirection: 'row', gap: 8, marginBottom: 10 },
  mainTab:            { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 13, borderRadius: 14, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.bg },
  mainTabRideActive:  { backgroundColor: '#1565C0', borderColor: '#1565C0' },
  mainTabCargoActive: { backgroundColor: '#4E342E', borderColor: '#4E342E' },
  mainTabTxt:         { fontSize: 15, fontWeight: '700', color: SECONDARY },
  mainTabTxtActive:   { color: '#fff', fontWeight: '800' },
  // ── Sub-section tabs (Share / Rent) ──────────────────────────────────────────
  subTabRow:          { flexDirection: 'row', gap: 8, marginBottom: 10 },
  subTab:             { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.bg },
  subTabShareActive:  { backgroundColor: '#E8F5E9', borderColor: '#2E7D32' },
  subTabRentActive:   { backgroundColor: '#E3F2FD', borderColor: '#1565C0' },
  subTabTxt:          { fontSize: 13, fontWeight: '600', color: SECONDARY },
  subTabShareTxtActive: { color: '#2E7D32', fontWeight: '800' },
  subTabRentTxtActive:  { color: '#1565C0', fontWeight: '800' },
  // ── Neighbour hint ────────────────────────────────────────────────────────────
  neighHint:      { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#E8F5E9', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 8 },
  neighHintTxt:   { fontSize: 11, flex: 1 },
  neighOnVehicle: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
  neighOnVehicleTxt: { fontSize: 9, fontWeight: '700', color: '#2E7D32' },
  // Vehicle map markers
  vehMarker:    { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 7, paddingVertical: 4, borderWidth: 1.5, shadowColor: '#000', shadowOpacity: 0.18, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 4 },
  vehEta:       { fontSize: 10, fontWeight: '800' },

  svcItem:  { alignItems: 'center', gap: 6, flex: 1 },
  svcIcon:  { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  svcLabel: { fontSize: 11, fontWeight: '600', textAlign: 'center' },

  offerBanner: { marginHorizontal: 16, marginBottom: 12, backgroundColor: YELLOW + '40', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: YELLOW },
  offerText:   { flex: 1, fontSize: 13, color: DARK, fontWeight: '500' },
  offerCode:   { fontWeight: '800', color: '#E65100' },

  bookBtn:  { marginHorizontal: 16, backgroundColor: YELLOW, borderRadius: 16, paddingVertical: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, shadowColor: YELLOW, shadowOpacity: 0.5, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, elevation: 6 },
  bookBtnT: { fontSize: 17, fontWeight: '800', color: DARK, letterSpacing: 0.5 },

  // ── Trip options ────────────────────────────────────────────────────────────
  tripTabs:       { flexDirection: 'row', gap: 6, marginBottom: 2 },
  tripTab:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: 10, backgroundColor: colors.sectionBg, borderWidth: 1.5, borderColor: 'transparent' },
  tripTabOn:      { backgroundColor: YELLOW, borderColor: '#D4A017' },
  tripTabTxt:     { fontSize: 12, fontWeight: '600', color: SECONDARY },
  tripTabTxtOn:   { color: DARK, fontWeight: '800' },
  dateSection:    { paddingTop: 12, marginTop: 10, borderTopWidth: 1 },
  dateRow:        { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  dateRowLabel:   { fontSize: 11, fontWeight: '500', marginBottom: 2 },
  dateRowVal:     { fontSize: 14, fontWeight: '600' },
  passengerRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 12, marginTop: 12, borderTopWidth: 1 },
  passengerLabel: { flex: 1, fontSize: 14, fontWeight: '600' },
  counter:        { flexDirection: 'row', alignItems: 'center', gap: 4 },
  counterBtn:     { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  counterBtnOff:  { opacity: 0.35 },
  counterVal:     { fontSize: 18, fontWeight: '800', minWidth: 32, textAlign: 'center' },
  extraSection:   { paddingTop: 12, marginTop: 12, borderTopWidth: 1 },
  extraHint:      { fontSize: 12, fontWeight: '500', marginBottom: 10, lineHeight: 17 },
  extraRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9, marginBottom: 6 },
  extraDot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF6B00' },
  extraAddr:      { flex: 1, fontSize: 13, fontWeight: '500' },
  addStopBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1.5, borderColor: '#FF6B00', borderStyle: 'dashed' },
  addStopTxt:     { fontSize: 13, fontWeight: '600', color: '#FF6B00' },
});
