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
      'mongodb+srv://son:01102000@cluster0.x2tjjoh.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0',
    ),
  ],
  providers: [GameGateway, GameService],
})
export class GameModule {}
