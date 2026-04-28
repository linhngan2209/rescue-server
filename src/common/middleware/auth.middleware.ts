import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  private readonly PUBLIC_ROUTES = [
    '/api/v1/auth/login',
    '/users/create-user',
    '/api/v1/mail/send-otp',
    '/api/v1/mail/verify-otp',
    '/api/v1/users/reset-password',
    '/api/v1/auth/oauth-token',
  ];

  constructor(private readonly jwtService: JwtService) { }

  use(req: Request, res: Response, next: NextFunction) {

    const requestPath = this.normalizePath(req.originalUrl || req.url);
    if (this.isPublicRoute(requestPath)) {
      return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw new UnauthorizedException({
        errorCode: 'MISSING_AUTH_HEADER',
        message: 'Authorization header is required',
      });
    }

    const [bearer, token] = authHeader.split(' ');
    if (bearer !== 'Bearer' || !token) {
      throw new UnauthorizedException({
        errorCode: 'INVALID_TOKEN_FORMAT',
        message: 'Token should be in format: Bearer <token>',
      });
    }

    try {
      const payload = this.jwtService.verify(token, {
        ignoreExpiration: false,
      });

      req.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      };

      next();
    } catch (error) {
      let errorMessage = 'Invalid token';
      let errorCode = 'INVALID_TOKEN';

      if (error.name === 'TokenExpiredError') {
        errorMessage = 'Token expired';
        errorCode = 'TOKEN_EXPIRED';
      } else if (error.name === 'JsonWebTokenError') {
        errorMessage = 'Malformed token';
        errorCode = 'MALFORMED_TOKEN';
      }

      throw new UnauthorizedException({
        errorCode,
        message: errorMessage,
      });
    }
  }


  private normalizePath(path: string): string {
    const cleanPath = path.split('?')[0];

    const normalizedPath = cleanPath.startsWith('/')
      ? cleanPath
      : `/${cleanPath}`;

    return normalizedPath.length > 1 && normalizedPath.endsWith('/')
      ? normalizedPath.slice(0, -1)
      : normalizedPath;
  }

  private isPublicRoute(path: string): boolean {
    const normalizedPath = this.normalizePath(path);
    return this.PUBLIC_ROUTES.some(publicRoute => {
      return normalizedPath === publicRoute ||
        normalizedPath.startsWith(`${publicRoute}/`);
    });
  }
}