import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, TextInput,
    ScrollView, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

const YELLOW = '#FFD700';
const DARK = '#1A1A1A';
const GREY = '#F5F5F5';
const BORDER = '#E8E8E8';
const SECONDARY = '#777';

const RIDE_META: Record<string, { icon: string; lib: string; color: string; fare: string; eta: string; desc: string }> = {
    '1': { icon: 'motorbike', lib: 'mci', color: '#FF6B00', fare: '₹35–55', eta: '3 min', desc: 'Bike Ride' },
    '2': { icon: 'auto-rickshaw', lib: 'mci', color: '#4CAF50', fare: '₹60–90', eta: '5 min', desc: 'Auto' },
    '3': { icon: 'car', lib: 'ionicons', color: '#2196F3', fare: '₹120–160', eta: '7 min', desc: 'Cab' },
    '4': { icon: 'motorcycle', lib: 'fa5', color: '#9C27B0', fare: '₹30–45', eta: '4 min', desc: 'Bike Taxi' },
};

const SUGGESTIONS = [
    'Sector 18, Noida', 'Connaught Place, Delhi', 'Indira Gandhi Airport',
    'Gurgaon Cyber Hub', 'Lajpat Nagar', 'Karol Bagh', 'Dwarka Sector 21',
];

function RideIcon({ meta }: { meta: typeof RIDE_META[string] }) {
    if (meta.lib === 'mci') return <MaterialCommunityIcons name={meta.icon as any} size={26} color={meta.color} />;
    if (meta.lib === 'fa5') return <FontAwesome5 name={meta.icon as any} size={22} color={meta.color} />;
    return <Ionicons name={meta.icon as any} size={24} color={meta.color} />;
}

export default function BookingScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ rideType: string; pickup: string; service?: string }>();
    const [destination, setDestination] = useState('');
    const [filtered, setFiltered] = useState(SUGGESTIONS);
    const [selectedDest, setSelectedDest] = useState('');
    const [isBooking, setIsBooking] = useState(false);

    const rideType = params.rideType ?? '1';
    const pickup = params.pickup ?? 'Current Location';
    const service = params.service ?? '';
    const meta = RIDE_META[rideType];

    const screenTitle = service
        ? service
        : meta?.desc ?? 'Book Ride';

    useEffect(() => {
        if (!destination.trim()) { setFiltered(SUGGESTIONS); return; }
        setFiltered(SUGGESTIONS.filter(s => s.toLowerCase().includes(destination.toLowerCase())));
    }, [destination]);

    const handleConfirm = () => {
        const dest = selectedDest || destination;
        if (!dest.trim()) { Alert.alert('Destination missing', 'Please enter your destination.'); return; }
        setIsBooking(true);
        setTimeout(() => {
            setIsBooking(false);
            Alert.alert(
                '🎉 Ride Confirmed!',
                `Your ${meta?.desc ?? 'ride'} is on its way!\nPickup: ${pickup}\nDrop: ${dest}\nEstimated fare: ${meta?.fare ?? 'N/A'}`,
                [{ text: 'OK', onPress: () => router.back() }],
            );
        }, 2000);
    };

    return (
        <SafeAreaView style={styles.root} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color={DARK} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{screenTitle}</Text>
                <View style={{ width: 38 }} />
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>

                {/* Ride type pill */}
                {!!meta && (
                    <View style={[styles.ridePill, { borderColor: meta.color + '40', backgroundColor: meta.color + '10' }]}>
                        <RideIcon meta={meta} />
                        <View style={styles.pillText}>
                            <Text style={styles.pillTitle}>{meta.desc}</Text>
                            <Text style={styles.pillSub}>ETA {meta.eta} · Fare {meta.fare}</Text>
                        </View>
                    </View>
                )}

                {/* Route card */}
                <View style={styles.routeCard}>
                    {/* Pickup */}
                    <View style={styles.routeRow}>
                        <View style={styles.dotGreen} />
                        <View style={styles.routeInputWrap}>
                            <Text style={styles.routeLabel}>Pickup</Text>
                            <Text style={styles.routeValue} numberOfLines={1}>{pickup}</Text>
                        </View>
                    </View>
                    <View style={styles.routeDivider} />
                    {/* Destination */}
                    <View style={styles.routeRow}>
                        <View style={styles.dotRed} />
                        <View style={styles.routeInputWrap}>
                            <Text style={styles.routeLabel}>Drop</Text>
                            <TextInput
                                style={styles.destInput}
                                placeholder="Enter destination"
                                placeholderTextColor="#AAAAAA"
                                value={destination}
                                onChangeText={t => { setDestination(t); setSelectedDest(''); }}
                                autoFocus={!service}
                            />
                        </View>
                    </View>
                </View>

                {/* Suggestions */}
                {!selectedDest && (
                    <View style={styles.suggestCard}>
                        <Text style={styles.suggestTitle}>
                            {destination ? 'Search Results' : 'Popular Places'}
                        </Text>
                        {filtered.length === 0 ? (
                            <Text style={styles.noResult}>No results found</Text>
                        ) : (
                            filtered.map((s, i) => (
                                <TouchableOpacity
                                    key={i}
                                    style={styles.suggestRow}
                                    onPress={() => { setSelectedDest(s); setDestination(s); }}
                                >
                                    <Ionicons name="location-outline" size={18} color={SECONDARY} />
                                    <Text style={styles.suggestText}>{s}</Text>
                                </TouchableOpacity>
                            ))
                        )}
                    </View>
                )}

                {/* Fare summary if destination chosen */}
                {!!selectedDest && meta && (
                    <View style={styles.fareCard}>
                        <View style={styles.fareRow}>
                            <Text style={styles.fareLabel}>Estimated Fare</Text>
                            <Text style={[styles.fareValue, { color: meta.color }]}>{meta.fare}</Text>
                        </View>
                        <View style={styles.fareRow}>
                            <Text style={styles.fareLabel}>ETA</Text>
                            <Text style={styles.fareValue}>{meta.eta} away</Text>
                        </View>
                        <View style={styles.fareRow}>
                            <Text style={styles.fareLabel}>Payment</Text>
                            <View style={styles.payRow}>
                                <Ionicons name="cash-outline" size={16} color={DARK} />
                                <Text style={styles.fareValue}>Cash</Text>
                            </View>
                        </View>
                    </View>
                )}
            </ScrollView>

            {/* Confirm button */}
            <View style={styles.confirmWrap}>
                <TouchableOpacity
                    style={[styles.confirmBtn, isBooking && { opacity: 0.7 }]}
                    onPress={handleConfirm}
                    disabled={isBooking}
                >
                    {isBooking
                        ? <ActivityIndicator color={DARK} />
                        : <>
                            <Text style={styles.confirmText}>Confirm {meta?.desc ?? 'Ride'}</Text>
                            <Ionicons name="arrow-forward-circle" size={22} color={DARK} />
                        </>
                    }
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#fff' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 12, backgroundColor: YELLOW,
    },
    backBtn: {
        width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.1)',
        alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: { fontSize: 17, fontWeight: '700', color: DARK },
    scroll: { padding: 16, paddingBottom: 120 },
    ridePill: {
        flexDirection: 'row', alignItems: 'center', borderWidth: 1.5,
        borderRadius: 14, padding: 14, marginBottom: 16, gap: 12,
    },
    pillText: { flex: 1 },
    pillTitle: { fontSize: 15, fontWeight: '700', color: DARK },
    pillSub: { fontSize: 12, color: SECONDARY, marginTop: 2 },
    routeCard: {
        backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16,
        shadowColor: '#000', shadowOpacity: 0.08, shadowOffset: { width: 0, height: 2 },
        shadowRadius: 8, elevation: 3, borderWidth: 1, borderColor: BORDER,
    },
    routeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    dotGreen: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#4CAF50' },
    dotRed: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#F44336' },
    routeDivider: {
        width: 2, height: 24, backgroundColor: BORDER, marginLeft: 5, marginVertical: 4,
    },
    routeInputWrap: { flex: 1 },
    routeLabel: { fontSize: 10, color: SECONDARY, fontWeight: '600', textTransform: 'uppercase', marginBottom: 2 },
    routeValue: { fontSize: 14, fontWeight: '600', color: DARK },
    destInput: { fontSize: 14, fontWeight: '600', color: DARK, padding: 0 },
    suggestCard: {
        backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16,
        shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 2 },
        shadowRadius: 8, elevation: 2,
    },
    suggestTitle: {
        fontSize: 11, fontWeight: '700', color: SECONDARY, textTransform: 'uppercase',
        letterSpacing: 0.8, marginBottom: 12,
    },
    noResult: { color: SECONDARY, fontSize: 14, textAlign: 'center', paddingVertical: 16 },
    suggestRow: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingVertical: 12, borderTopWidth: 1, borderTopColor: BORDER,
    },
    suggestText: { fontSize: 14, color: DARK, fontWeight: '500', flex: 1 },
    fareCard: {
        backgroundColor: GREY, borderRadius: 16, padding: 16, marginBottom: 16, gap: 12,
    },
    fareRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    fareLabel: { fontSize: 14, color: SECONDARY, fontWeight: '500' },
    fareValue: { fontSize: 15, fontWeight: '700', color: DARK },
    payRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    confirmWrap: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: 16, paddingBottom: Platform.OS === 'ios' ? 32 : 16,
        backgroundColor: '#fff',
        borderTopWidth: 1, borderTopColor: BORDER,
    },
    confirmBtn: {
        backgroundColor: YELLOW, borderRadius: 14, paddingVertical: 16,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
        shadowColor: YELLOW, shadowOpacity: 0.5, shadowOffset: { width: 0, height: 4 },
        shadowRadius: 10, elevation: 5,
    },
    confirmText: { fontSize: 17, fontWeight: '800', color: DARK },
});
