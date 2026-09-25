import { describe, expect, it } from "vitest";
import { isPasswordLengthValid, PASSWORD_LENGTH_ERROR } from "./password-length";

describe("sign-up password length", () => {
  it.each([
    [7, false],
    [8, true],
    [20, true],
    [21, false],
  ])("%i characters: valid = %s", (length, valid) => {
    expect(isPasswordLengthValid("a".repeat(length))).toBe(valid);
  });

  it("uses the required length error", () => {
    expect(PASSWORD_LENGTH_ERROR).toBe("Password must be between 8 and 20 characters.");
  });
});