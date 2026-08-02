import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from '../auth.service';
import { UserMessages } from '../helper/user-messages';
import { JwtPayload } from '../interface/user.interface';

export interface AuthenticatedUser {
  id: string;
  fullName: string;
  email: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private readonly authService: AuthService,
    configService: ConfigService,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error(UserMessages.ACCESS_TOKEN_SECRET_NOT_SET);
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (!payload?.sub) {
      throw new UnauthorizedException(UserMessages.INVALID_ACCESS_TOKEN);
    }

    const user = await this.authService
      .retrieveUserById(payload.sub)
      .catch((error) => {
        // Log the real cause for debugging/observability, but never leak
        // it to the client — the response stays a generic 401 either way.
        this.logger.warn(
          `JWT validation failed for subject "${payload.sub}": ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        return null;
      });

    if (!user) {
      throw new UnauthorizedException(UserMessages.INVALID_ACCESS_TOKEN);
    }

    return {
      id: user.id,
      fullName: [user.firstname, user.lastname].filter(Boolean).join(' '),
      email: user.email,
      role: payload.role,
    };
  }
}