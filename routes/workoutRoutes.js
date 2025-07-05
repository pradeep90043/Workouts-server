const express = require('express');
const router = express.Router();
const Workout = require('../models/Workout');

// Default user ID to use when authentication is bypassed
const DEFAULT_USER_ID = 'demo-user';

/**
 * @route GET /api/workouts/summary
 * @desc Get workout summary grouped by date, muscle group, and exercise
 * @query startDate - Start date for filtering (ISO format)
 * @query endDate - End date for filtering (ISO format)
 */
// server/routes/workoutRoutes.js
router.get('/summary', async (req, res) => {
    try {
        const summary = await Workout.aggregate([
            {
                $match: {
                    userId: process.env.DEFAULT_USER_ID || 'demo-user'
                }
            },
            {
                $group: {
                    _id: {
                        date: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
                        muscleGroup: '$muscleGroup',
                        exerciseName: '$name',
                        exerciseId: '$_id'
                    },
                    totalSets: { $sum: { $size: '$stats' } },
                    totalVolume: {
                        $sum: {
                            $reduce: {
                                input: '$stats',
                                initialValue: 0,
                                in: {
                                    $add: [
                                        '$$value',
                                        {
                                            $multiply: [
                                                { $sum: '$$this.sets.reps' },
                                                { $avg: '$$this.sets.weight' }
                                            ]
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    stats: { $first: '$stats' }
                }
            },
            {
                $group: {
                    _id: {
                        date: '$_id.date',
                        muscleGroup: '$_id.muscleGroup'
                    },
                    exercises: {
                        $push: {
                            id: '$_id.exerciseId',
                            name: '$_id.exerciseName',
                            totalSets: '$totalSets',
                            totalVolume: '$totalVolume',
                            stats: '$stats'  // Keep stats as array
                        }
                    }
                }
            },
            {
                $group: {
                    _id: '$_id.date',
                    date: { $first: '$_id.date' },
                    muscleGroups: {
                        $push: {
                            name: '$_id.muscleGroup',
                            exercises: '$exercises'
                        }
                    }
                }
            },
            { $sort: { _id: -1 } }
        ]);

        res.status(200).json({
            status: 'success',
            data: summary
        });
    } catch (error) {
        console.error('Error in /summary:', error);
        res.status(500).json({
            status: 'error',
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
router.post('/', async (req, res) => {
    try {
        const { name, muscleGroup, sets, notes, rating, duration } = req.body;
        const currentDate = new Date();

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
        let workouts = await Workout.find({ userId: DEFAULT_USER_ID });

        // If no workouts exist, create one
        if (workouts.length === 0) {
            const newWorkout = new Workout({
                userId: DEFAULT_USER_ID,
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
            muscleGroup: muscleGroup.toLowerCase(),
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
router.put('/:exerciseId', async (req, res) => {
    try {
        const { exerciseId } = req.params;
        const { sets, notes, rating, duration } = req.body;
        const currentDate = new Date();

        // Validate required fields
        if (!Array.isArray(sets) || sets.length === 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Sets array is required'
            });
        }

        // Find the workout by ID
        const workout = await Workout.findById(exerciseId);
        console.log({ workout });
        if (!workout) {
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

        // Check if stats already exist for this date
        const statsIndex = workout.stats.findIndex(stat => {
            const statDate = new Date(stat.date);
            statDate.setHours(0, 0, 0, 0);
            return statDate.getTime() === statsDate.getTime();
        });

        if (statsIndex >= 0) {
            // Update existing stats
            workout.stats.set(statsIndex, newStats);
        } else {
            // Add new stats
            workout.stats.push(newStats);
        }

        // Save the updated workout
        const savedWorkout = await workout.save();
        
        console.log('Exercise updated successfully:', { 
            workoutId: savedWorkout._id,
            exerciseName: workout.name
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
