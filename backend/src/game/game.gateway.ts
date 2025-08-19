import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: true })
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  private players: { id: string; choice?: 'rock' | 'scissors' | 'paper' }[] =
    [];
  private maxPlayers = 2;

  handleConnection(client: Socket) {
    if (this.players.length >= this.maxPlayers) {
      client.emit('error', 'Game is full. Only 2 players allowed.');
      client.disconnect();
      return;
    }

    this.players.push({ id: client.id });
    client.emit('joined', {
      playerId: client.id,
      playersCount: this.players.length,
    });

    if (this.players.length === this.maxPlayers) {
      this.server.emit('gameStart', 'Game started! Choose your move.');
    }
  }

  handleDisconnect(client: Socket) {
    this.players = this.players.filter((p) => p.id !== client.id);
    this.server.emit('playerLeft', { playersCount: this.players.length });
  }

  @SubscribeMessage('makeChoice')
  handleChoice(client: Socket, choice: 'rock' | 'scissors' | 'paper') {
    const player = this.players.find((p) => p.id === client.id);
    if (player) {
      player.choice = choice;
      client.emit('choiceMade', 'Your choice: ' + choice);
    }

    // Check if both have chosen
    if (this.players.every(p => p.choice)) {
      const [p1, p2] = this.players;
      const result = this.determineWinner(
        p1.choice as string,
        p2.choice as string,
      );
      this.server.emit('result', {
        p1Choice: p1.choice,
        p2Choice: p2.choice,
        result,
      });
      // Reset choices for next round
      this.players.forEach((p) => (p.choice = undefined));
    }
  }

  private determineWinner(c1: string, c2: string): string {
    if (c1 === c2) return 'Tie';
    if (
      (c1 === 'rock' && c2 === 'scissors') ||
      (c1 === 'scissors' && c2 === 'paper') ||
      (c1 === 'paper' && c2 === 'rock')
    ) {
      return 'Player 1 wins';
    }
    return 'Player 2 wins';
  }
}