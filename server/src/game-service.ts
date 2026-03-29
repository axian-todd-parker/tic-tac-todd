import crypto from 'node:crypto'
import {
  MAX_CONCURRENT_MULTIPLAYER_GAMES,
  MULTIPLAYER_ABANDONMENT_MS,
  type MultiplayerAbandonmentResponse,
  type MultiplayerGameListResponse,
  type MultiplayerGameMutationResponse,
  type MultiplayerGameSummary,
  type MultiplayerWebSocketRole,
  type MultiplayerGameView,
  type MultiplayerPlayer,
  type MultiplayerSessionResponse,
} from '../../shared/multiplayer.js'
import { applyMove, createEmptyBoard } from './lib/game-engine.js'
import type { GameStore, StoredMultiplayerGame } from './types.js'

type GameEvent = 'abandoned' | 'created' | 'joined' | 'move' | 'resigned'

export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message)
  }
}

type GameServiceOptions = {
  now?: () => number
  store: GameStore
}

export class GameService {
  private readonly now: () => number

  constructor(private readonly options: GameServiceOptions) {
    this.now = options.now ?? Date.now
  }

  async createGame(): Promise<{ event: GameEvent; response: MultiplayerSessionResponse }> {
    const openGames = await this.options.store.countOpenGames()

    if (openGames >= MAX_CONCURRENT_MULTIPLAYER_GAMES) {
      throw new HttpError(429, 'Maximum concurrent multiplayer games reached')
    }

    const timestamp = this.timestamp()
    const game: StoredMultiplayerGame = {
      board: createEmptyBoard(),
      createdAt: timestamp,
      currentPlayer: 'X',
      endReason: null,
      endedAt: null,
      id: crypto.randomUUID(),
      lastActionAt: timestamp,
      moves: [],
      playerTokens: {
        O: null,
        X: this.token(),
      },
      seatCount: 1,
      status: 'waiting',
      updatedAt: timestamp,
      winner: null,
      winningLine: null,
    }

    await this.options.store.createGame(game)

    return {
      event: 'created',
      response: {
        game: this.toPublicGame(game),
        playerRole: 'X',
        playerToken: game.playerTokens.X!,
      },
    }
  }

  async listGames(status?: MultiplayerGameView['status']): Promise<MultiplayerGameListResponse> {
    const games = await this.options.store.listGames(status)

    return {
      games: games.map((game) => this.toSummary(game)),
    }
  }

  async getGame(id: string): Promise<MultiplayerGameMutationResponse> {
    const game = await this.requireGame(id)

    return {
      game: this.toPublicGame(game),
    }
  }

  async getViewerRole(id: string, playerToken?: string): Promise<MultiplayerWebSocketRole> {
    const game = await this.requireGame(id)
    return this.roleForToken(game, playerToken) ?? 'spectator'
  }

  async joinGame(id: string): Promise<{ event: GameEvent; response: MultiplayerSessionResponse }> {
    const game = await this.requireGame(id)

    if (game.status !== 'waiting') {
      throw new HttpError(409, 'Game is not accepting new players')
    }

    if (game.playerTokens.O) {
      throw new HttpError(409, 'Game is already full')
    }

    const timestamp = this.timestamp()
    const updatedGame: StoredMultiplayerGame = {
      ...game,
      lastActionAt: timestamp,
      playerTokens: {
        ...game.playerTokens,
        O: this.token(),
      },
      seatCount: 2,
      status: 'active',
      updatedAt: timestamp,
    }

    await this.options.store.saveGame(updatedGame)

    return {
      event: 'joined',
      response: {
        game: this.toPublicGame(updatedGame),
        playerRole: 'O',
        playerToken: updatedGame.playerTokens.O!,
      },
    }
  }

  async makeMove(
    id: string,
    playerToken: string,
    index: number,
  ): Promise<{ event: GameEvent; response: MultiplayerGameMutationResponse }> {
    const game = await this.requireGame(id)
    this.assertKnownPlayer(game, playerToken)

    if (game.status !== 'active') {
      throw new HttpError(409, 'Game is not active')
    }

    if (game.playerTokens[game.currentPlayer] !== playerToken) {
      throw new HttpError(409, 'It is not your turn')
    }

    const timestamp = this.timestamp()
    const updatedGame: StoredMultiplayerGame = {
      ...applyMove(game, index, timestamp),
      playerTokens: { ...game.playerTokens },
    }

    await this.options.store.saveGame(updatedGame)

    return {
      event: 'move',
      response: {
        game: this.toPublicGame(updatedGame),
      },
    }
  }

  async resignGame(
    id: string,
    playerToken: string,
  ): Promise<{ event: GameEvent; response: MultiplayerGameMutationResponse }> {
    const game = await this.requireGame(id)
    const playerRole = this.roleForToken(game, playerToken)

    if (!playerRole) {
      throw new HttpError(403, 'Unknown player token')
    }

    if (game.status !== 'active') {
      throw new HttpError(409, 'Only active games can be resigned')
    }

    const timestamp = this.timestamp()
    const updatedGame: StoredMultiplayerGame = {
      ...game,
      endReason: 'resign',
      endedAt: timestamp,
      lastActionAt: timestamp,
      status: 'over',
      updatedAt: timestamp,
      winner: playerRole === 'X' ? 'O' : 'X',
      winningLine: null,
    }

    await this.options.store.saveGame(updatedGame)

    return {
      event: 'resigned',
      response: {
        game: this.toPublicGame(updatedGame),
      },
    }
  }

  async abandonmentCheck(
    id: string,
    playerToken?: string,
  ): Promise<{ event: GameEvent | null; response: MultiplayerAbandonmentResponse }> {
    const game = await this.requireGame(id)

    if (playerToken) {
      this.assertKnownPlayer(game, playerToken)
    }

    if (game.status !== 'active') {
      return {
        event: null,
        response: {
          abandoned: false,
          game: this.toPublicGame(game),
        },
      }
    }

    const expired = this.now() - Date.parse(game.lastActionAt) >= MULTIPLAYER_ABANDONMENT_MS

    if (!expired) {
      return {
        event: null,
        response: {
          abandoned: false,
          game: this.toPublicGame(game),
        },
      }
    }

    const timestamp = this.timestamp()
    const updatedGame: StoredMultiplayerGame = {
      ...game,
      endReason: 'abandonment',
      endedAt: timestamp,
      lastActionAt: timestamp,
      status: 'over',
      updatedAt: timestamp,
      winner: game.currentPlayer === 'X' ? 'O' : 'X',
      winningLine: null,
    }

    await this.options.store.saveGame(updatedGame)

    return {
      event: 'abandoned',
      response: {
        abandoned: true,
        game: this.toPublicGame(updatedGame),
      },
    }
  }

  private assertKnownPlayer(game: StoredMultiplayerGame, playerToken: string) {
    if (!this.roleForToken(game, playerToken)) {
      throw new HttpError(403, 'Unknown player token')
    }
  }

  private async requireGame(id: string) {
    const game = await this.options.store.getGame(id)

    if (!game) {
      throw new HttpError(404, 'Game not found')
    }

    return game
  }

  private roleForToken(game: StoredMultiplayerGame, playerToken?: string): MultiplayerPlayer | null {
    if (!playerToken) {
      return null
    }

    if (game.playerTokens.X === playerToken) {
      return 'X'
    }

    if (game.playerTokens.O === playerToken) {
      return 'O'
    }

    return null
  }

  private timestamp() {
    return new Date(this.now()).toISOString()
  }

  private token() {
    return crypto.randomUUID()
  }

  private toPublicGame(game: StoredMultiplayerGame): MultiplayerGameView {
    const publicGame = { ...game }
    delete (publicGame as Partial<StoredMultiplayerGame>).playerTokens
    return publicGame
  }

  private toSummary(game: StoredMultiplayerGame): MultiplayerGameSummary {
    return {
      createdAt: game.createdAt,
      currentPlayer: game.currentPlayer,
      endReason: game.endReason,
      endedAt: game.endedAt,
      id: game.id,
      moveCount: game.moves.length,
      seatCount: game.seatCount,
      status: game.status,
      updatedAt: game.updatedAt,
      winner: game.winner,
    }
  }
}
