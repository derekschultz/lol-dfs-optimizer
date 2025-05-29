/**
 * Global Error Handling Middleware
 * Provides consistent error responses and logging
 */

class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";

    Error.captureStackTrace(this, this.constructor);
  }
}

const handleDatabaseError = (error) => {
  if (error.code === "ER_DUP_ENTRY" || error.code === "23505") {
    return new AppError("Duplicate entry found", 409);
  }
  if (error.code === "ER_NO_REFERENCED_ROW_2" || error.code === "23503") {
    return new AppError("Referenced resource not found", 400);
  }
  return new AppError("Database operation failed", 500);
};

const handleValidationError = (error) => {
  const message = Object.values(error.errors)
    .map((val) => val.message)
    .join(". ");
  return new AppError(`Validation Error: ${message}`, 400);
};

const handleCastError = (error) => {
  const message = `Invalid ${error.path}: ${error.value}`;
  return new AppError(message, 400);
};

const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack,
  });
};

const sendErrorProd = (err, res) => {
  // Only send operational errors to client in production
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  } else {
    // Don't leak error details in production
    console.error("ERROR 💥", err);
    res.status(500).json({
      status: "error",
      message: "Something went wrong!",
    });
  }
};

const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  if (process.env.NODE_ENV === "development") {
    sendErrorDev(err, res);
  } else {
    let error = { ...err };
    error.message = err.message;

    // Handle specific error types
    if (error.name === "CastError") error = handleCastError(error);
    if (error.name === "ValidationError") error = handleValidationError(error);
    if (
      error.code &&
      (error.code.startsWith("ER_") || error.code.startsWith("23"))
    ) {
      error = handleDatabaseError(error);
    }

    sendErrorProd(error, res);
  }
};

// Async error handling wrapper
const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

module.exports = {
  AppError,
  errorHandler,
  catchAsync,
};
