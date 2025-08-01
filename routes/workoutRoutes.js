const express = require('express');
const router = express.Router();
const Workout = require('../models/Workout');
const { protect } = require('../middleware/auth');

// Apply protect middleware to all routes
router.use(protect);

/**
 * @route GET /api/v1/workouts/summary
 * @desc Get workout summary grouped by date, muscle group, and exercise
 * @query startDate - Start date for filtering (ISO format)
 * @query endDate - End date for filtering (ISO format)
 */
// server/routes/workoutRoutes.js
router.get('/summary', async (req, res, next) => {
    console.log('Summary request - User ID:', req.user.id, 'Username:', req.user.username);
    
    try {
      const workouts = await Workout.find({
        userId: req.user.username
      });
  
      // Flatten exercises by muscle group
      const muscleGroupMap = {};
  
      workouts.forEach(workout => {
        const { _id, name, muscleGroup, stats } = workout;
  
        if (!muscleGroupMap[muscleGroup]) {
          muscleGroupMap[muscleGroup] = [];
        }
  
        muscleGroupMap[muscleGroup].push({
          id: _id, // exercise document id
          name,
          muscleGroup,
          stats
        });
      });
  
      // Convert to array format
      const muscleGroups = Object.entries(muscleGroupMap).map(
        ([name, exercises]) => ({
          name,
          exercises
        })
      );
  
      res.status(200).json({
        status: 'success',
        statusCode: 200,
        muscleGroups
      });
    } catch (error) {
      console.error('Error in /summary:', error);
      res.status(500).json({
        status: 'error',
        statusCode: 500,
        message: 'Failed to fetch workout summary',
        error: error.message
      });
    }
  });
  

/**
 * @route POST /api/workouts
 * @desc Add new exercise stats (creates new exercise entry)
 * @body {
 *   name: string (required),
 *   muscleGroup: string (required),
 *   sets: [{
 *     reps: number (required),
 *     weight: number (optional, default: 0),
 *     rest: number (optional, default: 60)
 *   }],
 *   notes: string (optional)
 * }
 */
router.post('/', async (req, res, next) => {
    try {
        const { name, muscleGroup, sets, notes, rating, duration } = req.body;
        const currentDate = new Date();
        const userId = req.user.id;

        // Validate required fields
        if (!name || !muscleGroup || !Array.isArray(sets) || sets.length === 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Missing required fields: name, muscleGroup, or sets'
            });
        }

        // Validate each set in the exercise
        for (const [setIndex, set] of sets.entries()) {
            if (set.reps === undefined) {
                return res.status(400).json({
                    status: 'error',
                    message: `Set ${setIndex + 1} is missing required 'reps' field`
                });
            }
        }

        // Find all workout documents for the user
        let workouts = await Workout.find({ userId: req.user.id });

        // If no workouts exist, create one
        if (workouts.length === 0) {
            const newWorkout = new Workout({
                userId: req.user.id,
                exercises: [],
                notes: 'Workout Tracker',
                completed: true
            });
            await newWorkout.save();
            workouts = [newWorkout];
        }
        console.log({ workouts })

        // For now, we'll work with the first workout
        // In a real app, you might want to create a new workout per session or per day
        // Format the date to compare just the date part (ignoring time)
        const statsDate = new Date(currentDate);
        statsDate.setHours(0, 0, 0, 0);

        // Prepare the new stats entry
        const newStats = {
            date: statsDate,
            sets: sets.map((set, index) => ({
                setNumber: index + 1,
                reps: set.reps,
                weight: set.weight || 0,
                rest: set.rest || 60,
                completed: true,
                notes: ''
            })),
            notes: notes || '',
            rating: rating || 1,
            duration: duration || 0
        };

        // Always create a new exercise entry for POST
        const firstWorkout = workouts[0];
        firstWorkout.exercises.push({
            name: name,
            muscleGroup: muscleGroup,
            userId: userId,
            stats: [newStats]
        });
        const savedWorkout = await firstWorkout.save();

        return res.status(201).json({
            status: 'success',
            message: 'New exercise stats added successfully',
            data: savedWorkout
        });
    } catch (error) {
        console.error('Error adding workout:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error adding workout',
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

/**
 * @route PUT /api/workouts/:exerciseId
 * @desc Update existing exercise stats
 * @params exerciseId - ID of the exercise to update
 * @body {
 *   sets: [{
 *     reps: number (required),
 *     weight: number (optional, default: 0),
 *     rest: number (optional, default: 60)
 *   }],
 *   notes: string (optional)
 * }
 */
router.put('/:exerciseId', async (req, res, next) => {
    try {
        const { exerciseId } = req.params;
        const { sets, notes, rating, duration } = req.body;
        const currentDate = new Date();
        const userId = req.user.id;

        // Validate required fields
        if (!Array.isArray(sets) || sets.length === 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Sets array is required'
            });
        }

        // Find the exercise within the user's workouts
        const workout = await Workout.findOne({
            'exercises._id': exerciseId,
            userId: userId
        });
        
        if (!workout) {
            return res.status(404).json({
                status: 'error',
                message: 'Exercise not found or not authorized'
            });
        }
        
        // Find the specific exercise
        const exercise = workout.exercises.id(exerciseId);
        if (!exercise) {
            return res.status(404).json({
                status: 'error',
                message: 'Exercise not found'
            });
        }



        // Format the date to compare just the date part (ignoring time)
        const statsDate = new Date(currentDate);
        statsDate.setHours(0, 0, 0, 0);

        // Prepare the new stats entry
        const newStats = {
            date: statsDate,
            sets: sets.map((set, index) => ({
                setNumber: index + 1,
                reps: set.reps || 0,
                weight: set.weight || 0,
                rest: set.rest || 60,
                completed: true,
                notes: ''
            })),
            notes: notes || '',
            rating: rating || 1,
            duration: duration || 0
        };

        // Check if stats already exist for this date in the exercise
        const statsIndex = exercise.stats.findIndex(stat => {
            const statDate = new Date(stat.date);
            statDate.setHours(0, 0, 0, 0);
            return statDate.getTime() === statsDate.getTime();
        });

        if (statsIndex >= 0) {
            // Update existing stats
            exercise.stats.set(statsIndex, newStats);
        } else {
            // Add new stats
            exercise.stats.push(newStats);
        }

        // Mark the exercise as modified to ensure Mongoose saves the changes
        workout.markModified('exercises');
        
        // Save the updated workout
        const savedWorkout = await workout.save();

        console.log('Exercise updated successfully:', {
            workoutId: savedWorkout._id,
            exerciseName: exercise.name
        });

        return res.status(200).json({
            status: 'success',
            message: 'Exercise stats updated successfully',
            data: savedWorkout
        });
    } catch (error) {
        console.error('Error adding workout:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error adding workout',
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

module.exports = router;
