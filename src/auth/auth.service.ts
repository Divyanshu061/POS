// src/auth/auth.service.ts

import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

import { UserService } from '../user/user.service';
import { RolesService } from '../roles/roles.service';
import { SignUpDto } from './dto/sign-up.dto';
import { LoginDto } from './dto/login.dto';
import { AuthenticatedUser } from './interfaces/authenticated-user.interface';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { User } from '../entities/user.entity';
import { Role } from '../entities/role.entity';

const ERRORS = {
  INVALID_CREDENTIALS: 'Invalid email or password',
  USER_NOT_FOUND: 'User not found',
  EMAIL_TAKEN: (email: string) => `Email ${email} is already registered`,
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly jwtSecret: string;
  private readonly jwtExpiry: string;
  private readonly jwtRefreshSecret: string;
  private readonly jwtRefreshExpiry: string;

  constructor(
    private readonly userService: UserService,
    private readonly rolesService: RolesService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.jwtSecret = this.configService.get<string>(
      'JWT_SECRET',
      'fallbackSecret',
    );
    this.jwtExpiry = this.configService.get<string>('JWT_EXPIRATION', '15m');
    this.jwtRefreshSecret = this.configService.get<string>(
      'JWT_REFRESH_SECRET',
      'fallbackRefresh',
    );
    this.jwtRefreshExpiry = this.configService.get<string>(
      'JWT_REFRESH_EXPIRATION',
      '7d',
    );
  }

  async signUp(dto: SignUpDto): Promise<{
    user: AuthenticatedUser;
    accessToken: string;
    refreshToken: string;
  }> {
    const existing = await this.userService.findOneByEmail(dto.email);
    if (existing) {
      this.logger.warn(`Signup failed: email ${dto.email} already in use`);
      throw new ConflictException(ERRORS.EMAIL_TAKEN(dto.email));
    }

    const newUser: User = await this.userService.create(dto);
    this.logger.log(`User created: ${newUser.id}`);

    const roleIds = await this.resolveRoleIds(dto.roleIds, dto.roleNames);
    if (roleIds.length) {
      await this.userService.assignRoles(newUser.id, { roleIds });
      this.logger.log(
        `Roles [${roleIds.join(', ')}] assigned to ${newUser.id}`,
      );
    }

    const created = await this.userService.findOne(newUser.id);
    const authUser = this.mapToAuthenticatedUser(created);
    const { accessToken, refreshToken } = this.createTokens(authUser);

    return { user: authUser, accessToken, refreshToken };
  }

  async signIn(dto: LoginDto): Promise<{
    user: AuthenticatedUser;
    accessToken: string;
    refreshToken: string;
  }> {
    const userEntity = await this.validateCredentials(dto.email, dto.password);
    const authUser = this.mapToAuthenticatedUser(userEntity);

    this.logger.log(
      `User signed in: id=${userEntity.id}, email=${userEntity.email}`,
    );

    const { accessToken, refreshToken } = this.createTokens(authUser);
    return { user: authUser, accessToken, refreshToken };
  }

  async refreshTokens(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.jwtRefreshSecret,
      });
    } catch {
      this.logger.warn('Refresh token invalid');
      throw new UnauthorizedException(ERRORS.INVALID_CREDENTIALS);
    }

    if (!payload.sub || typeof payload.sub !== 'string') {
      this.logger.warn('Malformed refresh token payload');
      throw new UnauthorizedException('Malformed refresh token');
    }

    const userEntity = await this.userService.findOne(payload.sub);
    if (!userEntity) {
      this.logger.warn(`Refresh failed: no user ${payload.sub}`);
      throw new UnauthorizedException(ERRORS.USER_NOT_FOUND);
    }

    const authUser = this.mapToAuthenticatedUser(userEntity);
    this.logger.log(`Tokens refreshed for ${authUser.email}`);
    return this.createTokens(authUser);
  }

  // ─── Private Helpers ────────────────────────────────────────────

  public async validateCredentials(
    email: string,
    password: string,
  ): Promise<User> {
    // 1️⃣ Fetch the user _with_ password
    const user = await this.userService.findOneByEmailWithPassword(email);

    // 2️⃣ Check user existence
    if (!user) {
      this.logger.warn(`Login failed: no user for ${email}`);
      throw new UnauthorizedException(ERRORS.INVALID_CREDENTIALS);
    }

    // 3️⃣ Guard against a missing hash
    if (!user.password) {
      this.logger.error(
        `Login failed: password hash missing for user ${email}`,
      );
      throw new UnauthorizedException('Password data is corrupt');
    }

    // 4️⃣ Now compare
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      this.logger.warn(`Login failed: wrong password for ${email}`);
      throw new UnauthorizedException(ERRORS.INVALID_CREDENTIALS);
    }

    // 5️⃣ All good—return the full user entity (with roles, etc.)
    return user;
  }

  private async resolveRoleIds(
    roleIds?: string[],
    roleNames?: string[],
  ): Promise<string[]> {
    if (Array.isArray(roleIds) && roleIds.length) {
      return roleIds;
    }
    if (Array.isArray(roleNames) && roleNames.length) {
      const roles: Role[] = await this.rolesService.findByNames(roleNames);
      const found = roles.map((r) => r.id);
      if (found.length !== roleNames.length) {
        this.logger.warn(`Invalid roles: ${roleNames.join(', ')}`);
        throw new UnauthorizedException('Invalid roles specified');
      }
      return found;
    }
    return [];
  }

  private mapToAuthenticatedUser(user: User): AuthenticatedUser {
    return {
      userId: user.id, // the user’s UUID
      id: user.id, // duplicate for convenience
      email: user.email,
      roles: (user.roles ?? [])
        .filter((r): r is Role => !!r && typeof r.name === 'string')
        .map((r) => r.name),
    };
  }

  private signJwt(
    payload: JwtPayload,
    secret: string,
    expiresIn: string,
  ): string {
    return this.jwtService.sign(payload, { secret, expiresIn });
  }

  private createTokens(user: AuthenticatedUser): {
    accessToken: string;
    refreshToken: string;
  } {
    // We now include both `sub` and `id` in the payload so that
    // decorators reading request.user.id will succeed.
    const accessPayload: JwtPayload = {
      sub: user.userId, // Nest convention: “subject” is the user’s primary key
      id: user.userId, // duplicate “id” for decorators (e.g. @UserId())
      email: user.email,
      roles: user.roles,
    };

    const refreshPayload: JwtPayload = {
      sub: user.userId,
      id: user.userId,
      // (no need for email/roles in the refresh token)
    };

    return {
      accessToken: this.signJwt(accessPayload, this.jwtSecret, this.jwtExpiry),
      refreshToken: this.signJwt(
        refreshPayload,
        this.jwtRefreshSecret,
        this.jwtRefreshExpiry,
      ),
    };
  }

  // ─── Strategy Validation Methods ───────────────────────────────

  public async validateJwtPayload(
    payload: JwtPayload,
  ): Promise<AuthenticatedUser> {
    // Because we signed the token with both `sub` and `id`,
    // payload.sub is the user’s UUID.
    const userEntity = await this.userService.findOne(payload.sub);
    if (!userEntity) {
      this.logger.warn(`JWT validation failed: no user ${payload.sub}`);
      throw new UnauthorizedException(ERRORS.USER_NOT_FOUND);
    }
    return this.mapToAuthenticatedUser(userEntity);
  }

  public async validateUser(
    email: string,
    password: string,
  ): Promise<AuthenticatedUser> {
    const userEntity = await this.validateCredentials(email, password);
    return this.mapToAuthenticatedUser(userEntity);
  }

  public loginResponse(user: User): {
    user: AuthenticatedUser;
    accessToken: string;
    refreshToken: string;
  } {
    // map entity → lightweight DTO
    const authUser = this.mapToAuthenticatedUser(user);

    // create both tokens
    const { accessToken, refreshToken } = this.createTokens(authUser);

    return { user: authUser, accessToken, refreshToken };
  }
}
