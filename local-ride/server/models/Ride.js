import mongoose from 'mongoose';

const rideSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
    },
    rideType: {
      type: String,
      enum: ['bike', 'auto', 'cab', 'bike_taxi', 'private_car', 'jeep', 'private_bus', 'govt_bus', 'car_taxi',],
      required: true,
    },
    date: {
      type: String,
      required: true,
    },
    pickup: {
      type: String,
      required: true,
    },
    dropoff: {
      type: String,
      required: true,
    },
    fare: {
      type: String,
      required: true,
    },
    duration: {
      type: String,
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 0,
      max: 5,
    },
    driverName: {
      type: String,
      default: '',
    },
    driverPhone: {
      type: String,
      default: '',
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'razorpay'],
      default: 'cash',
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed'],
      default: 'pending',
    },
    razorpayOrderId:   { type: String, default: '' },
    razorpayPaymentId: { type: String, default: '' },
    status: {
      type: String,
      enum: ['completed', 'cancelled', 'ongoing'],
      default: 'completed',
    },
  },
  { timestamps: true }
);

export default mongoose.model('Ride', rideSchema);
