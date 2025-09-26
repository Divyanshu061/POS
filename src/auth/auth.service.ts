// src/auth/auth.service.ts
import {
  Injectable,
  UnauthorizedException,
  Logger,
  Inject,
} from '@nestjs/common';
import { Cache } from 'cache-manager';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

import { UserService } from '../user/user.service';
import { LoginDto } from './dto/login.dto';
import { AuthenticatedUser } from './interfaces/authenticated-user.interface';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { User } from '../entities/user.entity';
import { Role } from '../entities/role.entity';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

const ERRORS = {
  INVALID_CREDENTIALS: 'Invalid email or password',
  USER_NOT_FOUND: 'User not found',
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
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
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

  /**
   * Sign in existing user (validate credentials) and return tokens.
   * User creation lives in the UsersController (CreateUserDto).
   */
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

  // ─── refreshTokens (validate tokenVersion in payload) ─────────────
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

    // Use validateJwtPayload so tokenVersion and cache logic are applied consistently.
    const authUser = await this.validateJwtPayload(payload);
    this.logger.log(
      `Tokens refreshed for ${authUser.email ?? authUser.userId}`,
    );
    return this.createTokens(
      authUser as AuthenticatedUser & { tokenVersion?: number },
    );
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

  private mapToAuthenticatedUser(user: User): AuthenticatedUser {
    return {
      userId: user.id,
      id: user.id,
      email: user.email,
      roles: (user.roles ?? [])
        .filter((r): r is Role => !!r && typeof r.name === 'string')
        .map((r) => r.name),
      companyId: user.companyId ?? null,
    };
  }

  private signJwt(
    payload: JwtPayload,
    secret: string,
    expiresIn: string,
  ): string {
    return this.jwtService.sign(payload, { secret, expiresIn });
  }

  private createTokens(user: AuthenticatedUser & { tokenVersion?: number }): {
    accessToken: string;
    refreshToken: string;
  } {
    const accessPayload: JwtPayload = {
      sub: user.userId,
      id: user.userId,
      email: user.email,
      roles: user.roles,
      companyId: user.companyId ?? null,
      tokenVersion: user.tokenVersion ?? 0,
    };

    const refreshPayload: JwtPayload = {
      sub: user.userId,
      id: user.userId,
      companyId: user.companyId ?? null,
      email: user.email,
      tokenVersion: user.tokenVersion ?? 0,
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
    if (!payload.sub) {
      this.logger.warn('JWT payload missing sub', payload);
      throw new UnauthorizedException('Invalid token payload');
    }

    // tokenVersion-aware cache key
    const keyVersion =
      (payload as JwtPayload & { tokenVersion?: number }).tokenVersion ?? '0';
    const cacheKey = `auth_user_${payload.sub}_v${keyVersion}`;

    // Try read from cache (fail-open)
    try {
      const cached = await this.cacheManager.get<AuthenticatedUser>(cacheKey);
      if (cached) {
        this.logger.debug(
          `Auth cache hit for ${payload.sub} (v=${keyVersion})`,
        );
        return cached;
      }
    } catch (err) {
      this.logger.warn(
        `Cache read failed for ${payload.sub}: ${(err as Error).message}`,
      );
      // continue to DB
    }

    // DB read — ensure roles & company loaded
    // Give a safe local type that includes tokenVersion.
    const userEntity = (await this.userService.findOne(payload.sub)) as
      | (User & { tokenVersion?: number })
      | null;

    if (!userEntity) {
      this.logger.warn(`JWT validation failed: no user ${payload.sub}`);
      throw new UnauthorizedException(ERRORS.USER_NOT_FOUND);
    }

    // ensure tokenVersion on DB user (safe typed access)
    const userTokenVersion =
      typeof userEntity.tokenVersion === 'number' ? userEntity.tokenVersion : 0;

    // read tokenVersion from payload (typed locally)
    const payloadTokenVersion =
      (payload as JwtPayload & { tokenVersion?: number }).tokenVersion ?? 0;

    // If tokenVersion mismatch -> token is revoked
    if (payloadTokenVersion !== userTokenVersion) {
      this.logger.warn(
        `Token version mismatch for user ${payload.sub}. Token v=${payloadTokenVersion}, user v=${userTokenVersion}`,
      );
      throw new UnauthorizedException('Token revoked or invalid');
    }

    const authUser: AuthenticatedUser = this.mapToAuthenticatedUser(userEntity);
    // create a new object that includes tokenVersion for caching / downstream usage
    const authUserWithVersion = {
      ...authUser,
      tokenVersion: userTokenVersion,
    } as AuthenticatedUser & { tokenVersion?: number };

    // Cache the mapped auth user with short TTL (30s)
    try {
      // cacheManager.set signature expects a number TTL in this project
      await this.cacheManager.set(cacheKey, authUserWithVersion, 30);
    } catch (err) {
      this.logger.warn(
        `Cache set failed for ${payload.sub}: ${(err as Error).message}`,
      );
      // proceed — authentication still valid
    }

    // return the original AuthenticatedUser (without exposing DB internals)
    return authUser;
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
    const authUser = this.mapToAuthenticatedUser(user);
    const { accessToken, refreshToken } = this.createTokens(authUser);
    return { user: authUser, accessToken, refreshToken };
  }

  /**
   * Invalidate cached AuthenticatedUser for the given userId and tokenVersion.
   * Call this after you bump tokenVersion on the User (or when revoking access).
   */
  public async invalidateAuthCache(
    userId: string,
    tokenVersion?: number,
  ): Promise<void> {
    const key = `auth_user_${userId}_v${tokenVersion ?? 0}`;
    try {
      await this.cacheManager.del(key);
    } catch (err) {
      this.logger.warn(
        `Failed to invalidate auth cache for ${userId}: ${(err as Error).message}`,
      );
    }
  }
}
