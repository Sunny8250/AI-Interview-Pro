import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({path: '.env.local'});
mongoose.connect(process.env.MONGODB_URI as string).then(async () => {
  const db = mongoose.connection.db;
  if (!db) { console.error('DB not connected'); process.exit(1); }
  const collection = db.collection('questionbanks');
  const mid = await collection.countDocuments({difficulty: 'Mid'});
  const entry = await collection.countDocuments({difficulty: 'Entry'});
  const senior = await collection.countDocuments({difficulty: 'Senior'});
  const none = await collection.countDocuments({difficulty: {$exists: false}});
  console.log('Mid:', mid, 'Entry:', entry, 'Senior:', senior, 'None:', none);
  process.exit(0);
});
