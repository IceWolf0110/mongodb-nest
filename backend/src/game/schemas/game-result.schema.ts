import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class GameResult extends Document {
  @Prop({ type: Number, enum: [0, 1, 2, 3], default: 0 })
  p1Choice: number;

  @Prop({ type: Number, enum: [0, 1, 2, 3], default: 0 })
  p2Choice: number;

  @Prop({
    required: true,
    enum: [
      'Player 1 wins',
      'Player 2 wins',
      'Tie',
      'Player 1 wins by default',
      'Player 2 wins by default',
    ],
  })
  result: string;
}

export const GameResultSchema = SchemaFactory.createForClass(GameResult);
