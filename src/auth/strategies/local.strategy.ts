// src/auth/strategies/local.strategy.ts

import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { UserService } from '../../user/user.service';
import { User } from '../../entities/user.entity';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
  ) {
    // Tell Passport to look for `email` instead of `username`
    super({ usernameField: 'email' });
  }

  /**
   * Passport will call this with `email` and `password`
   * If valid, reload full User entity (with roles) and return it.
   */
  async validate(email: string, password: string): Promise<User> {
    // Validate credentials and get the basic User entity (with password & roles)
    const userEntity = await this.authService.validateCredentials(
      email,
      password,
    );
    if (!userEntity) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Reload the full user (with roles relation loaded)
    const fullUser = await this.userService.findOne(userEntity.id);
    if (!fullUser) {
      throw new UnauthorizedException('User not found');
    }

    return fullUser;
  }
}
