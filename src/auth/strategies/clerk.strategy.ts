import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt, StrategyOptions } from 'passport-jwt';
import * as jwksRsa from 'jwks-rsa';

// 1) Define exactly the shape of the JWT payload Clerk will give you:
interface ClerkJwtPayload {
  sub: string;
  email: string;
  publicMetadata?: {
    roles?: string[];
    [key: string]: any;
  };
}

// 2) Define the shape of the “user” object you return
interface AuthenticatedUser {
  userId: string;
  email: string;
  roles: string[];
}

@Injectable()
export class ClerkStrategy extends PassportStrategy(Strategy, 'clerk') {
  constructor() {
    // 3) Retrieve environment variables with fallbacks to avoid errors
    const jwksUri = process.env.CLERK_JWKS_URI;
    const audience = process.env.CLERK_AUDIENCE;
    const issuer = process.env.CLERK_ISSUER;

    if (!jwksUri || !audience || !issuer) {
      throw new Error('Missing environment variables for Clerk: CLERK_JWKS_URI, CLERK_AUDIENCE, or CLERK_ISSUER');
    }

    const options: StrategyOptions = {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKeyProvider: jwksRsa.passportJwtSecret({
        jwksUri: jwksUri, // Ensure this is set correctly in your environment
        cache: true,
        rateLimit: true,
      }),
      audience: audience,
      issuer: issuer,
      algorithms: ['RS256'],
    };

    super(options);
  }

  // 4) Tell TS that payload is ClerkJwtPayload and return AuthenticatedUser
  validate(payload: ClerkJwtPayload): AuthenticatedUser {
    const roles = payload.publicMetadata?.roles ?? [];
    return {
      userId: payload.sub,
      email: payload.email,
      roles,
    };
  }
}
