import mongoose from 'mongoose';

let isConnected = false;// Variable to track the connection status

// Local MongoDB connection URL
const MONGODB_URI = 'mongodb://localhost:27017/pricewise';

export const connectToDB = async () => {
  mongoose.set('strictQuery', true);

  if(isConnected) return console.log('=> using existing database connection');

  try {
    await mongoose.connect(MONGODB_URI);

    isConnected = true;

    console.log('MongoDB Connected to local database');
  } catch (error) {
    console.log('MongoDB connection error:', error)
  }
}