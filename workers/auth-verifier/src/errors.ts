export class SafeError extends Error {
  constructor(
    readonly code: string,
    readonly httpStatus: number,
    readonly retryable: boolean,
    readonly stage: "request" | "rate_limit" | "storage" | "verification",
  ) {
    super(code);
    this.name = "SafeError";
  }
}

export function asSafeError(
  error: unknown,
  fallbackCode: "CHALLENGE_STORAGE_ERROR" | "VERIFICATION_STORAGE_ERROR",
): SafeError {
  if (error instanceof SafeError) {
    return error;
  }
  return new SafeError(fallbackCode, 503, true, "storage");
}
