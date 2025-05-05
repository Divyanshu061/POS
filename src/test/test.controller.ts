import { Controller, Get } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('test')
export class TestController {
  @Get('public')
  getPublicData() {
    return { message: 'This route is public. No auth required.' };
  }

  @Roles('user')
  @Get('user')
  getUserData() {
    return { message: 'Hello User! You are authenticated and have USER role.' };
  }

  @Roles('admin')
  @Get('admin')
  getAdminData() {
    return {
      message: 'Hello Admin! You are authenticated and have ADMIN role.',
    };
  }
}
