const mongoose = require('mongoose');
const Workout = require('../models/Workout');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/workouts');

async function checkUserExercises(userId) {
  try {
    console.log(`Checking exercises for user: ${userId}`);
    const exercises = await Workout.find({ userId });
    console.log(`Found ${exercises.length} exercises for user ${userId}:`);
    
    exercises.forEach((ex, index) => {
      console.log(`\n${index + 1}. ${ex.name} (${ex.muscleGroup})`);
      console.log(`   ID: ${ex._id}`);
      console.log(`   Created: ${ex.createdAt}`);
      console.log(`   Stats: ${ex.stats.length} entries`);
    });
    
    return exercises;
  } catch (error) {
    console.error('Error checking user exercises:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
  }
}

// Get user ID from command line argument or use 'demo-user' as default
const userId = process.argv[2] || 'demo-user';
checkUserExercises(userId)
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
