class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.name = this.constructor.name;
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Không tìm thấy tài nguyên') {
    super(message, 404);
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Không có quyền truy cập') {
    super(message, 403);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Chưa xác thực') {
    super(message, 401);
  }
}

class ConflictError extends AppError {
  constructor(message = 'Xung đột dữ liệu') {
    super(message, 409);
  }
}

class ValidationError extends AppError {
  constructor(message = 'Dữ liệu không hợp lệ') {
    super(message, 400);
  }
}

export { AppError, NotFoundError, ForbiddenError, UnauthorizedError, ConflictError, ValidationError };
