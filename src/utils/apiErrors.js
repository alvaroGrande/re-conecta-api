export default class ApiError extends Error {
  constructor(statusCode, message, errorCode = "GENERIC_ERROR") {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}
