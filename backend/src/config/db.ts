import mongoose from 'mongoose';

export async function connectDB(): Promise<void> {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('[Database] MONGO_URI is not defined in .env file');
    process.exit(1);
  }
  
  try {
    await mongoose.connect(mongoUri);
    console.log('[Database] MongoDB connected successfully.');
  } catch (err) {
    console.error('[Database] MongoDB connection error:', err);
    process.exit(1);
  }
}

export async function disconnectDB(): Promise<void> {
  try {
    await mongoose.disconnect();
    console.log('[Database] MongoDB disconnected successfully.');
  } catch (err) {
    console.error('[Database] MongoDB disconnection error:', err);
  }
}
