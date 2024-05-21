import { CreateUserDto } from 'src/gateway/user/dtos/create-user.dto';
import { ApiTags, ApiResponse } from '@nestjs/swagger';
import { Body, Controller, HttpStatus, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignInDTO } from './dtos/sign-in.dto';
import { Public } from './decorator/public';

@ApiTags('auth')
@Controller('auth')
@Public()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiResponse({
    status: HttpStatus.CREATED,
    schema: { example: { access_token: '' } },
  })
  @Post('signup')
  async signUp(@Body() userDto: CreateUserDto) {
    return this.authService.signUp(userDto);
  }

  @ApiResponse({
    status: HttpStatus.CREATED,
    schema: { example: { access_token: '' } },
  })
  @Post('signin')
  async signIn(@Body() input: SignInDTO) {
    return this.authService.signIn(input);
  }
}
