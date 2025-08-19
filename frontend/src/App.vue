<script setup lang="ts">
  import { ref, onMounted, onUnmounted } from 'vue';
  import io from 'socket.io-client';

  const socket = io('http://localhost:3000');
  const message = ref('');
  const choice = ref(0);
  const result = ref('');
  const playersCount = ref(0);
  const joinedCount = ref(0);
  const joined = ref(false);
  const startTime = ref(0);
  const timeLeft = ref(0);
  const TIMEOUT_DURATION = 30000; // 30 seconds

  // Cập nhật bộ đếm với requestAnimationFrame
  let animationFrameId: number | null = null;
  const startTimer = () => {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    if (startTime.value === 0 || joinedCount.value < 2 || !joined.value) {
      timeLeft.value = 0;
      return;
    }

    const updateTimer = () => {
      const elapsed = Date.now() - startTime.value;
      timeLeft.value = Math.max(0, Math.floor((TIMEOUT_DURATION - elapsed) / 1000));
      console.log(`Timer tick: ${timeLeft.value}s`); // Debug
      if (timeLeft.value > 0) {
        animationFrameId = requestAnimationFrame(updateTimer);
      } else {
        animationFrameId = null;
      }
    };

    animationFrameId = requestAnimationFrame(updateTimer);
  };

  onMounted(() => {
    socket.on('connected', (data: { playerId: string; playersCount: number }) => {
      playersCount.value = data.playersCount;
      joined.value = false;
      message.value = 'Connected! Please join the game.';
      startTime.value = 0;
      timeLeft.value = 0;
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      console.log(`Connected: Player ID ${data.playerId}, Players: ${data.playersCount}/2`);
    });

    socket.on('joined', (data: { playerId: string; playersCount: number }) => {
      playersCount.value = data.playersCount;
      joined.value = true;
      message.value = joinedCount.value < 2 ? 'Waiting for another player to join...' : 'Game started! Choose your move within 30 seconds.';
      console.log(`Joined: Player ID ${data.playerId}, Players: ${data.playersCount}/2`);
    });

    socket.on('playersUpdate', (data: { playersCount: number; joinedCount: number }) => {
      playersCount.value = data.playersCount;
      joinedCount.value = data.joinedCount;
      console.log(`PlayersUpdate received: ${data.playersCount}/2, Joined: ${data.joinedCount}/2`);
      if (joined.value && joinedCount.value < 2) {
        message.value = 'Waiting for another player to join...';
        startTime.value = 0;
        timeLeft.value = 0;
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
      }
    });

    socket.on('gameStart', (data: { message: string; startTime: number }) => {
      message.value = data.message;
      startTime.value = data.startTime;
      timeLeft.value = Math.floor(TIMEOUT_DURATION / 1000);
      startTimer();
      console.log(`Game started, Start time: ${data.startTime}`);
    });

    socket.on('choiceMade', (msg: string) => {
      message.value = msg;
      console.log(`Choice made: ${msg}`);
    });

    socket.on('result', (data: {
      p1Choice: number;
      p2Choice: number;
      result: string;
      p1ChoiceText: string;
      p2ChoiceText: string;
      p1Name: string;
      p2Name: string;
    }) => {
      result.value = `${data.p1Name} (${data.p1ChoiceText}) vs ${data.p2Name} (${data.p2ChoiceText}). ${data.result}`;
      joined.value = false;
      startTime.value = 0;
      timeLeft.value = 0;
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      console.log(`Result: ${result.value}`);
    });

    socket.on('playerLeft', (data: { playersCount: number; joinedCount: number; playerId?: string }) => {
      playersCount.value = data.playersCount;
      joinedCount.value = data.joinedCount;
      joined.value = false;
      message.value = 'A player left. Please join the game again.';
      result.value = '';
      choice.value = 0;
      startTime.value = 0;
      timeLeft.value = 0;
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      console.log(`PlayerLeft: Players: ${data.playersCount}/2, Joined: ${data.joinedCount}/2, Disconnected ID: ${data.playerId || 'unknown'}`);
    });

    socket.on('gameReset', (msg: string) => {
      message.value = msg;
      result.value = '';
      choice.value = 0;
      joined.value = false;
      startTime.value = 0;
      timeLeft.value = 0;
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      console.log('Game reset');
    });

    socket.on('error', (msg: string) => {
      message.value = msg;
      console.log(`Error: ${msg}`);
    });
  });

  onUnmounted(() => {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
  });

  const joinGame = () => {
    socket.emit('joinGame');
    console.log('Join game requested');
  };

  const makeChoice = (opt: number) => {
    if (playersCount.value < 2 || joinedCount.value < 2) {
      message.value = 'Wait for 2 players to join!';
      console.log('Cannot make choice: Waiting for 2 joined players');
      return;
    }
    if (!joined.value) {
      message.value = 'Please join the game first!';
      console.log('Cannot make choice: Not joined');
      return;
    }
    choice.value = opt;
    socket.emit('makeChoice', opt);
    console.log(`Choice sent: ${opt}`);
  };
</script>

<template>
  <div class="min-h-screen bg-gray-100 flex items-center justify-center">
    <div class="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
      <h1 class="text-3xl font-bold text-center text-gray-800 mb-6">Kéo Búa Bao Game</h1>
      <p class="text-lg text-center text-gray-600 mb-4">
        Players: {{ playersCount }}/2 (Joined: {{ joinedCount }}/2)
      </p>
      <p class="text-center text-gray-600 mb-6">{{ message }}</p>
      <div v-if="!joined" class="text-center">
        <button
          @click="joinGame"
          class="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-300"
        >
          Tham gia
        </button>
      </div>
      <div v-if="joined && joinedCount === 2" class="flex justify-center gap-4 mb-6">
        <button
          @click="makeChoice(1)"
          class="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-300"
        >
          Búa (Rock)
        </button>
        <button
          @click="makeChoice(2)"
          class="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-300"
        >
          Kéo (Scissors)
        </button>
        <button
          @click="makeChoice(3)"
          class="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-300"
        >
          Bao (Paper)
        </button>
      </div>
      <p v-if="result" class="text-center text-lg text-gray-800 font-semibold">{{ result }}</p>
    </div>
  </div>
</template>
