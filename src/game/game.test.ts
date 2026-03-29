import {
  CPU_PLAYER,
  HUMAN_PLAYER,
  applyMove,
  chooseCpuMove,
  createGame,
  getAvailableMoves,
  isMoveLegal,
} from './game'

describe('game module', () => {
  it('creates a new game with an empty board and the human to move first', () => {
    const game = createGame()

    expect(game.board).toEqual(Array(9).fill(null))
    expect(game.moves).toEqual([])
    expect(game.currentPlayer).toBe(HUMAN_PLAYER)
    expect(game.status).toBe('in_progress')
  })

  it('records moves in order and alternates turns', () => {
    const afterHumanMove = applyMove(createGame(), 4)
    const afterCpuMove = applyMove(afterHumanMove, 0)

    expect(afterHumanMove.moves).toEqual([{ index: 4, player: HUMAN_PLAYER, turn: 1 }])
    expect(afterHumanMove.currentPlayer).toBe(CPU_PLAYER)
    expect(afterCpuMove.moves).toEqual([
      { index: 4, player: HUMAN_PLAYER, turn: 1 },
      { index: 0, player: CPU_PLAYER, turn: 2 },
    ])
    expect(afterCpuMove.currentPlayer).toBe(HUMAN_PLAYER)
  })

  it('detects legal and illegal moves', () => {
    const game = applyMove(createGame(), 2)

    expect(isMoveLegal(game, 2)).toBe(false)
    expect(isMoveLegal(game, 9)).toBe(false)
    expect(isMoveLegal(game, 3)).toBe(true)
  })

  it('detects a winning line and winner', () => {
    let game = createGame()
    game = applyMove(game, 4)
    game = applyMove(game, 0)
    game = applyMove(game, 2)
    game = applyMove(game, 1)
    game = applyMove(game, 6)

    expect(game.status).toBe('won')
    expect(game.winner).toBe(HUMAN_PLAYER)
    expect(game.outcome).toBe('human')
    expect(game.winningLine).toEqual([2, 4, 6])
  })

  it('detects a draw when all cells are filled without a winner', () => {
    let game = createGame()

    for (const move of [0, 1, 2, 4, 3, 5, 7, 6, 8]) {
      game = applyMove(game, move)
    }

    expect(game.status).toBe('draw')
    expect(game.outcome).toBe('draw')
    expect(game.winner).toBeNull()
  })

  it('returns the first available move for the deterministic CPU', () => {
    let game = createGame()
    game = applyMove(game, 4)

    expect(chooseCpuMove(game)).toBe(0)

    game = applyMove(game, 0)
    game = applyMove(game, 8)

    expect(getAvailableMoves(game)).toEqual([1, 2, 3, 5, 6, 7])
    expect(chooseCpuMove(game)).toBe(1)
  })
})
