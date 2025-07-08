require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const workoutRoutes = require('./routes/workoutRoutes');
const authRoutes = require('./routes/authRoutes');

const app = express();

// Middleware
app.use(cors({
    origin: ['http://localhost:3001', 'http://localhost:3000', 'http://127.0.0.1:3001',"http://localhost:19006",'http://192.168.0.115:19006',  // Add this
        'http://192.168.0.115:3001'  ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204
}));
app.use(express.json());
app.use(cookieParser());

// Request logging with morgan
const requestLogFormat = ':date[iso] :method :url :status :response-time ms - :res[content-length]';

// Log all requests to console
app.use(morgan(requestLogFormat, {
    skip: (req) => req.originalUrl === '/api/health' // Skip health check logs
}));

// Detailed request logging for development
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev', {
        skip: (req) => req.originalUrl === '/api/health'
    }));
}

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
    });
});

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/workouts', workoutRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ 
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : {}
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ message: 'Not Found' });
});

// MongoDB connection
const connectDB = async () => {
    const mongoURI = process.env.MONGODB_URI || process.env.MONGODB_LOCAL_URI || 'mongodb://127.0.0.1:27017/workouts';
    console.log(`Connecting to MongoDB at: ${mongoURI}`);
    
    try {
        await mongoose.connect(mongoURI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
            connectTimeoutMS: 10000
        });
        console.log('MongoDB connected successfully');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
};

// Start the server
const startServer = async () => {
    try {
        await connectDB();
        const PORT = process.env.PORT || 8080;
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
            console.log(`API available at http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();
