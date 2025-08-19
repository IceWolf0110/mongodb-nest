import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from './User/users.module';

@Module({
  imports: [
    MongooseModule.forRoot(
      'mongodb+srv://son:01102000@cluster0.x2tjjoh.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0',
    ),
    UsersModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
