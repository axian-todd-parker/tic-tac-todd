export const MULTIPLAYER_PLAYERS = ['X', 'O'] as const
export const MULTIPLAYER_ABANDONMENT_MS = 3 * 60 * 1000
export const MAX_CONCURRENT_MULTIPLAYER_GAMES = 25

export type MultiplayerPlayer = (typeof MULTIPLAYER_PLAYERS)[number]
export type MultiplayerCell = MultiplayerPlayer | null
export type MultiplayerLifecycleStatus = 'waiting' | 'active' | 'over'
export type MultiplayerEndReason = 'win' | 'draw' | 'resign' | 'abandonment' | null

export type MultiplayerMove = {
  index: number
  player: MultiplayerPlayer
  turn: number
  createdAt: string
}

export type MultiplayerGameView = {
  board: MultiplayerCell[]
  createdAt: string
  currentPlayer: MultiplayerPlayer
  endReason: MultiplayerEndReason
  endedAt: string | null
  id: string
  lastActionAt: string
  moves: MultiplayerMove[]
  seatCount: number
  status: MultiplayerLifecycleStatus
  updatedAt: string
  winner: MultiplayerPlayer | null
  winningLine: number[] | null
}

export type MultiplayerGameSummary = Pick<
  MultiplayerGameView,
  'createdAt' | 'currentPlayer' | 'endReason' | 'endedAt' | 'id' | 'seatCount' | 'status' | 'updatedAt' | 'winner'
> & {
  moveCount: number
}

export type MultiplayerSessionResponse = {
  game: MultiplayerGameView
  playerRole: MultiplayerPlayer
  playerToken: string
}

export type MultiplayerGameMutationResponse = {
  game: MultiplayerGameView
}

export type MultiplayerGameListResponse = {
  games: MultiplayerGameSummary[]
}

export type MultiplayerAbandonmentResponse = {
  abandoned: boolean
  game: MultiplayerGameView
}

export type MultiplayerWebSocketRole = MultiplayerPlayer | 'spectator'
export type MultiplayerWebSocketEvent =
  | 'snapshot'
  | 'created'
  | 'joined'
  | 'move'
  | 'resigned'
  | 'abandoned'

export type MultiplayerWebSocketMessage = {
  event: MultiplayerWebSocketEvent
  game: MultiplayerGameView
  history: MultiplayerMove[]
  role: MultiplayerWebSocketRole
  type: 'snapshot' | 'game-updated'
}
