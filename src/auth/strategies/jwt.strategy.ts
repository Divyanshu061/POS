// src/auth/strategies/jwt.strategy.ts

import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt, StrategyOptions } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

import { AuthService } from '../auth.service';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    configService: ConfigService, // no `private` here
    private readonly authService: AuthService, // this is used later
  ) {
    // 1) Read secret from env
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET must be defined');
    }

    // 2) Build the exact options type Passport expects
    const options: StrategyOptions = {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
      passReqToCallback: false, // explicit, so TypeScript sees the right type
    };

    // 3) Call super with correctly typed options
    super(options);

    this.logger.log('JWT strategy initialized');
  }

  /**
   * Called after the JWT signature is verified.
   */
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    // a) Basic claim checks
    if (!payload.sub || !payload.email) {
      this.logger.warn('JWT payload missing sub or email', payload);
      throw new UnauthorizedException('Invalid token payload');
    }

    // b) Delegate to AuthService for user lookup & mapping
    const user = await this.authService.validateJwtPayload(payload);
    if (!user?.userId) {
      this.logger.warn(`No user found for token sub ${payload.sub}`);
      throw new UnauthorizedException('Invalid or expired token');
    }

    return user;
  }
}
