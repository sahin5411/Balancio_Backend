const mongoose = require('mongoose');

// Prevent multiple connections in serverless environments
let cachedDb = null;

const connectToDatabase = async () => {
  // Use cached connection if available
  if (cachedDb) {
    console.log('Using cached database connection');
    return cachedDb;
  }

  // Check if we're already connecting
  if (mongoose.connection.readyState >= 1) {
    console.log('Using existing database connection');
    return mongoose.connection;
  }

  try {
    console.log('Connecting to MongoDB...');
    const connection = await mongoose.connect(process.env.MONGODB_URI, {
      // Serverless-specific options
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      bufferMaxEntries: 0,
      bufferCommands: false,
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('MongoDB connected successfully');
    cachedDb = connection;
    return connection;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw new Error('Failed to connect to database');
  }
};

// Gracefully close the connection
const closeDatabaseConnection = async () => {
  if (cachedDb) {
    await mongoose.connection.close();
    cachedDb = null;
    console.log('MongoDB connection closed');
  }
};

module.exports = {
  connectToDatabase,
  closeDatabaseConnection
};