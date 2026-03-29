import type { GameStore, StoredMultiplayerGame } from '../types.js'

export class InMemoryGameStore implements GameStore {
  private readonly games = new Map<string, StoredMultiplayerGame>()

  async countOpenGames() {
    return [...this.games.values()].filter((game) => game.status !== 'over').length
  }

  async createGame(game: StoredMultiplayerGame) {
    this.games.set(game.id, structuredClone(game))
  }

  async getGame(id: string) {
    const game = this.games.get(id)
    return game ? structuredClone(game) : null
  }

  async listGames(status?: StoredMultiplayerGame['status']) {
    const games = [...this.games.values()]
      .filter((game) => (status ? game.status === status : true))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))

    return structuredClone(games)
  }

  async saveGame(game: StoredMultiplayerGame) {
    this.games.set(game.id, structuredClone(game))
  }
}
