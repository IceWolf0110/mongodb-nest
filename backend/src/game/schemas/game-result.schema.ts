import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type GameResultDocument = GameResult & Document;

@Schema()
export class GameResult {
  // Lựa chọn của Người chơi 1 (1=Búa, 2=Kéo, 3=Bao)
  @Prop({ type: Number, required: true, enum: [1, 2, 3] })
  p1Choice: number;

  // Lựa chọn của Người chơi 2 (1=Búa, 2=Kéo, 3=Bao)
  @Prop({ type: Number, required: true, enum: [1, 2, 3] })
  p2Choice: number;

  // Kết quả trò chơi
  @Prop({
    required: true,
    enum: ['Người chơi 1 thắng', 'Người chơi 2 thắng', 'Hòa'],
  })
  result: string;

  // Thời gian lưu kết quả
  @Prop({ default: Date.now })
  timestamp: Date;
}

export const GameResultSchema = SchemaFactory.createForClass(GameResult);
