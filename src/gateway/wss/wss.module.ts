import { Module } from '@nestjs/common';
import { WssController } from './wss.controller';
import { WssGateway } from './wss.gateway';
import { WssGuard } from './wss.guard';
import { UserModule } from 'src/gateway/user/user.module';
import { RoomModule } from 'src/gateway/room/room.module';
import { MailerModule } from 'src/share/mailer/mailer.module';

@Module({
  imports: [UserModule, RoomModule, MailerModule],
  controllers: [WssController],
  providers: [WssGateway, WssGuard],
  exports: [WssGateway],
})
export class WssModule {}
