import { describe, it, expect } from "vitest";
import { NotFoundError, ConflictError, AuthError, ValidationError, ForbiddenError } from "@/server/domain/errors";

describe("domain errors", () => {
  it("portent un code et un message", () => {
    expect(new NotFoundError("user").code).toBe("NOT_FOUND");
    expect(new ConflictError("email").code).toBe("CONFLICT");
    expect(new AuthError("bad creds").code).toBe("AUTH");
    expect(new ValidationError("min 3").code).toBe("VALIDATION");
    expect(new ForbiddenError("nope").code).toBe("FORBIDDEN");
    expect(new NotFoundError("x")).toBeInstanceOf(Error);
  });
});
