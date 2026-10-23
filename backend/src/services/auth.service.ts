import bcrypt from 'bcryptjs';
import { prisma } from '../db/prisma.js';
import { RegisterInput, LoginInput } from '../schemas/auth.schema.js';
import { AppError } from '../middleware/error.middleware.js';
import { signToken } from '../utils/jwt.js';
import { UserResponse } from '../types/auth.types.js';

export class AuthService {
  /**
   * Register a new user account with hashed password
   */
  async register(input: RegisterInput): Promise<{ user: UserResponse; token: string }> {
    const normalizedEmail = input.email.toLowerCase().trim();

    // Check for duplicate email
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      throw new AppError(
        'An account with this email address already exists. Please log in instead.',
        409,
        'DUPLICATE_EMAIL'
      );
    }

    // Hash password with 12 salt rounds
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(input.password, salt);

    // Create user in database
    const createdUser = await prisma.user.create({
      data: {
        email: normalizedEmail,
        fullName: input.fullName.trim(),
        passwordHash,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Generate JWT token
    const token = signToken({
      userId: createdUser.id,
      email: createdUser.email,
      role: createdUser.role,
    });

    return { user: createdUser, token };
  }

  /**
   * Authenticate an existing user with email and password
   */
  async login(input: LoginInput): Promise<{ user: UserResponse; token: string }> {
    const normalizedEmail = input.email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
    }

    // Verify password against stored bcrypt hash
    const isMatch = await bcrypt.compare(input.password, user.passwordHash);
    if (!isMatch) {
      throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const userResponse: UserResponse = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    return { user: userResponse, token };
  }

  /**
   * Fetch current authenticated user record by ID
   */
  async getCurrentUser(userId: string): Promise<UserResponse> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new AppError('Authenticated user no longer exists.', 404, 'USER_NOT_FOUND');
    }

    return user;
  }
}

export const authService = new AuthService();
