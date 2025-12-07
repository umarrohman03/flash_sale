import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { IAuthService } from '../domain/interfaces/IAuthService';
import { config } from '../config';
import { logger } from '../infrastructure/logger';
import { UserRepository } from '../infrastructure/database/UserRepository';

export class AuthService implements IAuthService {
  private userRepository: UserRepository;

  constructor() {
    this.userRepository = new UserRepository();
  }

  async login(username: string, password: string): Promise<{ token: string; userId: string }> {
    // Find user by username in database
    const user = await this.userRepository.findByUsername(username);
    
    if (!user) {
      logger.warn(`Login attempt failed: user '${username}' not found`);
      throw new Error('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      logger.warn(`Login attempt failed: invalid password for user '${username}'`);
      throw new Error('Invalid credentials');
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id.toString(), username: user.username },
      config.auth.jwtSecret,
      { expiresIn: config.auth.jwtExpiresIn } as jwt.SignOptions
    );

    logger.info(`User ${username} logged in successfully`);
    
    return {
      token,
      userId: user.id.toString(),
    };
  }

  async register(
    username: string,
    email: string,
    password: string,
    fullName?: string
  ): Promise<{ userId: string; username: string; email: string; fullName?: string }> {
    // Check if username already exists
    const existingUserByUsername = await this.userRepository.findByUsername(username);
    if (existingUserByUsername) {
      logger.warn(`Registration attempt failed: username '${username}' already exists`);
      throw new Error('Username already exists');
    }

    // Check if email already exists
    const existingUserByEmail = await this.userRepository.findByEmail(email);
    if (existingUserByEmail) {
      logger.warn(`Registration attempt failed: email '${email}' already exists`);
      throw new Error('Email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const user = await this.userRepository.create({
      username,
      email,
      passwordHash,
      fullName,
    });

    logger.info(`User registered successfully: username=${username}, email=${email}`);

    return {
      userId: user.id.toString(),
      username: user.username,
      email: user.email,
      fullName: user.fullName,
    };
  }

  async verifyToken(token: string): Promise<{ userId: string; username: string }> {
    try {
      const decoded = jwt.verify(token, config.auth.jwtSecret) as {
        userId: string;
        username: string;
      };
      return decoded;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }
}

