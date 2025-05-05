import {
  Injectable,
  UnauthorizedException,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

import { UserService } from '../user/user.service';
import { User } from '../entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { SignUpDto } from './dto/sign-up.dto';

export interface JwtPayload {
  sub: string; // userId
  email: string;
  roles: string[];
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Register a new user with hashed password.
   */
  async signUp(dto: SignUpDto): Promise<Omit<User, 'password'>> {
    const saltRounds =
      this.configService.get<number>('BCRYPT_SALT_ROUNDS') ?? 10;
    const hashedPassword = await bcrypt.hash(dto.password, saltRounds);
    const user = await this.userService.create({
      ...dto,
      password: hashedPassword,
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...safeUser } = user;
    this.logger.log(`Registered user: ${safeUser.email}`);
    return safeUser;
  }

  /**
   * Validate credentials & issue access + refresh tokens.
   */
  async signIn(
    dto: LoginDto,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const user = await this.validateUser(dto.email, dto.password);

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      roles: user.roles.map((role) => role.name),
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: this.configService.get<string>('JWT_EXPIRATION'),
    });

    const refreshToken = await this.jwtService.signAsync(
      { sub: user.id },
      {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRATION'),
      },
    );

    this.logger.log(`User signed in: ${user.email}`);
    return { accessToken, refreshToken };
  }

  /**
   * Refresh both tokens given a valid refresh token.
   */
  async refreshToken(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const decoded = await this.jwtService.verifyAsync<JwtPayload>(
        refreshToken,
        {
          secret: this.configService.get<string>('JWT_SECRET'),
        },
      );

      const user = await this.userService.findOne(decoded.sub);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      const payload: JwtPayload = {
        sub: user.id,
        email: user.email,
        roles: user.roles.map((role) => role.name),
      };

      const accessToken = await this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: this.configService.get<string>('JWT_EXPIRATION'),
      });

      const newRefreshToken = await this.jwtService.signAsync(
        { sub: user.id },
        {
          secret: this.configService.get<string>('JWT_SECRET'),
          expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRATION'),
        },
      );

      return { accessToken, refreshToken: newRefreshToken };
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'string'
            ? err
            : 'Unknown error';

      this.logger.error(`Refresh token failed: ${message}`);
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  /**
   * Used internally to validate email/password.
   */
  private async validateUser(email: string, password: string): Promise<User> {
    const user = await this.userService.findOneByEmail(email);
    if (!user) {
      this.logger.warn(`Login failed: email not found - ${email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      this.logger.warn(`Login failed: invalid password for ${email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    return user;
  }

  /**
   * Called by JwtStrategy to verify payload.
   */
  async validateJwtPayload(payload: JwtPayload): Promise<User> {
    const user = await this.userService.findOne(payload.sub);
    if (!user) {
      this.logger.warn(
        `JWT payload validation failed: user not found - ${payload.sub}`,
      );
      throw new UnauthorizedException('User not found');
    }
    return user;
  }
}
