import logger from '../logger.js';

export const errorHandler = (err, req, res, next) => {
  // Loggear el error
  logger.error({
    err,
    req: {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body
    }
  }, 'Error en request');

  // Status code
  const status = err.statusCode || err.status || 500;
  
  // Mensaje de error
  const message = err.isOperational 
    ? err.message 
    : 'Error interno del servidor';

  // Error code
  const errorCode = err.errorCode || 'SERVER_ERROR';

  // Respuesta diferente según ambiente
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  res.status(status).json({
    error: errorCode,
    message,
    ...(isDevelopment && { stack: err.stack, details: err })
  });
};
