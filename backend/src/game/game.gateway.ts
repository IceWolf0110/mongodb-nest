import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameService } from './game.service';

@WebSocketGateway({ cors: true })
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  private players: { id: string; choice: number; joined: boolean }[] = [];
  private maxPlayers = 2;
  private timeout: NodeJS.Timeout | null = null;
  private readonly TIMEOUT_DURATION = 30000; // 30 seconds

  constructor(private readonly gameService: GameService) {}

  handleConnection(client: Socket) {
    if (this.players.length >= this.maxPlayers) {
      client.emit('error', 'Game is full. Only 2 players allowed.');
      client.disconnect();
      return;
    }

    this.players.push({ id: client.id, choice: 0, joined: false });
    console.log(
      `Player connected: ${client.id}, Total players: ${this.players.length}`,
    );
    client.emit('connected', {
      playerId: client.id,
      playersCount: this.players.length,
    });
    this.server.emit('playersUpdate', {
      playersCount: this.players.length,
      joinedCount: this.players.filter((p) => p.joined).length,
    });
    console.log(
      `Emitted playersUpdate: ${this.players.length} players, ${this.players.filter((p) => p.joined).length} joined`,
    );
  }

  @SubscribeMessage('joinGame')
  handleJoinGame(client: Socket) {
    const player = this.players.find((p) => p.id === client.id);
    if (player) {
      if (player.joined) {
        client.emit('error', 'You have already joined the game.');
        return;
      }
      player.joined = true;
      console.log(`Player ${client.id} joined the game`);
      client.emit('joined', {
        playerId: client.id,
        playersCount: this.players.length,
      });
      this.server.emit('playersUpdate', {
        playersCount: this.players.length,
        joinedCount: this.players.filter((p) => p.joined).length,
      });
      console.log(
        `Emitted playersUpdate: ${this.players.length} players, ${this.players.filter((p) => p.joined).length} joined`,
      );

      if (this.players.filter((p) => p.joined).length === this.maxPlayers) {
        const startTime = Date.now();
        this.server.emit('gameStart', {
          message: 'Game started! Choose your move within 30 seconds.',
          startTime,
        });
        console.log('Game started with 2 joined players');
        this.timeout = setTimeout(
          () => this.handleTimeout(),
          this.TIMEOUT_DURATION,
        );
      }
    }
  }

  handleDisconnect(client: Socket) {
    const disconnectedPlayerId = client.id;
    this.players = this.players.filter((p) => p.id !== client.id);
    console.log(
      `Player disconnected: ${disconnectedPlayerId}, Total players: ${this.players.length}`,
    );
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
    this.server.emit('playerLeft', {
      playersCount: this.players.length,
      joinedCount: this.players.filter((p) => p.joined).length,
      playerId: disconnectedPlayerId,
    });
    this.server.emit('gameReset', 'A player left. Waiting for another player.');
    this.players.forEach((p) => {
      p.choice = 0;
      p.joined = false;
    });
  }

  @SubscribeMessage('makeChoice')
  handleChoice(client: Socket, choice: number) {
    if (![1, 2, 3].includes(choice)) {
      client.emit(
        'error',
        'Invalid choice. Must be 1 (Rock), 2 (Scissors), or 3 (Paper).',
      );
      return;
    }

    const player = this.players.find((p) => p.id === client.id);
    if (!player || !player.joined) {
      client.emit('error', 'You must join the game before making a choice.');
      return;
    }

    player.choice = choice;
    client.emit('choiceMade', `Your choice: ${this.choiceToString(choice)}`);
    console.log(`Player ${client.id} chose: ${this.choiceToString(choice)}`);

    if (this.players.every((p) => p.choice && p.choice !== 0)) {
      if (this.timeout) {
        clearTimeout(this.timeout);
        this.timeout = null;
      }
      const [p1, p2] = this.players;
      const result = this.determineWinner(p1.choice, p2.choice);
      this.gameService
        .saveGameResult(p1.choice, p2.choice, result)
        .catch((err) => {
          console.error('Error saving game result:', err);
        });
      this.server.emit('result', {
        p1Choice: p1.choice,
        p2Choice: p2.choice,
        result,
        p1ChoiceText: this.choiceToString(p1.choice),
        p2ChoiceText: this.choiceToString(p2.choice),
        p1Name: 'Player 1',
        p2Name: 'Player 2',
      });
      console.log(
        `Result: ${result}, Player 1: ${this.choiceToString(p1.choice)}, Player 2: ${this.choiceToString(p2.choice)}`,
      );
      this.players.forEach((p) => {
        p.choice = 0;
        p.joined = false;
      });
      this.server.emit(
        'gameReset',
        'Game finished. Please join to start a new game.',
      );
      this.server.emit('playersUpdate', {
        playersCount: this.players.length,
        joinedCount: this.players.filter((p) => p.joined).length,
      });
      this.timeout = setTimeout(
        () => this.handleTimeout(),
        this.TIMEOUT_DURATION,
      );
    }
  }

  private handleTimeout() {
    if (
      this.players.length !== this.maxPlayers ||
      this.players.filter((p) => p.joined).length !== this.maxPlayers
    )
      return;

    const [p1, p2] = this.players;
    let result: string;
    const p1Choice: number = p1.choice || 0;
    const p2Choice: number = p2.choice || 0;

    if (p1Choice !== 0 && p2Choice === 0) {
      result = 'Player 1 wins by default';
    } else if (p1Choice === 0 && p2Choice !== 0) {
      result = 'Player 2 wins by default';
    } else if (p1Choice === 0 && p2Choice === 0) {
      result = 'Tie';
    } else {
      return;
    }

    this.gameService.saveGameResult(p1Choice, p2Choice, result).catch((err) => {
      console.error('Error saving game result:', err);
    });
    this.server.emit('result', {
      p1Choice,
      p2Choice,
      result,
      p1ChoiceText: this.choiceToString(p1Choice),
      p2ChoiceText: this.choiceToString(p2Choice),
      p1Name: 'Player 1',
      p2Name: 'Player 2',
    });
    console.log(
      `Timeout result: ${result}, Player 1: ${this.choiceToString(p1Choice)}, Player 2: ${this.choiceToString(p2Choice)}`,
    );
    this.players.forEach((p) => {
      p.choice = 0;
      p.joined = false;
    });
    this.server.emit(
      'gameReset',
      'Game finished due to timeout. Please join to start a new game.',
    );
    this.server.emit('playersUpdate', {
      playersCount: this.players.length,
      joinedCount: this.players.filter((p) => p.joined).length,
    });
    this.timeout = setTimeout(
      () => this.handleTimeout(),
      this.TIMEOUT_DURATION,
    );
  }

  private determineWinner(c1: number, c2: number): string {
    if (c1 === c2) return 'Tie';
    if (
      (c1 === 1 && c2 === 2) || // Rock beats Scissors
      (c1 === 2 && c2 === 3) || // Scissors beats Paper
      (c1 === 3 && c2 === 1) // Paper beats Rock
    ) {
      return 'Player 1 wins';
    }
    return 'Player 2 wins';
  }

  private choiceToString(choice: number): string {
    switch (choice) {
      case 1:
        return 'Rock';
      case 2:
        return 'Scissors';
      case 3:
        return 'Paper';
      default:
        return 'None';
    }
  }
}
