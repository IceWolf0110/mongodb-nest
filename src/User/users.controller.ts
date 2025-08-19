import {
  Controller,
  Post,
  Body,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dtos/CreateUser.dto.';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}
  @Post()
  @UsePipes(new ValidationPipe())
  createUser(@Body() createUserDto: CreateUserDto) {
    return this.usersService.createUser(createUserDto);
  }
}
