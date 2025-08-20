import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GameResult, GameResultDocument } from './schemas/game-result.schema';

@Injectable()
export class GameService {
  constructor(
    @InjectModel(GameResult.name) private gameModel: Model<GameResultDocument>,
  ) {}

  // Lưu kết quả trò chơi vào MongoDB
  async saveGameResult(
    p1Choice: number,
    p2Choice: number,
    result: string,
  ): Promise<void> {
    const gameResult = new this.gameModel({
      p1Choice,
      p2Choice,
      result,
      timestamp: new Date(),
    });
    await gameResult.save();
    console.log(
      `Đã lưu kết quả trò chơi: Người chơi 1 chọn ${p1Choice}, Người chơi 2 chọn ${p2Choice}, Kết quả: ${result}`,
    );
  }
}
