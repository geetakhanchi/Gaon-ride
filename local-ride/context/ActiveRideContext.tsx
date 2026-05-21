import React, { createContext, useContext, useState } from 'react';

export interface ActiveRideDriver {
    id: string;
    firstName: string;
    lastName: string;
    rating: number;
    trips: number;
    plate: string;
    vehicleColor: string;
    vehicleModel: string;
    languages: string[];
    etaToPickup: number;
    avatarColor: string;
}

interface ActiveRideCtxValue {
    activeRide: ActiveRideDriver | null;
    setActiveRide: (r: ActiveRideDriver | null) => void;
    rideMinimized: boolean;
    setRideMinimized: (v: boolean) => void;
}

const ActiveRideCtx = createContext<ActiveRideCtxValue>({
    activeRide: null,
    setActiveRide: () => {},
    rideMinimized: false,
    setRideMinimized: () => {},
});

export function ActiveRideProvider({ children }: { children: React.ReactNode }) {
    const [activeRide, setRide] = useState<ActiveRideDriver | null>(null);
    const [rideMinimized, setRideMinimized] = useState(false);

    const setActiveRide = (r: ActiveRideDriver | null) => {
        setRide(r);
        if (!r) setRideMinimized(false);
    };

    return (
        <ActiveRideCtx.Provider value={{ activeRide, setActiveRide, rideMinimized, setRideMinimized }}>
            {children}
        </ActiveRideCtx.Provider>
    );
}

export function useActiveRide() {
    return useContext(ActiveRideCtx);
}
