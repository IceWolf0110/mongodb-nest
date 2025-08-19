import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GameResult } from './schemas/game-result.schema';

@Injectable()
export class GameService {
  constructor(
    @InjectModel(GameResult.name) private gameResultModel: Model<GameResult>,
  ) {}

  async saveGameResult(
    p1Choice: number,
    p2Choice: number,
    result: string,
  ): Promise<GameResult> {
    const gameResult = new this.gameResultModel({ p1Choice, p2Choice, result });
    return gameResult.save();
  }
}
