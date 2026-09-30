export class SafeError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  readonly retryable: boolean;
  readonly failureCategory: string;

  constructor(
    code: string,
    httpStatus: number,
    retryable: boolean,
    failureCategory: string,
  ) {
    super(code);
    this.name = "SafeError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.retryable = retryable;
    this.failureCategory = failureCategory;
  }
}

export function asSafeError(error: unknown): SafeError {
  if (error instanceof SafeError) {
    return error;
  }

  return new SafeError("INTERNAL_ERROR", 500, true, "internal");
}
