import express from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import Ride from '../models/Ride.js';

const router = express.Router();

// Guard: return helpful error if keys not configured yet
const getRazorpay = () => {
  const keyId     = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || keyId.includes('REPLACE') || !keySecret || keySecret.includes('REPLACE')) {
    throw new Error(
      'Razorpay keys not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to server/.env'
    );
  }
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
};

// POST /api/payments/create-order
// Called by the app just before opening Razorpay checkout
router.post('/create-order', async (req, res) => {
  try {
    const { amount, rideId } = req.body;
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid amount' });
    }
    const razorpay = getRazorpay();
    const order = await razorpay.orders.create({
      amount: Math.round(Number(amount)) * 100, // ₹ → paise
      currency: 'INR',
      receipt: `ride_${rideId ?? Date.now()}`,
    });
    // Save the Razorpay order ID on the ride document
    if (rideId) {
      await Ride.findByIdAndUpdate(rideId, {
        razorpayOrderId: order.id,
        paymentStatus: 'pending',
      }).catch(() => {});
    }
    res.json({ success: true, order });
  } catch (err) {
    console.error('❌ [payments/create-order]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/payments/verify
// Called after user completes Razorpay checkout — verifies signature & marks ride paid
router.post('/verify', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, rideId } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, error: 'Missing payment fields' });
    }
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expected = crypto
      .createHmac('sha256', keySecret)
      .update(body)
      .digest('hex');
    if (expected !== razorpay_signature) {
      return res.status(400).json({ success: false, error: 'Payment verification failed — invalid signature' });
    }
    // Mark ride as paid
    if (rideId) {
      await Ride.findByIdAndUpdate(rideId, {
        paymentMethod:    'razorpay',
        paymentStatus:    'paid',
        razorpayPaymentId: razorpay_payment_id,
      }).catch(() => {});
    }
    res.json({ success: true, paymentId: razorpay_payment_id });
  } catch (err) {
    console.error('❌ [payments/verify]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/payments/:rideId/status
// Update payment method/status (e.g. confirm cash payment at drop-off)
router.patch('/:rideId/status', async (req, res) => {
  try {
    const { paymentMethod, paymentStatus } = req.body;
    const ride = await Ride.findByIdAndUpdate(
      req.params.rideId,
      { paymentMethod, paymentStatus },
      { new: true, runValidators: true },
    );
    if (!ride) return res.status(404).json({ success: false, error: 'Ride not found' });
    res.json({ success: true, data: ride });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
