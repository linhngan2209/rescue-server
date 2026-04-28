import {
    Injectable,
    CanActivate,
    ExecutionContext,
    UnauthorizedException,
    ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

@Injectable()
export class ClientAuthGuard implements CanActivate {
    constructor(private readonly jwtService: JwtService) { }

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<Request>();

        try {
            const authHeader = request.headers['authorization'];
            const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

            if (!token) {
                throw new UnauthorizedException({
                    error_code: '1002',
                    message: 'Token missing',
                });
            }

            const decoded = this.jwtService.verify(token);

            if (decoded.type !== 'client') {
                throw new ForbiddenException({
                    error_code: '1003',
                    message: 'Invalid token type',
                });
            }

            (request as any).client_id = decoded.client_id;
            (request as any).scope = decoded.scope;

            return true;
        } catch (err) {
            if (err instanceof UnauthorizedException || err instanceof ForbiddenException) {
                throw err;
            }

            throw new UnauthorizedException({
                error_code: '1004',
                message: 'Invalid or expired token',
            });
        }
    }
}
