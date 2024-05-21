import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/share/prisma/prisma.service';
import { BaseService } from 'src/common/base/base.service';
import { ConfigService } from '@nestjs/config';
import { UpdateUserDto } from './dtos/update-user.dto';
import { AuthGuardRequest } from '../auth/guards/auth.guard';

@Injectable()
export class UserService extends BaseService {
  constructor(prisma: PrismaService, configService: ConfigService) {
    super(prisma, 'user', 'User', configService);
  }

  async updateProfile(userId: number, updateUserDto: UpdateUserDto) {
    const updateUser: UpdateUserDto = {
      email: updateUserDto.email,
      firstname: updateUserDto.firstname,
      lastname: updateUserDto.lastname,
      birthday: updateUserDto.birthday || null,
      gender: updateUserDto.gender || null,
      phone: updateUserDto.phone || null,
      address: updateUserDto.address || null,
      description: updateUserDto.description || null,
    };
    await this.update({}, userId, {
      ...updateUser,
      fullname: updateUserDto.firstname + ' ' + updateUserDto.lastname,
    });
  }

  async getProfile(request: AuthGuardRequest, userId: number) {
    const user = await this.get(request, userId);
    delete user.password;
    return user;
  }
}
