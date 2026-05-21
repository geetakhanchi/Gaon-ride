# Gaon Ride Backend API

## Setup

### 1. Install Dependencies
```bash
cd server
npm install
```

### 2. Create Environment File
Copy `.env.example` to `.env` and add your MongoDB URI:
```bash
cp .env.example .env
```

Edit `.env` and add your MongoDB connection string:
```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/gaon-ride?retryWrites=true&w=majority
PORT=5000
NODE_ENV=development
```

### 3. Start the Server
```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

The server will run on `http://localhost:5000`

## API Endpoints

### Get User Rides
```
GET /api/rides/user/:userId
```

### Get Single Ride
```
GET /api/rides/:id
```

### Create Ride (Testing)
```
POST /api/rides
Content-Type: application/json

{
  "userId": "user123",
  "rideType": "Bike",
  "icon": "motorbike",
  "color": "#FF6B00",
  "date": "Today at 10:30 AM",
  "pickup": "Sector 18, Noida",
  "dropoff": "Connaught Place, Delhi",
  "fare": "₹245",
  "duration": "45 min",
  "rating": 4.8,
  "driverName": "John Doe",
  "status": "completed"
}
```

### Update Ride
```
PUT /api/rides/:id
```

### Delete Ride
```
DELETE /api/rides/:id
```

## MongoDB Schema

Each ride document has the following fields:
- `userId`: User identifier
- `rideType`: Type of ride (Bike, Auto, Cab, Bike Taxi)
- `icon`: Icon name for the ride type
- `color`: Color code for the ride type
- `date`: Date and time of the ride
- `pickup`: Pickup location
- `dropoff`: Dropoff location
- `fare`: Fare amount
- `duration`: Trip duration
- `rating`: Driver rating (0-5)
- `driverName`: Driver's name
- `driverPhone`: Driver's phone
- `status`: Ride status (completed, cancelled, ongoing)
- `timestamps`: Auto-generated createdAt and updatedAt
