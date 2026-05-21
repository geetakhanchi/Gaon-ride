import express from 'express';
import Ride from '../models/Ride.js';

const router = express.Router();

// Get all rides for a user
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const rides = await Ride.find({ userId }).sort({ createdAt: -1 });
    res.json({
      success: true,
      data: rides,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get a single ride by ID
router.get('/:id', async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id);
    if (!ride) {
      return res.status(404).json({
        success: false,
        error: 'Ride not found',
      });
    }
    res.json({
      success: true,
      data: ride,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Create a new ride (for testing)
router.post('/', async (req, res) => {
  try {
    const ride = new Ride(req.body);
    await ride.save();
    res.status(201).json({
      success: true,
      data: ride,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

// Update a ride
router.put('/:id', async (req, res) => {
  try {
    const ride = await Ride.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!ride) {
      return res.status(404).json({
        success: false,
        error: 'Ride not found',
      });
    }
    res.json({
      success: true,
      data: ride,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

// Delete a ride
router.delete('/:id', async (req, res) => {
  try {
    const ride = await Ride.findByIdAndDelete(req.params.id);
    if (!ride) {
      return res.status(404).json({
        success: false,
        error: 'Ride not found',
      });
    }
    res.json({
      success: true,
      message: 'Ride deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
