export const errorHandler = (err, req, res, next) => {
  console.error(err);

  const status = err.statusCode || 500;
  const message = err.message || "Error interno del servidor";
  const errorCode = err.errorCode || "SERVER_ERROR";

  res.status(status).json({
    error: errorCode,
    message
  });
};
