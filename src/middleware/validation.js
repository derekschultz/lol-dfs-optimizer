/**
 * Request Validation Middleware
 * Provides reusable validation functions for API endpoints
 */

const { AppError } = require('./errorHandler');

// Validation helper functions
const isValidNumber = (value, min = null, max = null) => {
  const num = parseFloat(value);
  if (isNaN(num)) return false;
  if (min !== null && num < min) return false;
  if (max !== null && num > max) return false;
  return true;
};

const isValidString = (value, minLength = 1, maxLength = 255) => {
  if (typeof value !== 'string') return false;
  return value.length >= minLength && value.length <= maxLength;
};

const isValidPosition = (position) => {
  const validPositions = ['TOP', 'JNG', 'MID', 'ADC', 'SUP', 'TEAM', 'CPT'];
  return validPositions.includes(position);
};

// Player validation schemas
const validatePlayerData = (req, res, next) => {
  const { name, team, position, salary, projectedPoints, ownership } = req.body;
  const errors = [];

  // Required fields
  if (!isValidString(name, 1, 100)) {
    errors.push('Name must be a string between 1 and 100 characters');
  }
  
  if (!isValidString(team, 1, 50)) {
    errors.push('Team must be a string between 1 and 50 characters');
  }
  
  if (!isValidPosition(position)) {
    errors.push('Position must be one of: TOP, JNG, MID, ADC, SUP, TEAM, CPT');
  }
  
  if (!isValidNumber(salary, 0, 100000)) {
    errors.push('Salary must be a number between 0 and 100000');
  }
  
  if (!isValidNumber(projectedPoints, 0, 200)) {
    errors.push('Projected points must be a number between 0 and 200');
  }

  // Optional fields
  if (ownership !== undefined && !isValidNumber(ownership, 0, 100)) {
    errors.push('Ownership must be a number between 0 and 100');
  }

  if (errors.length > 0) {
    return next(new AppError(`Validation failed: ${errors.join(', ')}`, 400));
  }

  next();
};

// ID parameter validation
const validateId = (req, res, next) => {
  const { id } = req.params;
  
  if (!id || (isNaN(parseInt(id)) && typeof id !== 'string')) {
    return next(new AppError('Invalid ID parameter', 400));
  }

  next();
};

// File upload validation
const validateFileUpload = (req, res, next) => {
  if (!req.file) {
    return next(new AppError('No file uploaded', 400));
  }

  const allowedTypes = ['.csv', '.json'];
  const fileExt = req.file.originalname.toLowerCase().split('.').pop();
  
  if (!allowedTypes.includes(`.${fileExt}`)) {
    return next(new AppError(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`, 400));
  }

  // File size limit (10MB)
  if (req.file.size > 10 * 1024 * 1024) {
    return next(new AppError('File too large. Maximum size is 10MB', 400));
  }

  next();
};

module.exports = {
  validatePlayerData,
  validateId,
  validateFileUpload,
  isValidNumber,
  isValidString,
  isValidPosition
};