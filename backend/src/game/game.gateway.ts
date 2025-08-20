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

  // Danh sách người chơi: id, lựa chọn (0=không chọn, 1=Búa, 2=Kéo, 3=Bao), trạng thái tham gia
  private players: { id: string; choice: number; joined: boolean }[] = [];
  // Số người chơi tối đa
  private maxPlayers = 2;
  // Lưu kết quả ván chơi gần nhất
  private lastResult: string | null = null;

  constructor(private readonly gameService: GameService) {}

  // Xử lý khi người chơi kết nối
  handleConnection(client: Socket) {
    if (this.players.length >= this.maxPlayers) {
      client.emit('error', 'Trò chơi đã đầy. Chỉ cho phép 2 người chơi.');
      client.disconnect();
      return;
    }

    this.players.push({ id: client.id, choice: 0, joined: false });
    console.log(
      `Người chơi kết nối: ${client.id}, Tổng người chơi: ${this.players.length}`,
    );
    client.emit('connected', {
      playerId: client.id,
      playersCount: this.players.length,
    });
    setTimeout(() => {
      this.server.emit('playersUpdate', {
        playersCount: this.players.length,
        joinedCount: this.players.filter((p) => p.joined).length,
      });
      console.log(
        `Gửi playersUpdate: ${this.players.length} người chơi, ${this.players.filter((p) => p.joined).length} đã tham gia`,
      );
    }, 100);
  }

  // Xử lý sự kiện tham gia trò chơi
  @SubscribeMessage('joinGame')
  handleJoinGame(client: Socket) {
    const player = this.players.find((p) => p.id === client.id);
    if (player) {
      if (player.joined) {
        client.emit('error', 'Bạn đã tham gia trò chơi rồi.');
        return;
      }
      player.joined = true;
      console.log(`Người chơi ${client.id} tham gia trò chơi`);
      client.emit('joined', {
        playerId: client.id,
        playersCount: this.players.length,
      });
      setTimeout(() => {
        this.server.emit('playersUpdate', {
          playersCount: this.players.length,
          joinedCount: this.players.filter((p) => p.joined).length,
        });
        console.log(
          `Gửi playersUpdate: ${this.players.length} người chơi, ${this.players.filter((p) => p.joined).length} đã tham gia`,
        );
      }, 100);

      if (this.players.filter((p) => p.joined).length === this.maxPlayers) {
        this.server.emit('gameStart', {
          message: 'Trò chơi bắt đầu! Chọn nước đi của bạn.',
        });
        console.log('Trò chơi bắt đầu với 2 người chơi đã tham gia');
      }
    }
  }

  // Xử lý khi người chơi ngắt kết nối
  handleDisconnect(client: Socket) {
    const disconnectedPlayerId = client.id;
    this.players = this.players.filter((p) => p.id !== client.id);
    console.log(
      `Người chơi ngắt kết nối: ${disconnectedPlayerId}, Tổng người chơi: ${this.players.length}`,
    );
    const message =
      this.lastResult || 'Một người chơi đã rời. Đang chờ người chơi khác.';
    this.server.emit('playerLeft', {
      playersCount: this.players.length,
      joinedCount: this.players.filter((p) => p.joined).length,
      playerId: disconnectedPlayerId,
    });
    this.server.emit('gameReset', message);
    this.players.forEach((p) => {
      p.choice = 0;
      p.joined = false;
    });
    setTimeout(() => {
      this.server.emit('playersUpdate', {
        playersCount: this.players.length,
        joinedCount: this.players.filter((p) => p.joined).length,
      });
      console.log(
        `Gửi playersUpdate: ${this.players.length} người chơi, ${this.players.filter((p) => p.joined).length} đã tham gia`,
      );
    }, 100);
  }

  // Xử lý lựa chọn của người chơi
  @SubscribeMessage('makeChoice')
  handleChoice(client: Socket, choice: number) {
    if (![1, 2, 3].includes(choice)) {
      client.emit(
        'error',
        'Lựa chọn không hợp lệ. Phải là 1 (Búa), 2 (Kéo), hoặc 3 (Bao).',
      );
      return;
    }

    const player = this.players.find((p) => p.id === client.id);
    if (!player || !player.joined) {
      client.emit('error', 'Bạn phải tham gia trò chơi trước khi chọn.');
      return;
    }

    player.choice = choice;
    client.emit(
      'choiceMade',
      `Lựa chọn của bạn: ${this.choiceToString(choice)}`,
    );
    console.log(`Người chơi ${client.id} chọn: ${this.choiceToString(choice)}`);

    if (this.players.every((p) => p.choice && p.choice !== 0)) {
      const [p1, p2] = this.players;
      const result = this.determineWinner(p1.choice, p2.choice);
      const resultMessage = `Người chơi 1 (${this.choiceToString(p1.choice)}) vs Người chơi 2 (${this.choiceToString(p2.choice)}). ${result}`;
      this.lastResult = resultMessage;
      this.gameService
        .saveGameResult(p1.choice, p2.choice, result)
        .catch((err) => {
          console.error('Lỗi lưu kết quả trò chơi:', err);
        });
      this.server.emit('result', {
        p1Choice: p1.choice,
        p2Choice: p2.choice,
        result,
        p1ChoiceText: this.choiceToString(p1.choice),
        p2ChoiceText: this.choiceToString(p2.choice),
        p1Name: 'Người chơi 1',
        p2Name: 'Người chơi 2',
      });
      console.log(
        `Kết quả: ${result}, Người chơi 1: ${this.choiceToString(p1.choice)}, Người chơi 2: ${this.choiceToString(p2.choice)}`,
      );
      this.players.forEach((p) => {
        p.choice = 0;
        p.joined = false;
      });
      this.server.emit('gameReset', resultMessage);
      setTimeout(() => {
        this.server.emit('playersUpdate', {
          playersCount: this.players.length,
          joinedCount: this.players.filter((p) => p.joined).length,
        });
        console.log(
          `Gửi playersUpdate: ${this.players.length} người chơi, ${this.players.filter((p) => p.joined).length} đã tham gia`,
        );
      }, 100);
    }
  }

  // Xác định người thắng
  private determineWinner(c1: number, c2: number): string {
    if (c1 === c2) return 'Hòa';
    if (
      (c1 === 1 && c2 === 2) || // Búa thắng Kéo
      (c1 === 2 && c2 === 3) || // Kéo thắng Bao
      (c1 === 3 && c2 === 1) // Bao thắng Búa
    ) {
      return 'Người chơi 1 thắng';
    }
    return 'Người chơi 2 thắng';
  }

  // Chuyển số lựa chọn thành chuỗi
  private choiceToString(choice: number): string {
    switch (choice) {
      case 1:
        return 'Búa';
      case 2:
        return 'Kéo';
      case 3:
        return 'Bao';
      default:
        return 'Không chọn';
    }
  }
}
