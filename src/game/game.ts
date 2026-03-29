export const HUMAN_PLAYER = 'X' as const
export const CPU_PLAYER = 'O' as const

export type Player = typeof HUMAN_PLAYER | typeof CPU_PLAYER
export type CellValue = Player | null
export type GameStatus = 'in_progress' | 'won' | 'draw'

export type MoveRecord = {
  index: number
  player: Player
  turn: number
}

export type GameState = {
  board: CellValue[]
  currentPlayer: Player
  id: string
  moves: MoveRecord[]
  outcome: 'human' | 'cpu' | 'draw' | null
  status: GameStatus
  winner: Player | null
  winningLine: number[] | null
}

const WINNING_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
] as const

function createId() {
  return `game-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function getWinningLine(board: CellValue[]) {
  for (const [first, second, third] of WINNING_LINES) {
    const firstCell = board[first]

    if (firstCell && firstCell === board[second] && firstCell === board[third]) {
      return [first, second, third]
    }
  }

  return null
}

function getOutcomeFromWinner(winner: Player | null) {
  if (winner === HUMAN_PLAYER) {
    return 'human'
  }

  if (winner === CPU_PLAYER) {
    return 'cpu'
  }

  return null
}

export function createGame(): GameState {
  return {
    board: Array<CellValue>(9).fill(null),
    currentPlayer: HUMAN_PLAYER,
    id: createId(),
    moves: [],
    outcome: null,
    status: 'in_progress',
    winner: null,
    winningLine: null,
  }
}

export function getAvailableMoves(game: GameState) {
  return game.board.flatMap((cell, index) => (cell === null ? [index] : []))
}

export function isMoveLegal(game: GameState, index: number) {
  return (
    game.status === 'in_progress' &&
    index >= 0 &&
    index < game.board.length &&
    game.board[index] === null
  )
}

export function applyMove(game: GameState, index: number): GameState {
  if (!isMoveLegal(game, index)) {
    throw new Error(`Illegal move attempted at cell ${index}`)
  }

  const board = [...game.board]
  board[index] = game.currentPlayer

  const moves = [
    ...game.moves,
    {
      index,
      player: game.currentPlayer,
      turn: game.moves.length + 1,
    },
  ]
  const winningLine = getWinningLine(board)
  const winner = winningLine ? game.currentPlayer : null
  const isDraw = !winner && moves.length === board.length

  return {
    ...game,
    board,
    currentPlayer: winner || isDraw ? game.currentPlayer : game.currentPlayer === HUMAN_PLAYER ? CPU_PLAYER : HUMAN_PLAYER,
    moves,
    outcome: winner ? getOutcomeFromWinner(winner) : isDraw ? 'draw' : null,
    status: winner ? 'won' : isDraw ? 'draw' : 'in_progress',
    winner,
    winningLine,
  }
}

export function chooseCpuMove(game: GameState) {
  if (game.status !== 'in_progress' || game.currentPlayer !== CPU_PLAYER) {
    return null
  }

  return getAvailableMoves(game)[0] ?? null
}
