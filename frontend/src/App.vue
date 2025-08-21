<script setup lang="ts">
  import { ref, onMounted, onUnmounted } from 'vue';

  document.title = "kéo búa bao"

  import io from 'socket.io-client';

  // Kết nối tới server WebSocket
  const socket = io('https://game-backend-production-e85e.up.railway.app');
  // Thông báo trạng thái trò chơi
  const message = ref('');
  // Lựa chọn của người chơi (0=không chọn, 1=Búa, 2=Kéo, 3=Bao)
  const choice = ref(0);
  // Chuỗi kết quả trò chơi
  const result = ref('');
  // Số người chơi hiện tại
  const playersCount = ref(0);
  // Số người chơi đã tham gia
  const joinedCount = ref(0);
  // Trạng thái tham gia của người chơi
  const joined = ref(false);
  // Dữ liệu kết quả để hiển thị trong card
  const resultData = ref<{
    p1Name: string;
    p1ChoiceText: string;
    p2Name: string;
    p2ChoiceText: string;
    result: string;
  } | null>(null);

  // Khi component được gắn vào
  onMounted(() => {
    // Xử lý sự kiện kết nối
    socket.on('connected', (data: { playerId: string; playersCount: number }) => {
      playersCount.value = data.playersCount;
      joined.value = false;
      message.value = 'Đã kết nối! Vui lòng tham gia trò chơi.';
      result.value = '';
      resultData.value = null;
      console.log(`Đã kết nối: ID Người chơi ${data.playerId}, Số người chơi: ${data.playersCount}/2`);
    });

    // Xử lý sự kiện tham gia trò chơi
    socket.on('joined', (data: { playerId: string; playersCount: number }) => {
      playersCount.value = data.playersCount;
      joined.value = true;
      message.value = joinedCount.value < 2 ? 'Đang chờ người chơi khác tham gia...' : 'Trò chơi bắt đầu! Chọn nước đi của bạn.';
      console.log(`Đã tham gia: ID Người chơi ${data.playerId}, Số người chơi: ${data.playersCount}/2`);
    });

    // Cập nhật số người chơi và trạng thái tham gia
    socket.on('playersUpdate', (data: { playersCount: number; joinedCount: number }) => {
      playersCount.value = data.playersCount;
      joinedCount.value = data.joinedCount;
      console.log(`Nhận playersUpdate: ${data.playersCount}/2, Đã tham gia: ${data.joinedCount}/2`);
      if (joined.value && joinedCount.value < 2) {
        message.value = 'Đang chờ người chơi khác tham gia...';
        result.value = '';
        resultData.value = null;
      }
    });

    // Bắt đầu trò chơi
    socket.on('gameStart', (data: { message: string }) => {
      message.value = data.message;
      console.log('Trò chơi bắt đầu');
    });

    // Xác nhận lựa chọn của người chơi
    socket.on('choiceMade', (msg: string) => {
      message.value = msg;
      console.log(`Lựa chọn đã gửi: ${msg}`);
    });

    // Hiển thị kết quả trò chơi
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
      resultData.value = {
        p1Name: data.p1Name,
        p1ChoiceText: data.p1ChoiceText,
        p2Name: data.p2Name,
        p2ChoiceText: data.p2ChoiceText,
        result: data.result,
      };
      joined.value = false;
      console.log(`Kết quả: ${result.value}`);
    });

    // Xử lý khi người chơi rời
    socket.on('playerLeft', (data: { playersCount: number; joinedCount: number; playerId?: string }) => {
      playersCount.value = data.playersCount;
      joinedCount.value = data.joinedCount;
      joined.value = false;
      message.value = 'Một người chơi đã rời. Vui lòng tham gia lại trò chơi.';
      console.log(`Người chơi rời: Số người chơi: ${data.playersCount}/2, Đã tham gia: ${data.joinedCount}/2, ID Ngắt kết nối: ${data.playerId || 'không xác định'}`);
    });

    // Reset trò chơi
    socket.on('gameReset', (msg: string) => {
      result.value = msg;
      if (msg.includes('Người chơi 1 thắng') || msg.includes('Người chơi 2 thắng') || msg.includes('Hòa')) {
        const [p1Part, p2Part, resultText] = msg.split(' vs ').flatMap(s => s.split('. '));
        const p1Match = p1Part.match(/Người chơi 1 \((.*?)\)/);
        const p2Match = p2Part.match(/Người chơi 2 \((.*?)\)/);
        resultData.value = {
          p1Name: 'Người chơi 1',
          p1ChoiceText: p1Match ? p1Match[1] : 'Không chọn',
          p2Name: 'Người chơi 2',
          p2ChoiceText: p2Match ? p2Match[1] : 'Không chọn',
          result: resultText,
        };
      } else {
        resultData.value = null;
      }
      message.value = 'Vui lòng tham gia để bắt đầu ván mới.';
      choice.value = 0;
      joined.value = false;
      console.log(`Reset trò chơi: ${msg}`);
    });

    // Xử lý lỗi
    socket.on('error', (msg: string) => {
      message.value = msg;
      console.log(`Lỗi: ${msg}`);
    });
  });

  // Ngắt kết nối khi component bị hủy
  onUnmounted(() => {
    socket.disconnect();
  });

  // Hàm tham gia trò chơi
  const joinGame = () => {
    socket.emit('joinGame');
    result.value = '';
    resultData.value = null;
    console.log('Yêu cầu tham gia trò chơi');
  };

  // Hàm chọn nước đi
  const makeChoice = (opt: number) => {
    if (playersCount.value < 2 || joinedCount.value < 2) {
      message.value = 'Chờ đủ 2 người chơi tham gia!';
      console.log('Không thể chọn: Đang chờ 2 người chơi tham gia');
      return;
    }
    if (!joined.value) {
      message.value = 'Vui lòng tham gia trò chơi trước!';
      console.log('Không thể chọn: Chưa tham gia');
      return;
    }
    choice.value = opt;
    socket.emit('makeChoice', opt);
    console.log(`Lựa chọn đã gửi: ${opt}`);
  };

  // Lấy lớp CSS cho card kết quả
  const getResultClass = () => {
    if (!resultData.value) return '';
    if (resultData.value.result.includes('thắng')) return 'bg-green-100 dark:bg-green-900 border-green-500 dark:border-green-400';
    if (resultData.value.result === 'Hòa') return 'bg-blue-100 dark:bg-blue-900 border-blue-500 dark:border-blue-400';
    return 'bg-gray-100 dark:bg-gray-700 border-gray-500 dark:border-gray-400';
  };
</script>

<template>
  <div class="min-h-screen bg-gray-100 dark:bg-gray-800 flex items-center justify-center transition-colors duration-300">
    <div class="bg-white dark:bg-gray-900 p-8 rounded-lg shadow-lg max-w-md w-full transition-colors duration-300">
      <h1 class="text-3xl font-bold text-center text-gray-800 dark:text-gray-100 mb-6">Trò Chơi Kéo Búa Bao</h1>
      <p class="text-lg text-center text-gray-600 dark:text-gray-200 mb-4">
        Người chơi: {{ playersCount }}/2 (Đã tham gia: {{ joinedCount }}/2)
      </p>
      <p class="text-center text-gray-600 dark:text-gray-200 mb-6">{{ message }}</p>
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
          Búa
        </button>
        <button
          @click="makeChoice(2)"
          class="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-300"
        >
          Kéo
        </button>
        <button
          @click="makeChoice(3)"
          class="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-300"
        >
          Bao
        </button>
      </div>
      <div v-if="resultData" class="mt-6 p-4 border-2 rounded-lg shadow-sm animate-pulse-short" :class="getResultClass">
        <div class="flex justify-between items-center mb-2">
          <p class="text-sm font-semibold text-gray-700 dark:text-gray-200">
            {{ resultData.p1Name }}: {{ resultData.p1ChoiceText }}
          </p>
          <p class="text-sm font-semibold text-gray-700 dark:text-gray-200">
            {{ resultData.p2Name }}: {{ resultData.p2ChoiceText }}
          </p>
        </div>
        <p
          class="text-center text-lg font-bold"
          :class="resultData.result.includes('thắng') ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'"
        >
          {{ resultData.result }}
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Hiệu ứng nhấp nháy ngắn */
@keyframes pulse-short {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.8; }
}
.animate-pulse-short {
  animation: pulse-short 1s ease-in-out;
}
</style>
