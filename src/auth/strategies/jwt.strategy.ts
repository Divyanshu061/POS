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
    configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET must be defined');
    }

    const options: StrategyOptions = {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
      passReqToCallback: false,
    };

    super(options);

    this.logger.log('JWT strategy initialized');
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    // require both subject and email (we include both in tokens in AuthService)
    if (!payload.sub || !payload.email) {
      this.logger.warn('JWT payload missing sub or email', payload);
      throw new UnauthorizedException('Invalid token payload');
    }

    // Delegate to AuthService which will map DB user -> AuthenticatedUser
    const user = await this.authService.validateJwtPayload(payload);
    if (!user?.userId) {
      this.logger.warn(`No user found for token sub ${payload.sub}`);
      throw new UnauthorizedException('Invalid or expired token');
    }

    return user;
  }
}
