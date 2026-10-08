export const EMAIL_LIKE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmailLike(value: string): boolean {
  return EMAIL_LIKE.test(value.trim());
}
