export class AfipError extends Error {
  constructor(message, code, details) {
    super(message);
    this.name = 'AfipError';
    this.code = code;
    this.details = details;
  }

  toJSON() {
    return {
      error: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}
