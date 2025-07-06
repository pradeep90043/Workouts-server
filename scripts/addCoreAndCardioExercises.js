const mongoose = require('mongoose');
const Workout = require('../models/Workout');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/workouts', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const userId = process.env.DEFAULT_USER_ID || 'demo-user';
const currentDate = new Date();

const coreExercises = [
  {
    name: 'Plank',
    muscleGroup: 'core',
    stats: [{
      date: currentDate,
      sets: [{ setNumber: 1, reps: 1, weight: 0, rest: 60, completed: false }],
      duration: 60, // seconds
      rating: 3
    }]
  },
  {
    name: 'Russian Twists',
    muscleGroup: 'core',
    stats: [{
      date: currentDate,
      sets: [
        { setNumber: 1, reps: 20, weight: 5, rest: 30, completed: false },
        { setNumber: 2, reps: 20, weight: 5, rest: 30, completed: false },
        { setNumber: 3, reps: 20, weight: 5, rest: 30, completed: false }
      ],
      rating: 4
    }]
  }
];

const cardioExercises = [
  {
    name: 'Running',
    muscleGroup: 'cardio',
    stats: [{
      date: currentDate,
      duration: 1800, // 30 minutes in seconds
      distance: 5000, // 5km in meters
      calories: 300,
      rating: 4
    }]
  },
  {
    name: 'Cycling',
    muscleGroup: 'cardio',
    stats: [{
      date: currentDate,
      duration: 1800, // 30 minutes
      distance: 10000, // 10km in meters
      calories: 250,
      rating: 4
    }]
  }
];

async function addExercises() {
  try {
    // Add core exercises
    for (const exercise of coreExercises) {
      const workout = new Workout({
        userId,
        date: currentDate,
        name: exercise.name,
        muscleGroup: exercise.muscleGroup,
        stats: exercise.stats,
        completed: false
      });
      await workout.save();
      console.log(`Added ${exercise.name} to ${exercise.muscleGroup}`);
    }

    // Add cardio exercises
    for (const exercise of cardioExercises) {
      const workout = new Workout({
        userId,
        date: currentDate,
        name: exercise.name,
        muscleGroup: exercise.muscleGroup,
        stats: exercise.stats,
        completed: false
      });
      await workout.save();
      console.log(`Added ${exercise.name} to ${exercise.muscleGroup}`);
    }

    console.log('Successfully added all exercises!');
    process.exit(0);
  } catch (error) {
    console.error('Error adding exercises:', error);
    process.exit(1);
  }
}

addExercises();
