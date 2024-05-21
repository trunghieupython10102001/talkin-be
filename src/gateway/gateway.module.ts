import { Module } from '@nestjs/common';
import { RoomModule } from './room/room.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { WssModule } from './wss/wss.module';

@Module({
  imports: [AuthModule, UserModule, RoomModule, WssModule],
  controllers: [],
  providers: [],
  exports: [],
})
export class GatewayModule {}
