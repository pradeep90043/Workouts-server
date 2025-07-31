const mongoose = require('mongoose');
const Workout = require('../models/Workout');
const seedExercisesForNewUser = require('../utils/cloneDemoUser');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/workouts');

async function testSeeding() {
  try {
    console.log('=== Starting Test ===');
    
    // 1. Create a test user ID
    const testUserId = 'test-user-' + Date.now();
    console.log(`Using test user ID: ${testUserId}`);
    
    // 2. Check demo exercises
    const demoExercises = await Workout.find({ userId: 'demo-user' });
    console.log(`Found ${demoExercises.length} demo exercises`);
    
    if (demoExercises.length === 0) {
      console.error('No demo exercises found. Please run addCoreAndCardioExercises.js first.');
      return;
    }
    
    // 3. Run the seeding function
    console.log('\n=== Seeding Exercises ===');
    const result = await seedExercisesForNewUser(testUserId);
    
    // 4. Verify the results
    console.log('\n=== Verifying Results ===');
    const userExercises = await Workout.find({ userId: testUserId });
    console.log(`✅ Successfully found ${userExercises.length} exercises for test user`);
    
    console.log('\nSample Exercise:');
    if (userExercises.length > 0) {
      const sample = userExercises[0];
      console.log({
        name: sample.name,
        muscleGroup: sample.muscleGroup,
        userId: sample.userId,
        statsCount: sample.stats?.length || 0
      });
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n=== Test Complete ===');
    process.exit();
  }
}

testSeeding();
