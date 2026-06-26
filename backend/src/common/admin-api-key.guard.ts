import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class AdminApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const apiKey = this.config.get<string>('ADMIN_API_KEY');
    if (!apiKey) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const headerKey = request.headers['x-api-key'];
    if (headerKey !== apiKey) {
      throw new UnauthorizedException("Noto'g'ri API kaliti");
    }
    return true;
  }
}
