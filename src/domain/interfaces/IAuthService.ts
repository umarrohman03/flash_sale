export interface IAuthService {
  login(username: string, password: string): Promise<{ token: string; userId: string }>;
  register(username: string, email: string, password: string, fullName?: string): Promise<{ userId: string; username: string; email: string; fullName?: string }>;
  verifyToken(token: string): Promise<{ userId: string; username: string }>;
}

