const User = require('../models/User');
const ErrorResponse = require('../utils/errorResponse');

// Helper function to send error response
const sendErrorResponse = (res, statusCode, message, errorCode = '') => {
    return res.status(statusCode).json({
        success: false,
        message,
        ...(errorCode && { error: errorCode })
    });
};

// @desc    Register user
// @route   POST /api/v1/auth/register
// @access  Public
exports.register = async (req, res, next) => {
    console.log('Register request body:', req.body);
    
    try {
        const { username, email, password } = req.body;

        // Validate required fields
        if (!username || !email || !password) {
            console.log('Missing required fields', username, email, password);
            return sendErrorResponse(res, 400, 'Please provide all required fields');
        }

        // Check if user already exists
        try {
            const existingUser = await User.findOne({ email });
            if (existingUser) {
                console.log('Registration attempt with existing email:', email);
                return sendErrorResponse(res, 400, 'Email already exists', 'DUPLICATE_EMAIL');
            }
        } catch (dbError) {
            console.error('Database error during user lookup:', dbError);
            return sendErrorResponse(res, 500, 'Error checking user existence');
        }

        // Create user
        let user;
        try {
            user = await User.create({
                username,
                email,
                password
            });
            console.log('User created successfully:', { id: user._id, email: user.email });
        } catch (createError) {
            console.error('Error creating user:', createError);
            if (createError.code === 11000) {
                return sendErrorResponse(res, 400, 'Email already exists', 'DUPLICATE_EMAIL');
            }
            return sendErrorResponse(res, 500, 'Error creating user account');
        }

        // Send token response
        try {
            return sendToken(user, 201, res);
        } catch (tokenError) {
            console.error('Error generating token:', tokenError);
            return sendErrorResponse(res, 500, 'Error generating authentication token');
        }
    } catch (err) {
        console.error('Unexpected error in register controller:', err);
        return sendErrorResponse(res, 500, 'An unexpected error occurred');
    }
};

// @desc    Login user
// @route   POST /api/v1/auth/login
// @access  Public
exports.login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        // Validate email & password
        if (!email || !password) {
            return next(new ErrorResponse('Please provide an email and password', 400));
        }

        // Check for user
        const user = await User.findOne({ email }).select('+password');

        if (!user) {
            return next(new ErrorResponse('Invalid credentials', 401));
        }

        // Check if password matches
        const isMatch = await user.matchPassword(password);

        if (!isMatch) {
            return next(new ErrorResponse('Invalid credentials', 401));
        }

        sendToken(user, 200, res);
    } catch (err) {
        next(err);
    }
};

// @desc    Get current logged in user
// @route   GET /api/v1/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);
        
        res.status(200).json({
            success: true,
            data: user
        });
    } catch (err) {
        next(err);
    }
};

// Helper function to get token from model, create cookie and send response
const sendToken = (user, statusCode, res) => {
    try {
        if (!user || !user._id || !user.email) {
            console.error('Invalid user object in sendToken:', user);
            throw new Error('Invalid user data');
        }

        // Create token
        const token = user.getSignedJwtToken();
        if (!token) {
            throw new Error('Failed to generate authentication token');
        }

        const cookieExpireDays = parseInt(process.env.JWT_COOKIE_EXPIRE) || 30;
        const options = {
            expires: new Date(Date.now() + cookieExpireDays * 24 * 60 * 60 * 1000),
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: '/'
        };

        // Prepare user data for response (exclude sensitive info)
        const userData = {
            id: user._id,
            username: user.username,
            email: user.email
        };

        console.log('Sending token response for user:', userData.email);
        
        return res
            .status(statusCode)
            .cookie('token', token, options)
            .json({
                success: true,
                token,
                user: userData
            });
            
    } catch (error) {
        console.error('Error in sendToken:', error);
        // If headers haven't been sent yet, we can send an error response
        if (!res.headersSent) {
            return res.status(500).json({
                success: false,
                message: 'Error generating authentication response',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
        // If headers were already sent, we can't send a response, just log the error
        console.error('Headers already sent, could not send error response');
    }
};

// In your authController.js
exports.logout = async (req, res) => {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) {
        return res.status(400).json({ success: false, message: 'No token provided' });
      }
      
      // Add token to blacklist (pseudocode)
      await TokenBlacklist.create({ token, expiresAt: new Date(token.exp * 1000) });
      
      // Clear the refresh token cookie if using cookies
      res.clearCookie('refreshToken');
      
      return res.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
      console.error('Logout error:', error);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
  };