import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { LoggerModule } from './logger/logger.module';
import { PrismaService } from './prisma/prisma.service';
import { VerifyAdminMiddleware } from './middlwares/verify-admin.middlewre';
import { ConfigService } from '@nestjs/config';
import { MailerModule } from './mailer/mailer.module';
import { MailService } from './mailer/mail.service';

@Module({
  imports: [PrismaModule, LoggerModule, MailerModule.forRoot()],
  controllers: [],
  providers: [PrismaService, VerifyAdminMiddleware, ConfigService, MailService],
  exports: [PrismaService, VerifyAdminMiddleware, ConfigService, MailService],
})
export class ShareModule {}
