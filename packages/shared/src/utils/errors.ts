export class AppError extends Error {
  constructor(
    public status: number,
    public title: string,
    public detail?: string,
    public type: string = "https://nova.dev/errors/generic",
  ) {
    super(title);
    this.name = "AppError";
  }

  static notFound(resource: string) {
    return new AppError(404, "Not Found", `${resource} not found`, "https://nova.dev/errors/not-found");
  }

  static forbidden(detail?: string) {
    return new AppError(403, "Forbidden", detail, "https://nova.dev/errors/forbidden");
  }

  static conflict(detail: string) {
    return new AppError(409, "Conflict", detail, "https://nova.dev/errors/conflict");
  }

  static badRequest(detail: string) {
    return new AppError(400, "Bad Request", detail, "https://nova.dev/errors/bad-request");
  }

  static unauthorized(detail?: string) {
    return new AppError(401, "Unauthorized", detail ?? "Authentication required", "https://nova.dev/errors/unauthorized");
  }

  static rateLimited(retryAfter: number) {
    return new AppError(429, "Rate Limit Exceeded", `Try again in ${retryAfter} seconds`, "https://nova.dev/errors/rate-limited");
  }
}
