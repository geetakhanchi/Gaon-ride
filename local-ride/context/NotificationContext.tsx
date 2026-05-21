import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Types ──────────────────────────────────────────────────────────────────
export type NotificationCategory =
  | 'ride'        // Ride booked, driver assigned, ride completed
  | 'payment'     // Payment confirmed, refund issued
  | 'safety'      // SOS triggered, route deviation, emergency alert
  | 'promo'       // Offers, discounts, referral rewards
  | 'system';     // App updates, policy changes

export interface AppNotification {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  timestamp: number;      // Unix ms
  read: boolean;
  actionRoute?: string;   // e.g. '/booking', '/safety', '/payment'
  meta?: Record<string, string>; // extra data (rideId, amount, etc.)
}

interface NotificationContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  addNotification: (n: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextValue>({
  notifications: [],
  unreadCount: 0,
  addNotification: () => {},
  markRead: () => {},
  markAllRead: () => {},
  clearAll: () => {},
});

const STORAGE_KEY = '@notifications';

// ── Seed notifications shown on first install ──────────────────────────────
const SEED_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'seed-1',
    category: 'promo',
    title: '🎉 Welcome to Gaon Ride!',
    body: 'Your first 3 rides are 20% off. Use code GAON20 at checkout.',
    timestamp: Date.now() - 1000 * 60 * 5,
    read: false,
    actionRoute: '/payment',
  },
  {
    id: 'seed-2',
    category: 'safety',
    title: '🛡️ Safety features enabled',
    body: 'Set up your emergency contacts in Safety Hub for a safer ride experience.',
    timestamp: Date.now() - 1000 * 60 * 60,
    read: false,
    actionRoute: '/safety',
  },
  {
    id: 'seed-3',
    category: 'system',
    title: 'Complete your profile',
    body: 'Add a profile photo and verify your phone number to build trust with drivers.',
    timestamp: Date.now() - 1000 * 60 * 60 * 2,
    read: false,
    actionRoute: '/personal-info',
  },
];

// ── Provider ───────────────────────────────────────────────────────────────
export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [seeded, setSeeded] = useState(false);

  // Load from AsyncStorage on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (raw) {
        try {
          const parsed: AppNotification[] = JSON.parse(raw);
          setNotifications(parsed);
        } catch {}
      } else {
        // First launch — show seed notifications
        setNotifications(SEED_NOTIFICATIONS);
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_NOTIFICATIONS));
      }
      setSeeded(true);
    });
  }, []);

  // Persist whenever notifications change (after initial seed)
  useEffect(() => {
    if (!seeded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
  }, [notifications, seeded]);

  const addNotification = useCallback(
    (n: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => {
      const newN: AppNotification = {
        ...n,
        id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: Date.now(),
        read: false,
      };
      setNotifications(prev => [newN, ...prev]);
    },
    [],
  );

  const markRead = useCallback((id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n)),
    );
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, addNotification, markRead, markAllRead, clearAll }}>
      {children}
    </NotificationContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────
export const useNotifications = () => useContext(NotificationContext);
