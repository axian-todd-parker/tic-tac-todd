import type { MultiplayerGameView, MultiplayerPlayer } from '../../shared/multiplayer.js'

export type StoredMultiplayerGame = MultiplayerGameView & {
  playerTokens: Record<MultiplayerPlayer, string | null>
}

export type GameStore = {
  countOpenGames: () => Promise<number>
  createGame: (game: StoredMultiplayerGame) => Promise<void>
  getGame: (id: string) => Promise<StoredMultiplayerGame | null>
  listGames: (status?: StoredMultiplayerGame['status']) => Promise<StoredMultiplayerGame[]>
  saveGame: (game: StoredMultiplayerGame) => Promise<void>
}
