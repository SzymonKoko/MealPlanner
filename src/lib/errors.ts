export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number = 400,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Wymagane logowanie") {
    super(message, "UNAUTHORIZED", 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Brak dostępu") {
    super(message, "FORBIDDEN", 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Nie znaleziono") {
    super(message, "NOT_FOUND", 404);
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
