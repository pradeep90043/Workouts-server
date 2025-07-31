const Workout = require('../models/Workout'); // your workout model

async function seedExercisesForNewUser(newUserId) {
  console.log(`\n=== Starting exercise seeding for user ${newUserId} ===`);
  
  try {
    // 1. Verify input
    if (!newUserId || typeof newUserId !== 'string') {
      throw new Error(`Invalid user ID: ${newUserId}`);
    }
    
    // 2. Get template exercises from demo-user
    console.log('Looking for demo exercises...');
    const demoExercises = await Workout.find({ userId: 'demo-user' });
    console.log(`Found ${demoExercises.length} demo exercises to clone`);

    if (demoExercises.length === 0) {
      const errorMsg = 'No demo exercises found for demo-user. Please run the addCoreAndCardioExercises.js script first.';
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    // 3. Clone and prepare exercises for new user
    console.log('Cloning exercises...');
    const clonedExercises = demoExercises.map((exercise, index) => {
      try {
        const copy = JSON.parse(JSON.stringify(exercise)); // Deep clone to avoid mongoose weirdness
        delete copy._id;
        copy.userId = newUserId;
        copy.createdAt = new Date();
        copy.updatedAt = new Date();
        
        // Log first exercise details for verification
        if (index === 0) {
          console.log('Sample exercise being cloned:', {
            name: copy.name,
            muscleGroup: copy.muscleGroup,
            statsCount: copy.stats?.length || 0,
            userId: copy.userId
          });
        }
        
        return copy;
      } catch (mapError) {
        console.error(`Error processing exercise at index ${index}:`, mapError);
        throw mapError;
      }
    });

    // 4. Insert cloned exercises
    console.log('Inserting cloned exercises...');
    const result = await Workout.insertMany(clonedExercises, { ordered: false });
    
    console.log(`✅ Successfully seeded ${result.length} exercises for user ${newUserId}`);
    return result;
    
  } catch (err) {
    console.error('❌ Error in seedExercisesForNewUser:', {
      message: err.message,
      name: err.name,
      code: err.code,
      stack: err.stack
    });
    
    // Check if it's a validation error
    if (err.name === 'ValidationError') {
      console.error('Validation errors:', err.errors);
    }
    
    // Check if it's a bulk write error
    if (err.name === 'BulkWriteError' && err.writeErrors) {
      console.error('Bulk write errors:', err.writeErrors);
    }
    
    throw err; // Re-throw to be handled by the caller
  }
}
module.exports = seedExercisesForNewUser;