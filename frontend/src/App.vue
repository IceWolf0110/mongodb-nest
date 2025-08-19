<script setup lang="ts">
  import { ref, onMounted, onUnmounted, computed } from 'vue'
  import io from 'socket.io-client'

  const socket = io('http://localhost:3000')
  const message = ref('')
  const choice = ref(0)
  const result = ref('')
  const playersCount = ref(0)
  const joinedCount = ref(0)
  const joined = ref(false)
  const startTime = ref(0)
  const timeLeft = ref(0)
  const TIMEOUT_DURATION = 30000 // 30 seconds

  // Tính toán thời gian còn lại
  const timerDisplay = computed(() => {
    if (startTime.value === 0 || joinedCount.value < 2 || !joined.value) return ''
    const elapsed = Date.now() - startTime.value
    const remaining = Math.max(0, Math.ceil((TIMEOUT_DURATION - elapsed) / 1000))
    return remaining > 0 ? `Time left: ${remaining}s` : ''
  })

  // Cập nhật bộ đếm mỗi giây
  let timerInterval: number | null = null
  const startTimer = () => {
    if (timerInterval) clearInterval(timerInterval)
    timerInterval = setInterval(() => {
      if (startTime.value === 0 || joinedCount.value < 2 || !joined.value) {
        timeLeft.value = 0
        return
      }
      const elapsed = Date.now() - startTime.value
      timeLeft.value = Math.max(0, Math.ceil((TIMEOUT_DURATION - elapsed) / 1000))
      if (timeLeft.value === 0) {
        clearInterval(timerInterval!)
        timerInterval = null
      }
    }, 1000)
  }

  onMounted(() => {
    socket.on('connected', (data: { playerId: string; playersCount: number }) => {
      playersCount.value = data.playersCount
      joined.value = false
      message.value = 'Connected! Please join the game.'
      startTime.value = 0
      timeLeft.value = 0
      console.log(`Connected: Player ID ${data.playerId}, Players: ${data.playersCount}/2`)
    })

    socket.on('joined', (data: { playerId: string; playersCount: number }) => {
      playersCount.value = data.playersCount
      joined.value = true
      message.value =
        joinedCount.value < 2
          ? 'Waiting for another player to join...'
          : 'Game started! Choose your move within 30 seconds.'
      console.log(`Joined: Player ID ${data.playerId}, Players: ${data.playersCount}/2`)
    })

    socket.on('playersUpdate', (data: { playersCount: number; joinedCount: number }) => {
      playersCount.value = data.playersCount
      joinedCount.value = data.joinedCount
      console.log(`PlayersUpdate received: ${data.playersCount}/2, Joined: ${data.joinedCount}/2`)
      if (joined.value && joinedCount.value < 2) {
        message.value = 'Waiting for another player to join...'
        startTime.value = 0
        timeLeft.value = 0
      }
    })

    socket.on('gameStart', (data: { message: string; startTime: number }) => {
      message.value = data.message
      startTime.value = data.startTime
      timeLeft.value = Math.ceil(TIMEOUT_DURATION / 1000)
      startTimer()
      console.log(`Game started, Start time: ${data.startTime}`)
    })

    socket.on('choiceMade', (msg: string) => {
      message.value = msg
      console.log(`Choice made: ${msg}`)
    })

    socket.on(
      'result',
      (data: {
        p1Choice: number
        p2Choice: number
        result: string
        p1ChoiceText: string
        p2ChoiceText: string
        p1Name: string
        p2Name: string
      }) => {
        result.value = `${data.p1Name} (${data.p1ChoiceText}) vs ${data.p2Name} (${data.p2ChoiceText}). ${data.result}`
        joined.value = false
        startTime.value = 0
        timeLeft.value = 0
        console.log(`Result: ${result.value}`)
      },
    )

    socket.on(
      'playerLeft',
      (data: { playersCount: number; joinedCount: number; playerId?: string }) => {
        playersCount.value = data.playersCount
        joinedCount.value = data.joinedCount
        joined.value = false
        message.value = 'A player left. Please join the game again.'
        result.value = ''
        choice.value = 0
        startTime.value = 0
        timeLeft.value = 0
        console.log(
          `PlayerLeft: Players: ${data.playersCount}/2, Joined: ${data.joinedCount}/2, Disconnected ID: ${data.playerId || 'unknown'}`,
        )
      },
    )

    socket.on('gameReset', (msg: string) => {
      message.value = msg
      result.value = ''
      choice.value = 0
      joined.value = false
      startTime.value = 0
      timeLeft.value = 0
      console.log('Game reset')
    })

    socket.on('error', (msg: string) => {
      message.value = msg
      console.log(`Error: ${msg}`)
    })
  })

  onUnmounted(() => {
    if (timerInterval) clearInterval(timerInterval)
  })

  const joinGame = () => {
    socket.emit('joinGame')
    console.log('Join game requested')
  }

  const makeChoice = (opt: number) => {
    if (playersCount.value < 2 || joinedCount.value < 2) {
      message.value = 'Wait for 2 players to join!'
      console.log('Cannot make choice: Waiting for 2 joined players')
      return
    }
    if (!joined.value) {
      message.value = 'Please join the game first!'
      console.log('Cannot make choice: Not joined')
      return
    }
    choice.value = opt
    socket.emit('makeChoice', opt)
    console.log(`Choice sent: ${opt}`)
  }
</script>

<template>
  <div>
    <h1>Kéo Búa Bao Game</h1>
    <p>Players: {{ playersCount }}/2 (Joined: {{ joinedCount }}/2)</p>
    <p v-if="timerDisplay">{{ timerDisplay }}</p>
    <p>{{ message }}</p>
    <button v-if="!joined" @click="joinGame" class="bg-green-500 text-white p-2 m-2 rounded">
      Tham gia
    </button>
    <div v-if="joined && joinedCount === 2">
      <button @click="makeChoice(1)" class="bg-blue-500 text-white p-2 m-2 rounded">
        Búa (Rock)
      </button>
      <button @click="makeChoice(2)" class="bg-blue-500 text-white p-2 m-2 rounded">
        Kéo (Scissors)
      </button>
      <button @click="makeChoice(3)" class="bg-blue-500 text-white p-2 m-2 rounded">
        Bao (Paper)
      </button>
    </div>
    <p>Kết quả: {{ result }}</p>
  </div>
</template>

<style>
div {
  text-align: center;
  margin-top: 50px;
}
button {
  margin: 10px;
  padding: 10px;
}
</style>
