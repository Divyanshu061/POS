// src/auth/auth.service.ts

import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

import { UserService } from '../user/user.service';
import { RolesService } from '../roles/roles.service';
import { LoginDto } from './dto/login.dto';
import { SignUpDto } from './dto/sign-up.dto';
import { UserResponseDto } from './dto/user-response.dto';

export interface JwtPayload {
  sub: string;
  email: string;
  roles: string[];
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  private readonly jwtSecret: string;
  private readonly jwtExpiry: string;
  private readonly jwtRefreshSecret: string;
  private readonly jwtRefreshExpiry: string;

  constructor(
    private readonly userService: UserService,
    private readonly roleService: RolesService,
    private readonly jwtService: JwtService,
    configService: ConfigService,
  ) {
    this.jwtSecret = configService.get('JWT_SECRET', 'fallback');
    this.jwtExpiry = configService.get('JWT_EXPIRATION', '15m');
    this.jwtRefreshSecret = configService.get(
      'JWT_REFRESH_SECRET',
      'refreshFallback',
    );
    this.jwtRefreshExpiry = configService.get('JWT_REFRESH_EXPIRATION', '7d');
  }

  /** Register a new user, assign any roles, and return tokens */
  async signUp(dto: SignUpDto): Promise<{
    user: UserResponseDto;
    accessToken: string;
    refreshToken: string;
  }> {
    // 1) Prevent duplicate email
    if (await this.userService.findOneByEmail(dto.email)) {
      throw new BadRequestException(`Email ${dto.email} already registered`);
    }

    // 2) Create user (password hashing happens in entity or service)
    const newUser = await this.userService.create(dto);

    // 3) Determine if we need to assign roles
    let assignIds: string[] = [];
    if (Array.isArray(dto.roleIds) && dto.roleIds.length > 0) {
      assignIds = dto.roleIds;
    } else if (Array.isArray(dto.roleNames) && dto.roleNames.length > 0) {
      const roles = await this.roleService.findByNames(dto.roleNames);
      assignIds = roles.map((r) => r.id);
    }

    if (assignIds.length) {
      await this.userService.assignRoles(newUser.id, { roleIds: assignIds });
    }

    // 4) Reload with roles and strip password
    const complete = await this.userService.findOne(newUser.id);
    const safeUser = new UserResponseDto(complete);

    // 5) Issue tokens
    const { accessToken, refreshToken } = this.createTokens(safeUser);
    this.logger.log(`User signed up: ${safeUser.email}`);

    return { user: safeUser, accessToken, refreshToken };
  }

  /** Validate credentials and return user + tokens */
  async signIn(dto: LoginDto): Promise<{
    user: UserResponseDto;
    accessToken: string;
    refreshToken: string;
  }> {
    const user = await this.validateUser(dto.email, dto.password);
    const safeUser = new UserResponseDto(user);

    const { accessToken, refreshToken } = this.createTokens(safeUser);
    this.logger.log(`User signed in: ${safeUser.email}`);

    return { user: safeUser, accessToken, refreshToken };
  }

  /** Given a refresh token, issue new tokens */
  async refreshToken(oldToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(oldToken, {
        secret: this.jwtRefreshSecret,
      });
    } catch {
      this.logger.warn('Invalid refresh token');
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.userService.findOne(payload.sub);
    const safeUser = new UserResponseDto(user);
    const tokens = this.createTokens(safeUser);

    return tokens;
  }

  /** Used by Passport JwtStrategy to validate a token’s payload */
  async validateJwtPayload(payload: JwtPayload): Promise<UserResponseDto> {
    const user = await this.userService.findOne(payload.sub);
    if (!user) {
      this.logger.warn(`JWT validation failed: no user ${payload.sub}`);
      throw new UnauthorizedException('User not found');
    }
    return new UserResponseDto(user);
  }

  // ─── Private Helpers ────────────────────────────────────────────────

  /** Ensures email & password match a real user */
  private async validateUser(email: string, plain: string) {
    const user = await this.userService.findOneByEmailWithPassword(email);
    if (!user) {
      this.logger.warn(`Login failed (no user): ${email}`);
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!(await bcrypt.compare(plain, user.password))) {
      this.logger.warn(`Login failed (bad password): ${email}`);
      throw new UnauthorizedException('Invalid credentials');
    }
    return user;
  }

  /** Builds JWT access + refresh tokens */
  private createTokens(user: UserResponseDto): {
    accessToken: string;
    refreshToken: string;
  } {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      roles: user.roles.map((r) => r.name),
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.jwtSecret,
      expiresIn: this.jwtExpiry,
    });
    const refreshToken = this.jwtService.sign(
      { sub: user.id },
      {
        secret: this.jwtRefreshSecret,
        expiresIn: this.jwtRefreshExpiry,
      },
    );

    return { accessToken, refreshToken };
  }
}
