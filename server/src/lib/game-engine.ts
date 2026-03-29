import type {
  MultiplayerCell,
  MultiplayerGameView,
  MultiplayerMove,
  MultiplayerPlayer,
} from '../../../shared/multiplayer.js'

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

export function createEmptyBoard() {
  return Array<MultiplayerCell>(9).fill(null)
}

export function isMoveLegal(game: MultiplayerGameView, index: number) {
  return (
    game.status === 'active' &&
    index >= 0 &&
    index < game.board.length &&
    game.board[index] === null
  )
}

function getWinningLine(board: MultiplayerCell[]) {
  for (const [first, second, third] of WINNING_LINES) {
    const value = board[first]

    if (value && value === board[second] && value === board[third]) {
      return [first, second, third]
    }
  }

  return null
}

export function applyMove(
  game: MultiplayerGameView,
  index: number,
  createdAt: string,
): MultiplayerGameView {
  if (!isMoveLegal(game, index)) {
    throw new Error(`Illegal move attempted at cell ${index}`)
  }

  const board = [...game.board]
  board[index] = game.currentPlayer

  const moves: MultiplayerMove[] = [
    ...game.moves,
    {
      createdAt,
      index,
      player: game.currentPlayer,
      turn: game.moves.length + 1,
    },
  ]

  const winningLine = getWinningLine(board)
  const winner = winningLine ? game.currentPlayer : null
  const draw = !winner && moves.length === board.length
  const nextPlayer: MultiplayerPlayer = game.currentPlayer === 'X' ? 'O' : 'X'

  return {
    ...game,
    board,
    currentPlayer: winner || draw ? game.currentPlayer : nextPlayer,
    endReason: winner ? 'win' : draw ? 'draw' : null,
    endedAt: winner || draw ? createdAt : null,
    lastActionAt: createdAt,
    moves,
    status: winner || draw ? 'over' : 'active',
    updatedAt: createdAt,
    winner,
    winningLine,
  }
}
