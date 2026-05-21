/**
 * live-trip.tsx — Live Trip Tracking Screen
 *
 * Shows real-time speed data for:
 *  • Passenger (via GPS)
 *  • Driver (simulated with smooth variation around a base speed)
 *
 * Emergency contacts added to the trip can also view this data.
 * No real user data is transmitted — contacts display is local/demo only.
 */

import React, {
    useState, useEffect, useRef, useCallback, useMemo,
} from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView,
    SafeAreaView, StatusBar, Alert, Animated, Platform,
    Vibration, Dimensions,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAppSettings } from '@/context/AppSettingsContext';

const YELLOW  = '#FFC82C';
const DARK    = '#0F0F0F';
const { width: SW } = Dimensions.get('window');

// ─── Types ────────────────────────────────────────────────────────────────────
interface SpeedPoint { time: number; speed: number; }
interface SharedContact { id: string; name: string; relation: string; color: string; }

// ─── Helpers ──────────────────────────────────────────────────────────────────
/** Convert m/s to km/h */
const msToKmh = (ms: number) => Math.round(ms * 3.6);

/** Smooth random walk for driver speed simulation */
function nextDriverSpeed(prev: number, baseSpeed: number): number {
    const delta = (Math.random() - 0.5) * 8;          // ±4 km/h per tick
    let next = prev + delta;
    // Slowly drift back to base speed
    next = next + (baseSpeed - next) * 0.12;
    return Math.max(0, Math.min(80, next));
}

/** Color coding for speed zones */
function speedColor(kmh: number): string {
    if (kmh < 20)  return '#4CAF50';  // slow / safe
    if (kmh < 45)  return '#FFC82C';  // moderate
    if (kmh < 65)  return '#FF9800';  // fast
    return '#F44336';                  // very fast
}

/** Format seconds to mm:ss */
function fmtDuration(s: number): string {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
}

// ─── Speed Gauge component ────────────────────────────────────────────────────
function SpeedGauge({ kmh, label, icon, accentColor }: {
    kmh: number; label: string; icon: string; accentColor: string;
}) {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const prevKmh   = useRef(kmh);

    useEffect(() => {
        if (Math.abs(kmh - prevKmh.current) > 5) {
            Animated.sequence([
                Animated.timing(scaleAnim, { toValue: 1.06, duration: 120, useNativeDriver: true }),
                Animated.timing(scaleAnim, { toValue: 1,    duration: 120, useNativeDriver: true }),
            ]).start();
        }
        prevKmh.current = kmh;
    }, [kmh, scaleAnim]);

    return (
        <Animated.View style={[gs.gaugeCard, { transform: [{ scale: scaleAnim }], borderColor: accentColor }]}>
            <View style={[gs.gaugeIconWrap, { backgroundColor: accentColor + '20' }]}>
                <Ionicons name={icon as any} size={20} color={accentColor} />
            </View>
            <Text style={[gs.gaugeBig, { color: accentColor }]}>{kmh}</Text>
            <Text style={gs.gaugeUnit}>km/h</Text>
            <Text style={gs.gaugeLabel}>{label}</Text>
        </Animated.View>
    );
}

// ─── Mini speed graph ─────────────────────────────────────────────────────────
function SpeedGraph({ points, color, width }: { points: SpeedPoint[]; color: string; width: number }) {
    if (points.length < 2) return null;
    const maxSpeed = Math.max(80, ...points.map(p => p.speed));
    const h = 40;
    const w = width - 32;
    const coords = points.map((p, i) => ({
        x: (i / (points.length - 1)) * w,
        y: h - (p.speed / maxSpeed) * h,
    }));
    // Build SVG-style path string as simple dot indicators (RN has no SVG built-in)
    return (
        <View style={{ height: h + 10, marginHorizontal: 16, marginTop: 4 }}>
            <View style={{ height: h, backgroundColor: color + '10', borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
                {coords.map((c, i) => (
                    <View
                        key={i}
                        style={{
                            position: 'absolute',
                            left: c.x - 1.5,
                            top: c.y - 1.5,
                            width: 3,
                            height: 3,
                            borderRadius: 1.5,
                            backgroundColor: color,
                            opacity: 0.5 + (i / coords.length) * 0.5,
                        }}
                    />
                ))}
            </View>
            <Text style={{ fontSize: 9, color: '#888', textAlign: 'right', marginTop: 2 }}>Last 30 s</Text>
        </View>
    );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function LiveTripScreen() {
    const router  = useRouter();
    const params  = useLocalSearchParams<{
        rideType?:     string;
        driverName?:   string;
        driverPlate?:  string;
        driverModel?:  string;
        pickupLat?:    string;
        pickupLng?:    string;
        destLat?:      string;
        destLng?:      string;
        pickup?:       string;
        destination?:  string;
        fare?:         string;
        etaMin?:       string;
    }>();
    const { colors, isDark } = useAppSettings();
    const s = makeStyles(colors);

    // ── GPS / speed state ─────────────────────────────────────────────────────
    const [locationGranted,  setLocationGranted]  = useState<boolean | null>(null);
    const [mySpeedKmh,       setMySpeedKmh]       = useState(0);
    const [driverSpeedKmh,   setDriverSpeedKmh]   = useState(0);
    const [myPosition,       setMyPosition]       = useState<{lat: number; lng: number} | null>(null);
    const [driverPosition,   setDriverPosition]   = useState<{lat: number; lng: number} | null>(null);
    const [tripPath,         setTripPath]         = useState<{latitude: number; longitude: number}[]>([]);
    const [elapsed,          setElapsed]          = useState(0);   // seconds
    const [tripActive,       setTripActive]       = useState(true);
    const [sharingActive,    setSharingActive]    = useState(true);
    const [mySpeedHistory,   setMySpeedHistory]   = useState<SpeedPoint[]>([]);
    const [driverSpeedHistory, setDriverSpeedHistory] = useState<SpeedPoint[]>([]);
    const [maxMySpeed,       setMaxMySpeed]       = useState(0);
    const [maxDriverSpeed,   setMaxDriverSpeed]   = useState(0);
    const [distanceTravelled, setDistanceTravelled] = useState(0);  // km

    const locationSub   = useRef<Location.LocationSubscription | null>(null);
    const driverSimRef  = useRef<ReturnType<typeof setInterval> | null>(null);
    const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null);
    const lastCoord     = useRef<{lat: number; lng: number} | null>(null);
    const mapRef        = useRef<MapView>(null);
    const driverSpeedRef = useRef(30);  // base driver speed

    // ── Parse params ──────────────────────────────────────────────────────────
    const pickupCoords = useMemo(() => {
        const lat = parseFloat(params.pickupLat ?? '0');
        const lng = parseFloat(params.pickupLng ?? '0');
        return lat && lng ? { lat, lng } : null;
    }, [params.pickupLat, params.pickupLng]);

    const destCoords = useMemo(() => {
        const lat = parseFloat(params.destLat ?? '0');
        const lng = parseFloat(params.destLng ?? '0');
        return lat && lng ? { lat, lng } : null;
    }, [params.destLat, params.destLng]);

    // ── Shared contacts (demo) ────────────────────────────────────────────────
    const sharedContacts = useMemo<SharedContact[]>(() => [
        { id: '1', name: 'Maa',       relation: 'Mother',  color: '#E91E63' },
        { id: '2', name: 'Bhai',      relation: 'Brother', color: '#2196F3' },
        { id: '3', name: 'Ramesh K.', relation: 'Friend',  color: '#4CAF50' },
    ], []);

    // ── Haversine distance (km) ───────────────────────────────────────────────
    const haversine = useCallback((a: {lat:number;lng:number}, b: {lat:number;lng:number}): number => {
        const R = 6371;
        const dLat = (b.lat - a.lat) * Math.PI / 180;
        const dLng = (b.lng - a.lng) * Math.PI / 180;
        const s = Math.sin(dLat / 2) ** 2
            + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180)
            * Math.sin(dLng / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
    }, []);

    // ── Start GPS subscription ────────────────────────────────────────────────
    const startGPS = useCallback(async () => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
            setLocationGranted(false);
            return;
        }
        setLocationGranted(true);

        locationSub.current = await Location.watchPositionAsync(
            {
                accuracy:          Location.Accuracy.BestForNavigation,
                timeInterval:      1000,
                distanceInterval:  2,
            },
            (loc) => {
                const speedMs  = loc.coords.speed ?? 0;
                const speedKmh = msToKmh(Math.max(0, speedMs));
                const coord    = { lat: loc.coords.latitude, lng: loc.coords.longitude };

                setMySpeedKmh(speedKmh);
                setMyPosition(coord);
                setMaxMySpeed(prev => Math.max(prev, speedKmh));
                setMySpeedHistory(prev => [
                    ...prev.slice(-29),
                    { time: Date.now(), speed: speedKmh },
                ]);

                // Accumulate distance
                if (lastCoord.current) {
                    const d = haversine(lastCoord.current, coord);
                    setDistanceTravelled(prev => Math.round((prev + d) * 100) / 100);
                }
                lastCoord.current = coord;

                setTripPath(prev => [
                    ...prev,
                    { latitude: coord.lat, longitude: coord.lng },
                ]);
            },
        );
    }, [haversine]);

    // ── Simulate driver position & speed ──────────────────────────────────────
    const startDriverSim = useCallback(() => {
        if (!pickupCoords) return;
        // Start driver near pickup, moving towards destination
        const startLat = pickupCoords.lat - 0.004;
        const startLng = pickupCoords.lng + 0.003;
        setDriverPosition({ lat: startLat, lng: startLng });

        driverSimRef.current = setInterval(() => {
            driverSpeedRef.current = nextDriverSpeed(driverSpeedRef.current, 35);
            const kmh = Math.round(driverSpeedRef.current);
            setDriverSpeedKmh(kmh);
            setMaxDriverSpeed(prev => Math.max(prev, kmh));
            setDriverSpeedHistory(prev => [
                ...prev.slice(-29),
                { time: Date.now(), speed: kmh },
            ]);
            // Move driver marker slowly toward destination
            setDriverPosition(prev => {
                if (!prev || !destCoords) return prev;
                const step = 0.0001 * (driverSpeedRef.current / 30);
                const dlat = (destCoords.lat - prev.lat) * step;
                const dlng = (destCoords.lng - prev.lng) * step;
                return { lat: prev.lat + dlat, lng: prev.lng + dlng };
            });
        }, 1500);
    }, [pickupCoords, destCoords]);

    // ── Trip timer ────────────────────────────────────────────────────────────
    const startTimer = useCallback(() => {
        timerRef.current = setInterval(() => {
            setElapsed(e => e + 1);
        }, 1000);
    }, []);

    // ── Lifecycle ─────────────────────────────────────────────────────────────
    useEffect(() => {
        startGPS();
        startDriverSim();
        startTimer();
        return () => {
            locationSub.current?.remove();
            if (driverSimRef.current) clearInterval(driverSimRef.current);
            if (timerRef.current)     clearInterval(timerRef.current);
        };
    }, [startGPS, startDriverSim, startTimer]);

    // ── Speed alert when driver exceeds 70 km/h ───────────────────────────────
    const prevDriverAlert = useRef(false);
    useEffect(() => {
        if (driverSpeedKmh > 70 && !prevDriverAlert.current) {
            prevDriverAlert.current = true;
            Vibration.vibrate([0, 200, 100, 200]);
            Alert.alert(
                '⚠️ High Speed Alert',
                `Your driver is travelling at ${driverSpeedKmh} km/h. If you feel unsafe, tap SOS below.`,
                [{ text: 'OK' }, { text: 'SOS', onPress: handleSOS, style: 'destructive' }],
            );
        } else if (driverSpeedKmh < 60) {
            prevDriverAlert.current = false;
        }
    }, [driverSpeedKmh]);

    const handleSOS = useCallback(() => {
        Vibration.vibrate(500);
        Alert.alert(
            '🚨 SOS Sent',
            'Emergency alert sent to Gaon Ride safety team and all shared contacts with your live location.',
            [{ text: 'OK' }],
        );
    }, []);

    const handleStopSharing = useCallback(() => {
        Alert.alert(
            'Stop Live Sharing?',
            'Your emergency contacts will no longer see your live location and speed.',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Stop Sharing', style: 'destructive', onPress: () => setSharingActive(false) },
            ],
        );
    }, []);

    const handleEndTrip = useCallback(() => {
        Alert.alert(
            'End Trip?',
            'This will stop all tracking and return to home.',
            [
                { text: 'Keep Going', style: 'cancel' },
                {
                    text: 'End Trip', style: 'destructive',
                    onPress: () => {
                        setTripActive(false);
                        locationSub.current?.remove();
                        if (driverSimRef.current) clearInterval(driverSimRef.current);
                        if (timerRef.current)     clearInterval(timerRef.current);
                        router.replace('/(tabs)');
                    },
                },
            ],
        );
    }, [router]);

    const mySpeedColor     = speedColor(mySpeedKmh);
    const driverSpeedColor = speedColor(driverSpeedKmh);

    const initialRegion = useMemo(() => {
        const lat = myPosition?.lat ?? pickupCoords?.lat ?? 26.85;
        const lng = myPosition?.lng ?? pickupCoords?.lng ?? 80.94;
        return { latitude: lat, longitude: lng, latitudeDelta: 0.012, longitudeDelta: 0.012 };
    }, []);  // Only set once — map controls its own camera after

    return (
        <SafeAreaView style={s.safe}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

            {/* ── Header ── */}
            <View style={s.header}>
                <TouchableOpacity onPress={handleEndTrip} style={s.backBtn} activeOpacity={0.7}>
                    <Ionicons name="arrow-back" size={22} color={colors.text} />
                </TouchableOpacity>
                <View style={s.headerCenter}>
                    <View style={s.liveDot} />
                    <Text style={s.headerTitle}>Live Trip</Text>
                </View>
                <View style={s.timerPill}>
                    <Ionicons name="timer-outline" size={13} color={YELLOW} />
                    <Text style={s.timerTxt}>{fmtDuration(elapsed)}</Text>
                </View>
            </View>

            <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} bounces={false}>

                {/* ── Map ── */}
                <View style={s.mapWrap}>
                    <MapView
                        ref={mapRef}
                        provider={PROVIDER_GOOGLE}
                        style={s.map}
                        initialRegion={initialRegion}
                        showsUserLocation={locationGranted === true}
                        showsMyLocationButton={false}
                    >
                        {/* Route path */}
                        {tripPath.length > 1 && (
                            <Polyline
                                coordinates={tripPath}
                                strokeColor={YELLOW}
                                strokeWidth={3}
                            />
                        )}

                        {/* Driver marker */}
                        {driverPosition && (
                            <Marker
                                coordinate={{ latitude: driverPosition.lat, longitude: driverPosition.lng }}
                                anchor={{ x: 0.5, y: 0.5 }}
                            >
                                <View style={[s.driverMarker, { borderColor: driverSpeedColor }]}>
                                    <MaterialCommunityIcons name="car" size={16} color={driverSpeedColor} />
                                    <Text style={[s.driverMarkerSpd, { color: driverSpeedColor }]}>{driverSpeedKmh}</Text>
                                </View>
                            </Marker>
                        )}

                        {/* Destination marker */}
                        {destCoords && (
                            <Marker
                                coordinate={{ latitude: destCoords.lat, longitude: destCoords.lng }}
                                anchor={{ x: 0.5, y: 1 }}
                            >
                                <View style={s.destMarker}>
                                    <Ionicons name="flag" size={18} color="#fff" />
                                </View>
                            </Marker>
                        )}
                    </MapView>

                    {/* Location permission overlay */}
                    {locationGranted === false && (
                        <View style={s.permOverlay}>
                            <Ionicons name="location-off-outline" size={32} color="#FF4444" />
                            <Text style={s.permTxt}>Location permission denied</Text>
                            <Text style={s.permSub}>Speed tracking requires location access</Text>
                        </View>
                    )}
                </View>

                {/* ── Speed Gauges ── */}
                <View style={s.section}>
                    <Text style={[s.sectionTitle, { color: colors.text }]}>Live Speed</Text>
                    <View style={s.gaugeRow}>
                        <SpeedGauge
                            kmh={mySpeedKmh}
                            label="Your Speed"
                            icon="walk-outline"
                            accentColor={mySpeedColor}
                        />
                        <View style={s.gaugeDivider} />
                        <SpeedGauge
                            kmh={driverSpeedKmh}
                            label="Driver Speed"
                            icon="car-outline"
                            accentColor={driverSpeedColor}
                        />
                    </View>

                    {/* Speed bar comparison */}
                    <View style={s.speedBarWrap}>
                        <View style={[s.speedBar, { width: `${Math.min(100, (mySpeedKmh / 80) * 100)}%`, backgroundColor: mySpeedColor }]} />
                    </View>
                    <Text style={[s.speedBarLabel, { color: colors.subText }]}>Your speed vs 80 km/h limit</Text>
                    <View style={[s.speedBarWrap, { marginTop: 6 }]}>
                        <View style={[s.speedBar, { width: `${Math.min(100, (driverSpeedKmh / 80) * 100)}%`, backgroundColor: driverSpeedColor }]} />
                    </View>
                    <Text style={[s.speedBarLabel, { color: colors.subText }]}>Driver speed vs 80 km/h limit</Text>
                </View>

                {/* ── Speed history graphs ── */}
                {mySpeedHistory.length >= 2 && (
                    <View style={s.section}>
                        <Text style={[s.sectionTitle, { color: colors.text }]}>Speed History</Text>
                        <Text style={[s.graphLabel, { color: colors.subText }]}>Your speed</Text>
                        <SpeedGraph points={mySpeedHistory} color={mySpeedColor} width={SW} />
                        <Text style={[s.graphLabel, { color: colors.subText, marginTop: 8 }]}>Driver speed</Text>
                        <SpeedGraph points={driverSpeedHistory} color={driverSpeedColor} width={SW} />
                    </View>
                )}

                {/* ── Trip stats ── */}
                <View style={s.section}>
                    <Text style={[s.sectionTitle, { color: colors.text }]}>Trip Summary</Text>
                    <View style={s.statsGrid}>
                        <StatChip icon="speedometer-outline" label="Max Your Speed" value={`${maxMySpeed} km/h`} color={mySpeedColor} colors={colors} />
                        <StatChip icon="car-sport-outline"  label="Max Driver Speed" value={`${maxDriverSpeed} km/h`} color={driverSpeedColor} colors={colors} />
                        <StatChip icon="navigate-outline"   label="Distance"  value={`${distanceTravelled} km`} color="#2196F3" colors={colors} />
                        <StatChip icon="time-outline"       label="Duration"  value={fmtDuration(elapsed)} color="#9C27B0" colors={colors} />
                    </View>
                </View>

                {/* ── Driver info ── */}
                {(params.driverName || params.driverPlate) && (
                    <View style={s.section}>
                        <Text style={[s.sectionTitle, { color: colors.text }]}>Driver</Text>
                        <View style={[s.driverCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <View style={s.driverAvatar}>
                                <Text style={s.driverAvatarTxt}>
                                    {(params.driverName ?? 'D').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                </Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[s.driverName, { color: colors.text }]}>{params.driverName ?? 'Driver'}</Text>
                                <Text style={[s.driverSub, { color: colors.subText }]}>{params.driverModel ?? ''}</Text>
                            </View>
                            {params.driverPlate && (
                                <View style={s.platePill}>
                                    <Text style={s.plateTxt}>{params.driverPlate}</Text>
                                </View>
                            )}
                        </View>
                    </View>
                )}

                {/* ── Shared contacts ── */}
                <View style={s.section}>
                    <View style={s.sectionTitleRow}>
                        <Text style={[s.sectionTitle, { color: colors.text }]}>Shared With</Text>
                        {sharingActive
                            ? <View style={s.sharingBadge}><View style={s.sharingDot} /><Text style={s.sharingTxt}>Live</Text></View>
                            : <View style={[s.sharingBadge, { backgroundColor: '#eee' }]}><Text style={[s.sharingTxt, { color: '#888' }]}>Paused</Text></View>
                        }
                    </View>
                    <Text style={[s.sectionSub, { color: colors.subText }]}>
                        {sharingActive
                            ? 'These contacts can see your location and speed in real time'
                            : 'Live sharing is paused — contacts cannot see your trip'}
                    </Text>
                    {sharedContacts.map(c => (
                        <View key={c.id} style={[s.contactRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <View style={[s.contactAvatar, { backgroundColor: c.color }]}>
                                <Text style={s.contactAvatarTxt}>{c.name[0]}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[s.contactName, { color: colors.text }]}>{c.name}</Text>
                                <Text style={[s.contactRel, { color: colors.subText }]}>{c.relation}</Text>
                            </View>
                            {sharingActive && (
                                <View style={s.viewingBadge}>
                                    <Ionicons name="eye-outline" size={12} color="#2E7D32" />
                                    <Text style={s.viewingTxt}>Viewing</Text>
                                </View>
                            )}
                        </View>
                    ))}
                    <Text style={[s.addContactHint, { color: colors.subText }]}>
                        + Add more trusted contacts in Safety settings
                    </Text>
                </View>

                {/* ── What shared contacts see ── */}
                {sharingActive && (
                    <View style={[s.sharedViewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Ionicons name="eye-outline" size={18} color="#1565C0" />
                        <View style={{ flex: 1 }}>
                            <Text style={[s.sharedViewTitle, { color: colors.text }]}>Contacts can see</Text>
                            <Text style={[s.sharedViewSub, { color: colors.subText }]}>
                                Your location · Your speed ({mySpeedKmh} km/h) · Driver speed ({driverSpeedKmh} km/h) · Driver plate ({params.driverPlate ?? '—'}) · Trip duration
                            </Text>
                        </View>
                    </View>
                )}

                {/* ── Action buttons ── */}
                <View style={s.actionSection}>
                    {/* SOS */}
                    <TouchableOpacity style={s.sosBtn} onPress={handleSOS} activeOpacity={0.85}>
                        <Ionicons name="warning" size={22} color="#fff" />
                        <Text style={s.sosTxt}>SOS Emergency</Text>
                    </TouchableOpacity>

                    <View style={s.actionRow}>
                        {/* Stop / resume sharing */}
                        <TouchableOpacity
                            style={[s.actionBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
                            onPress={sharingActive ? handleStopSharing : () => setSharingActive(true)}
                            activeOpacity={0.8}
                        >
                            <Ionicons
                                name={sharingActive ? 'eye-off-outline' : 'eye-outline'}
                                size={18}
                                color={sharingActive ? '#FF6B00' : '#2E7D32'}
                            />
                            <Text style={[s.actionBtnTxt, { color: sharingActive ? '#FF6B00' : '#2E7D32' }]}>
                                {sharingActive ? 'Pause Sharing' : 'Resume Sharing'}
                            </Text>
                        </TouchableOpacity>

                        {/* End trip */}
                        <TouchableOpacity
                            style={[s.actionBtn, { borderColor: '#FF4444', backgroundColor: '#FFEBEE' }]}
                            onPress={handleEndTrip}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="stop-circle-outline" size={18} color="#C62828" />
                            <Text style={[s.actionBtnTxt, { color: '#C62828' }]}>End Trip</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={{ height: 32 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

// ─── StatChip ─────────────────────────────────────────────────────────────────
function StatChip({ icon, label, value, color, colors }: {
    icon: string; label: string; value: string; color: string; colors: any;
}) {
    return (
        <View style={[sc.chip, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name={icon as any} size={18} color={color} />
            <Text style={[sc.value, { color }]}>{value}</Text>
            <Text style={[sc.label, { color: colors.subText }]}>{label}</Text>
        </View>
    );
}
const sc = StyleSheet.create({
    chip:  { width: '47%', alignItems: 'center', padding: 12, borderRadius: 14, borderWidth: 1, gap: 4 },
    value: { fontSize: 17, fontWeight: '800' },
    label: { fontSize: 10, fontWeight: '500', textAlign: 'center' },
});

// ─── SpeedGauge styles ────────────────────────────────────────────────────────
const gs = StyleSheet.create({
    gaugeCard:     { flex: 1, alignItems: 'center', paddingVertical: 16, borderWidth: 2, borderRadius: 18 },
    gaugeIconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
    gaugeBig:      { fontSize: 40, fontWeight: '900', lineHeight: 44 },
    gaugeUnit:     { fontSize: 12, fontWeight: '600', color: '#888', marginTop: 2 },
    gaugeLabel:    { fontSize: 11, fontWeight: '600', color: '#888', marginTop: 4 },
});

// ─── Screen styles ────────────────────────────────────────────────────────────
const makeStyles = (colors: any) => StyleSheet.create({
    safe:            { flex: 1, backgroundColor: colors.bg },
    scroll:          { flex: 1 },
    header:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
    backBtn:         { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.inputBg, justifyContent: 'center', alignItems: 'center' },
    headerCenter:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    headerTitle:     { fontSize: 17, fontWeight: '800', color: colors.text },
    liveDot:         { width: 8, height: 8, borderRadius: 4, backgroundColor: '#F44336' },
    timerPill:       { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: DARK, gap: 4 },
    timerTxt:        { fontSize: 13, fontWeight: '700', color: YELLOW },

    mapWrap:         { height: 220, position: 'relative', backgroundColor: colors.inputBg },
    map:             { ...StyleSheet.absoluteFillObject },
    permOverlay:     { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', gap: 8 },
    permTxt:         { fontSize: 16, fontWeight: '700', color: '#fff' },
    permSub:         { fontSize: 12, color: 'rgba(255,255,255,0.7)' },

    driverMarker:    { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#fff', paddingHorizontal: 7, paddingVertical: 4, borderRadius: 14, borderWidth: 2, shadowColor: '#000', shadowOpacity: 0.2, shadowOffset: { width: 0, height: 2 }, shadowRadius: 3, elevation: 4 },
    driverMarkerSpd: { fontSize: 11, fontWeight: '800' },
    destMarker:      { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F44336', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },

    section:         { marginHorizontal: 16, marginTop: 18 },
    sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
    sectionTitle:    { fontSize: 15, fontWeight: '800', marginBottom: 10 },
    sectionSub:      { fontSize: 12, marginBottom: 10, lineHeight: 18 },

    gaugeRow:        { flexDirection: 'row', gap: 12, alignItems: 'stretch' },
    gaugeDivider:    { width: 1, backgroundColor: colors.border },

    speedBarWrap:    { height: 8, backgroundColor: colors.border, borderRadius: 4, marginTop: 12, overflow: 'hidden' },
    speedBar:        { height: '100%', borderRadius: 4 },
    speedBarLabel:   { fontSize: 10, marginTop: 3 },

    graphLabel:      { fontSize: 11, fontWeight: '600', marginHorizontal: 16, marginBottom: 2 },

    statsGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },

    driverCard:      { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
    driverAvatar:    { width: 46, height: 46, borderRadius: 23, backgroundColor: YELLOW, alignItems: 'center', justifyContent: 'center' },
    driverAvatarTxt: { fontSize: 17, fontWeight: '800', color: DARK },
    driverName:      { fontSize: 15, fontWeight: '700' },
    driverSub:       { fontSize: 12, marginTop: 2 },
    platePill:       { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: '#FFF8E1', borderWidth: 1, borderColor: YELLOW },
    plateTxt:        { fontSize: 13, fontWeight: '800', color: '#E65100' },

    contactRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
    contactAvatar:   { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    contactAvatarTxt:{ fontSize: 16, fontWeight: '800', color: '#fff' },
    contactName:     { fontSize: 14, fontWeight: '700' },
    contactRel:      { fontSize: 11, marginTop: 2 },
    viewingBadge:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: '#E8F5E9' },
    viewingTxt:      { fontSize: 10, fontWeight: '700', color: '#2E7D32' },
    addContactHint:  { fontSize: 11, marginTop: 4 },

    sharingBadge:    { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: '#FFEBEE' },
    sharingDot:      { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#F44336' },
    sharingTxt:      { fontSize: 11, fontWeight: '700', color: '#C62828' },

    sharedViewCard:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10, margin: 16, marginTop: 0, padding: 14, borderRadius: 14, borderWidth: 1 },
    sharedViewTitle: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
    sharedViewSub:   { fontSize: 11, lineHeight: 16 },

    actionSection:   { margin: 16, gap: 10 },
    sosBtn:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, borderRadius: 14, backgroundColor: '#C62828' },
    sosTxt:          { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
    actionRow:       { flexDirection: 'row', gap: 10 },
    actionBtn:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 14, borderWidth: 1.5 },
    actionBtnTxt:    { fontSize: 13, fontWeight: '700' },
});
