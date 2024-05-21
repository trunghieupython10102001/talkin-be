import * as path from 'path';
import { DynamicModule, Module } from '@nestjs/common';
import { MailerModule as MailerModuleCore } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';

@Module({})
export class MailerModule {
  static forRoot(): DynamicModule {
    return {
      global: true,
      module: MailerModule,
      imports: [
        MailerModuleCore.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: async (config: ConfigService) => {
            return {
              transport: {
                host: 'smtp.gmail.com',
                port: 465,
                secure: true, // use SSL
                auth: {
                  user: process.env.FROM_EMAIL,
                  pass: process.env.EMAIL_APP_PASSWORD,
                },
              },
              defaults: {
                from: process.env.FROM_EMAIL,
              },
              template: {
                dir: path.resolve(
                  process.cwd(),
                  'src/share/mailer/email-templates',
                ),
                adapter: new HandlebarsAdapter(),
              },
              preview: config.get('isDev'),
            };
          },
        }),
      ],
      providers: [MailService],
      exports: [MailService],
    };
  }
}
