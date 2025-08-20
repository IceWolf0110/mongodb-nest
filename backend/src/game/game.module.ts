import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GameGateway } from './game.gateway';
import { GameService } from './game.service';
import { GameResult, GameResultSchema } from './schemas/game-result.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: GameResult.name, schema: GameResultSchema },
    ]),
    MongooseModule.forRoot(
      'mongodb://mongo:feYdcYfxITYZCJpSpDQyvPUKwjZphdXf@yamanote.proxy.rlwy.net:28577',
    ),
  ],
  providers: [GameGateway, GameService],
})
export class GameModule {}
