export type DomainErrorCode = "NOT_FOUND" | "CONFLICT" | "AUTH" | "VALIDATION" | "FORBIDDEN";

export class DomainError extends Error {
  constructor(public readonly code: DomainErrorCode, message: string) {
    super(message);
    this.name = new.target.name;
  }
}
export class NotFoundError extends DomainError { constructor(m: string) { super("NOT_FOUND", m); } }
export class ConflictError extends DomainError { constructor(m: string) { super("CONFLICT", m); } }
export class AuthError extends DomainError { constructor(m: string) { super("AUTH", m); } }
export class ValidationError extends DomainError { constructor(m: string) { super("VALIDATION", m); } }
export class ForbiddenError extends DomainError { constructor(m: string) { super("FORBIDDEN", m); } }
