import {
  Injectable,
  NestMiddleware,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NextFunction } from 'express';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class VerifyAdminMiddleware implements NestMiddleware {
  constructor(private configService: ConfigService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    if (!req.headers.authorization) next();
    else {
      const token = req.headers.authorization.replace('Bearer', '').trim();
      const decodeToken = jwt.decode(token) as any;

      if (!decodeToken)
        throw new HttpException('FORBIDDEN', HttpStatus.FORBIDDEN);

      next();
    }
  }
}
