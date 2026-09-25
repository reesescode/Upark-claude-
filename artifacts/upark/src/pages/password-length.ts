export const PASSWORD_LENGTH_ERROR = "Password must be between 8 and 20 characters.";

export function isPasswordLengthValid(password: string): boolean {
  return password.length >= 8 && password.length <= 20;
}