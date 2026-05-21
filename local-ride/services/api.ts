// API Configuration
import { Platform } from 'react-native';

// Android Emulator routes localhost traffic through 10.0.2.2
// iOS Simulator and physical devices on the same network use the machine's LAN IP
const MACHINE_IP = '192.168.29.155';
const API_BASE_URL = Platform.OS === 'android'
  ? 'http://10.0.2.2:5001'           // Android Emulator → host machine localhost
  : `http://${MACHINE_IP}:5001`;     // iOS Simulator / physical device

export const fetchRideHistory = async (userId: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/rides/user/${userId}`);
    if (!response.ok) {
      throw new Error('Failed to fetch rides');
    }
    const json = await response.json();
    return json.data || [];
  } catch (error) {
    throw error;
  }
};

export const bookRide = async (rideData: any) => {
  console.log('Booking ridedata...', rideData);
  try {
    const response = await fetch(`${API_BASE_URL}/api/rides`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(rideData),
    });

    console.log('response', response);
    if (!response.ok) {
      let errMsg = 'Failed to book ride';
      try {
        const errBody = await response.json();
        if (errBody?.error) errMsg = errBody.error;
      } catch {}
      throw new Error(errMsg);
    }
    const json = await response.json();
    return json.data;
  } catch (error) {
    throw error;
  }
};

export const deleteRide = async (id: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/api/rides/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    let errMsg = 'Failed to delete ride';
    try {
      const errBody = await response.json();
      if (errBody?.error) errMsg = errBody.error;
    } catch {}
    throw new Error(errMsg);
  }
};

export { API_BASE_URL };

export const createPaymentOrder = async (amount: number, rideId: string) => {
  const response = await fetch(`${API_BASE_URL}/api/payments/create-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, rideId }),
  });
  const json = await response.json();
  if (!json.success) throw new Error(json.error || 'Failed to create payment order');
  return json.order; // Razorpay order object { id, amount, currency, ... }
};

export const verifyPayment = async (data: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  rideId?: string;
}) => {
  const response = await fetch(`${API_BASE_URL}/api/payments/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await response.json();
  if (!json.success) throw new Error(json.error || 'Payment verification failed');
  return json;
};

export const updateRidePayment = async (
  rideId: string,
  data: { paymentMethod: string; paymentStatus: string },
): Promise<void> => {
  await fetch(`${API_BASE_URL}/api/payments/${rideId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
};
