import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
  StatusBar, ActivityIndicator, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Ionicons, MaterialCommunityIcons, FontAwesome5,
} from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import MapView, { Marker, Circle, PROVIDER_DEFAULT } from 'react-native-maps';

const { width: SCREEN_W } = Dimensions.get('window');
const MAP_HEIGHT = 260;

// ── Theme ─────────────────────────────────────────────────────────────────
const YELLOW = '#FFD700';
const DARK = '#1A1A1A';
const GREY = '#F5F5F5';
const BORDER = '#E8E8E8';
const SECONDARY = '#777';

// ── Ride Types ────────────────────────────────────────────────────────────
const RIDE_TYPES = [
  { id: '1', label: 'Bike', icon: 'motorbike', lib: 'mci', color: '#FF6B00', fare: '₹35–55' },
  { id: '2', label: 'Auto', icon: 'auto-rickshaw', lib: 'mci', color: '#4CAF50', fare: '₹60–90' },
  { id: '3', label: 'Cab', icon: 'car', lib: 'ion', color: '#2196F3', fare: '₹120–160' },
  { id: '4', label: 'Bike Taxi', icon: 'motorcycle', lib: 'fa5', color: '#9C27B0', fare: '₹30–45' },
];

// ── Services ──────────────────────────────────────────────────────────────
const SERVICES = [
  { id: 'rentals', label: 'Rentals', icon: 'calendar-outline', color: '#FF6B00' },
  { id: 'intercity', label: 'Intercity', icon: 'trail-sign-outline', color: '#4CAF50' },
  { id: 'package', label: 'Package', icon: 'cube-outline', color: '#2196F3' },
  { id: 'scheduled', label: 'Scheduled', icon: 'alarm-outline', color: '#9C27B0' },
];

// ── Saved Places ──────────────────────────────────────────────────────────
const SAVED = [
  { id: 'home', label: 'Home', sub: 'Add home location', icon: 'home' },
  { id: 'work', label: 'Work', sub: 'Add work location', icon: 'briefcase' },
];

const RECENT = [
  { id: 'r1', label: 'Sector 18, Noida', sub: 'Recent', icon: 'time-outline' },
  { id: 'r2', label: 'Connaught Place', sub: 'Recent', icon: 'time-outline' },
];

// ── Icon helper ───────────────────────────────────────────────────────────
function RideIcon({ ride }: { ride: typeof RIDE_TYPES[0] }) {
  if (ride.lib === 'mci') return <MaterialCommunityIcons name={ride.icon as any} size={28} color={ride.color} />;
  if (ride.lib === 'fa5') return <FontAwesome5 name={ride.icon as any} size={24} color={ride.color} />;
  return <Ionicons name={ride.icon as any} size={26} color={ride.color} />;
}

// ═══════════════════════════════════════════════════════════════════════════
export default function HomeScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const [selectedRide, setSelectedRide] = useState('1');
  const [locationStr, setLocationStr] = useState('Fetching location…');
  const [subLocation, setSubLocation] = useState('');
  const [locLoading, setLocLoading] = useState(true);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  // ── Fetch GPS Location ──────────────────────────────────────────────────
  const fetchLocation = useCallback(async () => {
    setLocLoading(true);
    try {
      // Set current location to Sec-7 Panipat Haryana
      const newCoords = { latitude: 29.3839, longitude: 79.1574 };
      setCoords(newCoords);

      // Animate map to Sec-7 Panipat
      mapRef.current?.animateToRegion(
        { ...newCoords, latitudeDelta: 0.01, longitudeDelta: 0.01 },
        800,
      );

      // Set location details
      setLocationStr('Sec-7');
      setSubLocation('Panipat, Haryana');
    } catch {
      setLocationStr('Unable to fetch location');
      setSubLocation('Check GPS/permissions');
    } finally {
      setLocLoading(false);
    }
  }, []);

  useEffect(() => { fetchLocation(); }, [fetchLocation]);

  // ── Recenter map ────────────────────────────────────────────────────────
  const recenterMap = () => {
    if (coords) {
      mapRef.current?.animateToRegion(
        { ...coords, latitudeDelta: 0.01, longitudeDelta: 0.01 },
        600,
      );
    } else {
      fetchLocation();
    }
  };

  // ── Open Booking Screen ─────────────────────────────────────────────────
  const goToBooking = (rideType?: string, service?: string) => {
    router.push({
      pathname: '/booking',
      params: {
        rideType: rideType ?? selectedRide,
        pickup: locationStr,
        ...(service ? { service } : {}),
      },
    });
  };

  // ── Service press handler ───────────────────────────────────────────────
  const handleService = (svcId: string) => {
    const labels: Record<string, string> = {
      rentals: 'Hourly bike/auto rentals',
      intercity: 'Book intercity rides',
      package: 'Send & receive packages',
      scheduled: 'Schedule a ride in advance',
    };
    Alert.alert(
      SERVICES.find(s => s.id === svcId)?.label ?? svcId,
      `${labels[svcId] ?? 'Feature'} — Coming soon! 🚀`,
      [
        { text: 'Book Now', onPress: () => goToBooking(selectedRide, SERVICES.find(s => s.id === svcId)?.label ?? svcId) },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={YELLOW} />

      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.locPill} onPress={fetchLocation} activeOpacity={0.8}>
          {locLoading
            ? <ActivityIndicator size="small" color={DARK} style={{ marginRight: 6 }} />
            : <Ionicons name="location" size={18} color={DARK} />
          }
          <View style={styles.locText}>
            <Text style={styles.locLabel}>Current Location</Text>
            <Text style={styles.locCity} numberOfLines={1}>
              {locationStr} {!locLoading && '▾'}
            </Text>
            {!!subLocation && (
              <Text style={styles.locSub} numberOfLines={1}>{subLocation}</Text>
            )}
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.avatar}>
          <Text style={styles.avatarTxt}>G</Text>
        </TouchableOpacity>
      </View>

      {/* ── MAP VIEW ──────────────────────────────────────────────────────── */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_DEFAULT}
          style={styles.map}
          initialRegion={
            coords
              ? { ...coords, latitudeDelta: 0.01, longitudeDelta: 0.01 }
              : { latitude: 28.6139, longitude: 77.209, latitudeDelta: 0.05, longitudeDelta: 0.05 }
          }
          showsUserLocation={false}
          showsMyLocationButton={false}
          showsCompass={false}
          pitchEnabled={false}
        >
          {coords && (
            <>
              {/* Accuracy circle */}
              <Circle
                center={coords}
                radius={80}
                strokeColor={YELLOW + '99'}
                fillColor={YELLOW + '30'}
                strokeWidth={1.5}
              />
              {/* Custom marker */}
              <Marker coordinate={coords} anchor={{ x: 0.5, y: 0.5 }}>
                <View style={styles.markerOuter}>
                  <View style={styles.markerInner}>
                    <Ionicons name="navigate" size={14} color="#fff" />
                  </View>
                </View>
              </Marker>
            </>
          )}
        </MapView>

        {/* Loading overlay on map */}
        {locLoading && (
          <View style={styles.mapLoader}>
            <ActivityIndicator size="large" color={YELLOW} />
            <Text style={styles.mapLoaderTxt}>Finding your location…</Text>
          </View>
        )}

        {/* Recenter FAB */}
        <TouchableOpacity style={styles.recenterBtn} onPress={recenterMap} activeOpacity={0.85}>
          <Ionicons name="locate" size={20} color={DARK} />
        </TouchableOpacity>

        {/* Map location pill */}
        {!locLoading && !!locationStr && (
          <View style={styles.mapPill}>
            <Ionicons name="location" size={12} color={DARK} />
            <Text style={styles.mapPillTxt} numberOfLines={1}>{locationStr}</Text>
          </View>
        )}
      </View>

      {/* ── SCROLLABLE BOTTOM CONTENT ─────────────────────────────────────── */}
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >

        {/* ── PROMO CARD ─────────────────────────────────────────────── */}
        <View style={styles.promoCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.promoGreet}>Hey, Good Evening! 👋</Text>
            <Text style={styles.promoTitle}>Ride fast,{'\n'}ride safe.</Text>
            <View style={styles.promoBadge}>
              <Text style={styles.promoBadgeT}>🎉 Use code GAON50 — ₹50 off</Text>
            </View>
          </View>
          <View style={styles.promoBike}>
            <MaterialCommunityIcons name="motorbike" size={80} color="rgba(0,0,0,0.1)" />
          </View>
        </View>

        {/* ── RIDE TYPE SELECTOR ──────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Choose a ride</Text>
          <View style={styles.rideGrid}>
            {RIDE_TYPES.map((rt) => (
              <TouchableOpacity
                key={rt.id}
                style={[styles.rideItem, selectedRide === rt.id && styles.rideItemActive]}
                onPress={() => setSelectedRide(rt.id)}
                activeOpacity={0.8}
              >
                <View style={[styles.rideIconWrap, selectedRide === rt.id && { backgroundColor: rt.color + '20' }]}>
                  <RideIcon ride={rt} />
                </View>
                <Text style={[styles.rideLabel, selectedRide === rt.id && { color: rt.color, fontWeight: '700' }]}>
                  {rt.label}
                </Text>
                <Text style={styles.rideFare}>{rt.fare}</Text>
                {selectedRide === rt.id && <View style={[styles.rideBar, { backgroundColor: rt.color }]} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── WHERE TO? ───────────────────────────────────────────────── */}
        <View style={styles.card}>
          <TouchableOpacity style={styles.searchBar} onPress={() => goToBooking()} activeOpacity={0.85}>
            <Ionicons name="search" size={20} color={SECONDARY} />
            <Text style={styles.searchPH}>Where to?</Text>
            <View style={styles.micBtn}>
              <Ionicons name="mic" size={18} color={DARK} />
            </View>
          </TouchableOpacity>

          {SAVED.map((p) => (
            <TouchableOpacity key={p.id} style={styles.placeRow} onPress={() => goToBooking()} activeOpacity={0.7}>
              <View style={[styles.placeIcon, { backgroundColor: YELLOW + '35' }]}>
                <Ionicons name={p.icon as any} size={16} color={DARK} />
              </View>
              <View style={styles.placeText}>
                <Text style={styles.placeName}>{p.label}</Text>
                <Text style={styles.placeSub}>{p.sub}</Text>
              </View>
              <Ionicons name="add-circle-outline" size={20} color={SECONDARY} />
            </TouchableOpacity>
          ))}

          {RECENT.map((p) => (
            <TouchableOpacity key={p.id} style={styles.placeRow} onPress={() => goToBooking()} activeOpacity={0.7}>
              <View style={[styles.placeIcon, { backgroundColor: '#F0F0F0' }]}>
                <Ionicons name={p.icon as any} size={16} color={SECONDARY} />
              </View>
              <View style={styles.placeText}>
                <Text style={styles.placeName}>{p.label}</Text>
                <Text style={styles.placeSub}>{p.sub}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={BORDER} />
            </TouchableOpacity>
          ))}
        </View>

        {/* ── OTHER SERVICES ──────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>More services</Text>
          <View style={styles.servicesRow}>
            {SERVICES.map((svc) => (
              <TouchableOpacity key={svc.id} style={styles.svcChip} onPress={() => handleService(svc.id)} activeOpacity={0.75}>
                <View style={[styles.svcIcon, { backgroundColor: svc.color + '18' }]}>
                  <Ionicons name={svc.icon as any} size={22} color={svc.color} />
                </View>
                <Text style={styles.svcLabel}>{svc.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── OFFER BANNER ────────────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.offerBanner}
          onPress={() => Alert.alert('Offer!', 'Apply code GAON50 at checkout to save ₹50 on your first ride!')}
          activeOpacity={0.85}
        >
          <Ionicons name="pricetag" size={18} color={DARK} />
          <Text style={styles.offerText}>
            Use code <Text style={styles.offerCode}>GAON50</Text> — ₹50 off on first ride!
          </Text>
          <Ionicons name="chevron-forward" size={16} color={DARK} />
        </TouchableOpacity>

        {/* ── BOOK NOW ────────────────────────────────────────────────── */}
        <TouchableOpacity style={styles.bookBtn} onPress={() => goToBooking()} activeOpacity={0.9}>
          <Text style={styles.bookBtnT}>Book {RIDE_TYPES.find(r => r.id === selectedRide)?.label ?? 'Ride'}</Text>
          <Ionicons name="arrow-forward-circle" size={22} color={DARK} />
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: YELLOW },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10, backgroundColor: YELLOW,
  },
  locPill: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 },
  locText: { flex: 1 },
  locLabel: { fontSize: 10, color: '#555', fontWeight: '500' },
  locCity: { fontSize: 14, fontWeight: '800', color: DARK, maxWidth: 220 },
  locSub: { fontSize: 11, color: '#555', marginTop: 1 },
  avatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: DARK,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarTxt: { color: YELLOW, fontWeight: '800', fontSize: 17 },

  // Map
  mapContainer: { height: MAP_HEIGHT, width: SCREEN_W, backgroundColor: '#c8d8e8', overflow: 'hidden' },
  map: { ...StyleSheet.absoluteFillObject },
  mapLoader: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.75)',
    alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  mapLoaderTxt: { fontSize: 13, color: DARK, fontWeight: '600' },
  recenterBtn: {
    position: 'absolute', bottom: 12, right: 12, width: 40, height: 40,
    borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.18, shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6, elevation: 5,
  },
  mapPill: {
    position: 'absolute', bottom: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
    shadowColor: '#000', shadowOpacity: 0.15, shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6, elevation: 4, maxWidth: SCREEN_W - 80,
  },
  mapPillTxt: { fontSize: 12, fontWeight: '700', color: DARK },

  // Custom marker
  markerOuter: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: YELLOW + '55',
    alignItems: 'center', justifyContent: 'center',
  },
  markerInner: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: DARK,
    alignItems: 'center', justifyContent: 'center',
  },

  // Scroll
  scroll: { flex: 1, backgroundColor: GREY },
  scrollContent: { paddingBottom: 32 },

  // Promo card
  promoCard: {
    margin: 16, borderRadius: 20, backgroundColor: YELLOW,
    flexDirection: 'row', alignItems: 'center', paddingVertical: 22, paddingHorizontal: 20,
    shadowColor: '#000', shadowOpacity: 0.14, shadowOffset: { width: 0, height: 4 },
    shadowRadius: 14, elevation: 8, overflow: 'hidden',
  },
  promoGreet: { fontSize: 13, color: '#555', fontWeight: '500', marginBottom: 4 },
  promoTitle: { fontSize: 24, fontWeight: '800', color: DARK, lineHeight: 30 },
  promoBadge: {
    marginTop: 12, alignSelf: 'flex-start', backgroundColor: DARK,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
  },
  promoBadgeT: { color: YELLOW, fontSize: 11, fontWeight: '700' },
  promoBike: { marginLeft: 8, opacity: 0.8 },

  // Cards
  card: {
    backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 12, borderRadius: 18,
    padding: 16, shadowColor: '#000', shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 2,
  },
  cardTitle: {
    fontSize: 12, fontWeight: '700', color: SECONDARY, textTransform: 'uppercase',
    letterSpacing: 0.8, marginBottom: 14,
  },

  // Ride grid
  rideGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  rideItem: {
    flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 14,
    marginHorizontal: 3, backgroundColor: GREY, position: 'relative', overflow: 'hidden',
  },
  rideItemActive: {
    backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 4,
  },
  rideIconWrap: {
    width: 50, height: 50, borderRadius: 25, alignItems: 'center',
    justifyContent: 'center', marginBottom: 4,
  },
  rideLabel: { fontSize: 11, fontWeight: '600', color: SECONDARY },
  rideFare: { fontSize: 10, color: '#AAAAAA', marginTop: 2, fontWeight: '500' },
  rideBar: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, borderRadius: 2 },

  // Search bar
  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: GREY,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14,
    marginBottom: 12, borderWidth: 1.5, borderColor: BORDER, gap: 10,
  },
  searchPH: { flex: 1, fontSize: 15, color: '#AAAAAA', fontWeight: '500' },
  micBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: YELLOW + '50', alignItems: 'center', justifyContent: 'center',
  },

  // Place rows
  placeRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 11,
    borderTopWidth: 1, borderTopColor: BORDER, gap: 12,
  },
  placeIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  placeText: { flex: 1 },
  placeName: { fontSize: 14, fontWeight: '600', color: DARK },
  placeSub: { fontSize: 12, color: SECONDARY, marginTop: 1 },

  // Services
  servicesRow: { flexDirection: 'row', justifyContent: 'space-between' },
  svcChip: { alignItems: 'center', flex: 1, gap: 6 },
  svcIcon: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  svcLabel: { fontSize: 11, fontWeight: '600', color: DARK, textAlign: 'center' },

  // Offer
  offerBanner: {
    marginHorizontal: 16, marginBottom: 12, backgroundColor: YELLOW + '40',
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1.5, borderColor: YELLOW,
  },
  offerText: { flex: 1, fontSize: 13, color: DARK, fontWeight: '500' },
  offerCode: { fontWeight: '800', color: '#E65100' },

  // Book button
  bookBtn: {
    marginHorizontal: 16, backgroundColor: YELLOW, borderRadius: 16,
    paddingVertical: 17, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 10,
    shadowColor: YELLOW, shadowOpacity: 0.5, shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12, elevation: 6,
  },
  bookBtnT: { fontSize: 17, fontWeight: '800', color: DARK, letterSpacing: 0.5 },
});
