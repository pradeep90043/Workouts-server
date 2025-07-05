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
router.get('/summary', async (req, res) => {
    try {
        const { startDate = '1970-01-01', endDate = new Date().toISOString() } = req.query;

        const summary = await Workout.aggregate([
            {
                $match: {
                    userId: DEFAULT_USER_ID,
                    date: {
                        $gte: new Date(startDate),
                        $lte: new Date(endDate)
                    }
                }
            },
            { $unwind: '$exercises' },
            { $unwind: '$exercises.stats' },
            {
                $group: {
                    _id: {
                        id: '$_id',
                        exerciseName: '$exercises.name',
                        muscleGroup: '$exercises.muscleGroup'
                    },
                    totalSets: { $sum: { $size: '$exercises.stats.sets' } },
                    totalVolume: {
                        $sum: {
                            $reduce: {
                                input: '$exercises.stats.sets',
                                initialValue: 0,
                                in: {
                                    $add: [
                                        '$$value',
                                        { $multiply: ['$$this.reps', { $ifNull: ['$$this.weight', 0] }] }
                                    ]
                                }
                            }
                        }
                    },
                    exerciseStats: { 
                        $push: {
                            date: '$exercises.stats.date',
                            sets: '$exercises.stats.sets',
                            notes: '$exercises.stats.notes',
                            rating: '$exercises.stats.rating',
                            duration: '$exercises.stats.duration'
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 1,
                    totalSets: 1,
                    totalVolume: 1,
                    exercise: {
                        id: '$_id.exerciseId',
                        name: '$_id.exerciseName',
                        muscleGroup: '$_id.muscleGroup',
                        totalSets: '$totalSets',
                        totalVolume: '$totalVolume',
                        stats: '$exerciseStats'
                    }
                }
            },
            // Group by date and muscle group
            {
                $group: {
                    _id: {
                        date: '$_id.date',
                        muscleGroup: '$_id.muscleGroup'
                    },
                    exercises: { 
                        $push: {
                            id: '$_id.id',
                            name: '$exercise.name',
                            muscleGroup: '$exercise.muscleGroup',
                            totalSets: '$exercise.totalSets',
                            totalVolume: '$exercise.totalVolume',
                            stats: '$exercise.stats'
                        }
                    }
                }
            },
            // Final group by date
            {
                $group: {
                    _id: '$_id.date',
                    // date: { $first: '$_id.date' },
                    muscleGroups: {
                        $push: {
                            name: '$_id.muscleGroup',
                            exercises: '$exercises'
                        }
                    },
                    totalExercises: { $sum: { $size: '$exercises' } },
                    totalVolume: { 
                        $sum: {
                            $reduce: {
                                input: '$exercises',
                                initialValue: 0,
                                in: { $add: ['$$value', '$$this.totalVolume'] }
                            }
                        }
                    }
                }
            },
            { $sort: { _id: -1 } }
        ]);

        res.json({
            status: 'success',
            data: summary,
            meta: {
                startDate,
                endDate,
                totalWorkouts: summary.length
            }
        });
    } catch (error) {
        console.error('Error fetching workout summary:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch workout summary',
            error: process.env.NODE_ENV === 'development' ? error.message : {}
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
                message: 'Workout not found'
            });
        }
        
        // Find the exercise in the workout
        const exerciseToUpdate = workout.exercises.find(ex => 
            ex.name.toLowerCase() === req.body.name?.toLowerCase()
        );
        console.log({ exerciseToUpdate });
        if (!exerciseToUpdate) {
            return res.status(404).json({
                status: 'error',
                message: 'Exercise not found in the specified workout'
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
        const statsIndex = exerciseToUpdate.stats.findIndex(stat => {
            const statDate = new Date(stat.date);
            statDate.setHours(0, 0, 0, 0);
            return statDate.getTime() === statsDate.getTime();
        });

        if (statsIndex >= 0) {
            // Update existing stats
            exerciseToUpdate.stats.set(statsIndex, newStats);
        } else {
            // Add new stats
            exerciseToUpdate.stats.push(newStats);
        }

        // Save the updated workout
        const savedWorkout = await workout.save();
        
        console.log('Exercise updated successfully:', { 
            workoutId: savedWorkout._id,
            exerciseName: exerciseToUpdate.name
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
