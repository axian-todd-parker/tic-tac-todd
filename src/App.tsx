import confetti from 'canvas-confetti'
import { useEffect, useEffectEvent, useMemo, useRef, useState, type ReactNode } from 'react'
import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import type {
  MultiplayerGameSummary,
  MultiplayerGameView,
  MultiplayerWebSocketMessage,
  MultiplayerWebSocketRole,
} from '../shared/multiplayer'
import './App.css'
import { playLosingSound, playMoveSound, playWinningSound } from './audio/sound'
import {
  checkAbandonment,
  createMultiplayerGame,
  getGame,
  joinMultiplayerGame,
  listGames,
  multiplayerWebSocketUrl,
  resignGame,
  sendMove,
} from './multiplayer/api'
import {
  clearMultiplayerSession,
  readMultiplayerSession,
  saveMultiplayerSession,
  type MultiplayerSession,
} from './multiplayer/session'
import {
  CPU_PLAYER,
  HUMAN_PLAYER,
  applyMove,
  chooseCpuMove,
  createGame,
  getAvailableMoves,
  isMoveLegal,
  type GameState,
} from './game/game'

type CellButtonProps = {
  cell: string | null
  disabled: boolean
  hint: boolean
  index: number
  onMove: (index: number) => void
}

function CellButton({ cell, disabled, hint, index, onMove }: CellButtonProps) {
  const row = Math.floor(index / 3) + 1
  const column = (index % 3) + 1

  return (
    <button
      type="button"
      className={`board-cell ${hint ? 'is-playable' : 'is-locked'} ${cell ?? ''}`}
      aria-label={`Row ${row} Column ${column}`}
      data-testid={`cell-${index}`}
      disabled={disabled}
      onClick={() => onMove(index)}
    >
      <span>{cell}</span>
    </button>
  )
}

function useGameFeedback(
  game: { id: string; moves: Array<unknown>; winner: string | null } | null,
  outcomeKey: string | null,
) {
  const moveCountRef = useRef(0)
  const outcomeRef = useRef<string | null>(null)

  const playMove = useEffectEvent(() => {
    void playMoveSound()
  })

  const playWin = useEffectEvent(() => {
    void playWinningSound()
    confetti({
      angle: 90,
      spread: 80,
      startVelocity: 45,
      particleCount: 120,
      origin: { y: 0.65 },
    })
  })

  const playLoss = useEffectEvent(() => {
    void playLosingSound()
  })

  useEffect(() => {
    if (!game) {
      moveCountRef.current = 0
      outcomeRef.current = null
      return
    }

    if (game.moves.length > moveCountRef.current) {
      moveCountRef.current = game.moves.length
      playMove()
    }

    if (outcomeKey && outcomeRef.current !== `${game.id}:${outcomeKey}`) {
      outcomeRef.current = `${game.id}:${outcomeKey}`

      if (outcomeKey === 'win') {
        playWin()
      } else if (outcomeKey === 'loss') {
        playLoss()
      }
    }
  }, [game, outcomeKey])
}

type HomePageProps = {
  onCreateMultiplayer: () => Promise<void>
  onJoinMultiplayer: (gameId: string) => Promise<void>
  onSpectate: (gameId: string) => void
  onStartLocalGame: () => void
}

function HomePage({
  onCreateMultiplayer,
  onJoinMultiplayer,
  onSpectate,
  onStartLocalGame,
}: HomePageProps) {
  const [waitingGames, setWaitingGames] = useState<MultiplayerGameSummary[]>([])
  const [activeGames, setActiveGames] = useState<MultiplayerGameSummary[]>([])
  const [loadingGames, setLoadingGames] = useState(true)
  const [busyAction, setBusyAction] = useState<{ gameId: string; type: 'join' | 'spectate' } | null>(
    null,
  )
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadGameLists() {
      try {
        const [waitingResponse, activeResponse] = await Promise.all([
          listGames('waiting'),
          listGames('active'),
        ])

        if (!cancelled) {
          setWaitingGames(waitingResponse.games)
          setActiveGames(activeResponse.games)
          setError(null)
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load multiplayer games')
        }
      } finally {
        if (!cancelled) {
          setLoadingGames(false)
        }
      }
    }

    void loadGameLists()
    const interval = window.setInterval(() => {
      void loadGameLists()
    }, 5000)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [])

  const handleCreate = async () => {
    setCreating(true)
    setError(null)

    try {
      await onCreateMultiplayer()
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create game')
    } finally {
      setCreating(false)
    }
  }

  const handleJoin = async (gameId: string) => {
    setBusyAction({ gameId, type: 'join' })
    setError(null)

    try {
      await onJoinMultiplayer(gameId)
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : 'Failed to join game')
      const refreshed = await Promise.all([
        listGames('waiting').catch(() => null),
        listGames('active').catch(() => null),
      ])

      if (refreshed[0]) {
        setWaitingGames(refreshed[0].games)
      }

      if (refreshed[1]) {
        setActiveGames(refreshed[1].games)
      }
    } finally {
      setBusyAction(null)
    }
  }

  const handleSpectate = (gameId: string) => {
    setBusyAction({ gameId, type: 'spectate' })
    setError(null)
    onSpectate(gameId)
  }

  return (
    <main className="shell landing-shell">
      <section className="hero-panel home-grid">
        <div className="mode-card">
          <p className="eyebrow">Single Player</p>
          <h1>Local Tic Tac Toe with a predictable CPU opponent.</h1>
          <p className="lede">
            Keep the original local game flow with audio feedback, confetti,
            move validation, and a deterministic CPU.
          </p>
          <button type="button" className="primary-action" onClick={onStartLocalGame}>
            Play vs. CPU
          </button>
        </div>

        <div className="mode-card">
          <p className="eyebrow">Multiplayer</p>
          <h2>Create or join a live game</h2>
          <p className="lede">
            The server validates moves, stores history, and broadcasts updates to
            connected players and spectators over WebSockets.
          </p>
          <div className="home-actions">
            <button
              type="button"
              className="primary-action"
              data-testid="create-multiplayer"
              disabled={creating}
              onClick={() => void handleCreate()}
            >
              {creating ? 'Creating...' : 'Create Multiplayer Game'}
            </button>
          </div>

          <section className="waiting-list">
            <div className="waiting-list-header">
              <h3>Waiting Games</h3>
              <button
                type="button"
                className="secondary-action"
                disabled={loadingGames}
                onClick={() => {
                  setLoadingGames(true)
                  void Promise.all([listGames('waiting'), listGames('active')])
                    .then(([waitingResponse, activeResponse]) => {
                      setWaitingGames(waitingResponse.games)
                      setActiveGames(activeResponse.games)
                      setError(null)
                    })
                    .catch((loadError) => {
                      setError(
                        loadError instanceof Error
                          ? loadError.message
                          : 'Failed to refresh games',
                      )
                    })
                    .finally(() => {
                      setLoadingGames(false)
                    })
                }}
              >
                Refresh Waiting
              </button>
            </div>

            {loadingGames ? <p>Loading waiting games...</p> : null}
            {!loadingGames && waitingGames.length === 0 ? (
              <p>No waiting games right now. Create one and share the board.</p>
            ) : null}

            <ul className="game-list">
              {waitingGames.map((game) => (
                <li key={game.id}>
                  <div>
                    <strong>{game.id.slice(0, 8)}</strong>
                    <p>Created {new Date(game.createdAt).toLocaleTimeString()}</p>
                  </div>
                  <button
                    type="button"
                    className="secondary-action"
                    data-testid={`join-game-${game.id}`}
                    disabled={busyAction?.gameId === game.id}
                    onClick={() => void handleJoin(game.id)}
                  >
                    {busyAction?.gameId === game.id && busyAction.type === 'join'
                      ? 'Joining...'
                      : 'Join'}
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="waiting-list">
            <div className="waiting-list-header">
              <h3>Active Games</h3>
              <button
                type="button"
                className="secondary-action"
                disabled={loadingGames}
                onClick={() => {
                  setLoadingGames(true)
                  void Promise.all([listGames('waiting'), listGames('active')])
                    .then(([waitingResponse, activeResponse]) => {
                      setWaitingGames(waitingResponse.games)
                      setActiveGames(activeResponse.games)
                      setError(null)
                    })
                    .catch((loadError) => {
                      setError(
                        loadError instanceof Error
                          ? loadError.message
                          : 'Failed to refresh games',
                      )
                    })
                    .finally(() => {
                      setLoadingGames(false)
                    })
                }}
              >
                Refresh Active
              </button>
            </div>

            {loadingGames ? <p>Loading active games...</p> : null}
            {!loadingGames && activeGames.length === 0 ? (
              <p>No live games right now. Join one when another player arrives.</p>
            ) : null}

            <ul className="game-list">
              {activeGames.map((game) => (
                <li key={game.id}>
                  <div>
                    <strong>{game.id.slice(0, 8)}</strong>
                    <p>{game.moveCount} moves in progress</p>
                  </div>
                  <button
                    type="button"
                    className="secondary-action"
                    data-testid={`spectate-game-${game.id}`}
                    disabled={busyAction?.gameId === game.id}
                    onClick={() => handleSpectate(game.id)}
                  >
                    {busyAction?.gameId === game.id && busyAction.type === 'spectate'
                      ? 'Opening...'
                      : 'Spectate'}
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {error ? <p className="error-line">{error}</p> : null}
        </div>
      </section>
    </main>
  )
}

type LocalGamePageProps = {
  game: GameState
  onMove: (index: number) => void
  onQuit: () => void
  onRematch: () => void
}

function LocalGamePage({ game, onMove, onQuit, onRematch }: LocalGamePageProps) {
  const cpuThinking = game.status === 'in_progress' && game.currentPlayer === CPU_PLAYER
  const availableMoves = useMemo(() => new Set(getAvailableMoves(game)), [game])
  const statusText =
    game.status === 'won'
      ? game.outcome === 'human'
        ? 'You won. Clean finish.'
        : 'You lost. Try again.'
      : game.status === 'draw'
        ? 'Draw game. No winner this round.'
        : cpuThinking
          ? 'CPU is thinking...'
          : game.currentPlayer === HUMAN_PLAYER
            ? 'Your turn'
            : "CPU's turn"

  useGameFeedback(
    game,
    game.status === 'won' ? (game.outcome === 'human' ? 'win' : 'loss') : null,
  )

  return (
    <GameLayout
      actions={
        <>
          <button type="button" className="secondary-action" onClick={onQuit}>
            Quit Game
          </button>
          {game.status !== 'in_progress' ? (
            <button type="button" className="primary-action" onClick={onRematch}>
              Rematch
            </button>
          ) : null}
        </>
      }
      board={
        <>
          <div className="board" aria-label="Tic Tac Toe Board">
            {game.board.map((cell, index) => {
              const legalMove =
                !cpuThinking &&
                game.status === 'in_progress' &&
                game.currentPlayer === HUMAN_PLAYER &&
                availableMoves.has(index)

              return (
                <CellButton
                  key={index}
                  cell={cell}
                  disabled={!legalMove}
                  hint={legalMove}
                  index={index}
                  onMove={onMove}
                />
              )
            })}
          </div>
          <div className="board-feedback">
            {game.status === 'won' && game.winningLine ? (
              <p>Winning line: {game.winningLine.map((cell) => cell + 1).join(', ')}</p>
            ) : null}
            {game.status === 'in_progress' ? (
              <p>Hover highlights valid moves. Occupied cells are locked.</p>
            ) : null}
          </div>
        </>
      }
      details={
        <>
          <section>
            <h2>Match State</h2>
            <dl className="detail-list">
              <div>
                <dt>Status</dt>
                <dd>{game.status}</dd>
              </div>
              <div>
                <dt>Winner</dt>
                <dd>{game.winner ?? 'None'}</dd>
              </div>
              <div>
                <dt>Total Moves</dt>
                <dd>{game.moves.length}</dd>
              </div>
            </dl>
          </section>

          <section>
            <h2>Move History</h2>
            <ol className="move-list">
              {game.moves.map((move) => (
                <li key={`${move.turn}-${move.index}`}>
                  Turn {move.turn}: {move.player} to cell {move.index + 1}
                </li>
              ))}
            </ol>
          </section>
        </>
      }
      eyebrow="Game Detail"
      title="Local Tic Tac Toe"
      statusText={statusText}
      subStatus={`Current turn: ${game.currentPlayer}`}
    />
  )
}

function MultiplayerGameRoute() {
  const navigate = useNavigate()
  const { gameId } = useParams()
  const [game, setGame] = useState<MultiplayerGameView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [connectionLabel, setConnectionLabel] = useState('Connecting...')
  const [socketRole, setSocketRole] = useState<MultiplayerWebSocketRole | null>(null)
  const session = gameId ? readMultiplayerSession(gameId) : null
  const sessionPlayerToken = session?.playerToken
  const role = session?.playerRole ?? socketRole ?? 'spectator'
  const availableMoves = useMemo(
    () => (game ? new Set(game.board.flatMap((cell, index) => (cell === null ? [index] : []))) : new Set<number>()),
    [game],
  )

  useEffect(() => {
    if (!gameId) {
      return
    }

    let active = true
    const playerToken = readMultiplayerSession(gameId)?.playerToken

    void getGame(gameId)
      .then((response) => {
        if (active) {
          setGame(response.game)
          setError(null)
        }
      })
      .catch((loadError) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load game')
        }
      })

    const socket = new WebSocket(multiplayerWebSocketUrl(gameId, playerToken))

    socket.addEventListener('open', () => {
      setConnectionLabel('Connected')
    })

    socket.addEventListener('close', () => {
      setConnectionLabel('Disconnected')
    })

    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data) as MultiplayerWebSocketMessage
      setGame(message.game)
      setSocketRole(message.role)
    })

    return () => {
      active = false
      socket.close()
    }
  }, [gameId])

  useEffect(() => {
    if (!gameId) {
      return
    }

    let cancelled = false

    const syncSnapshot = () => {
      void getGame(gameId)
        .then((response) => {
          if (!cancelled) {
            setGame(response.game)
          }
        })
        .catch(() => undefined)
    }

    const interval = window.setInterval(syncSnapshot, 2000)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [gameId])

  useEffect(() => {
    if (!gameId) {
      return
    }

    const session = readMultiplayerSession(gameId)

    if (!session || !game || game.status !== 'active') {
      return
    }

    const interval = window.setInterval(() => {
      void checkAbandonment(gameId, session.playerToken).catch(() => undefined)
    }, 30000)

    return () => window.clearInterval(interval)
  }, [game, gameId, sessionPlayerToken])

  const canMove =
    !!game &&
    !!session &&
    role !== 'spectator' &&
    game.status === 'active' &&
    game.currentPlayer === role

  useGameFeedback(
    game,
    !game || !session || game.status !== 'over'
      ? null
      : game.winner === session.playerRole
        ? 'win'
        : game.winner
          ? 'loss'
          : null,
  )

  if (!gameId) {
    return <Navigate to="/" replace />
  }

  const makeMove = async (index: number) => {
    if (!session) {
      setError('You are connected as a spectator')
      return
    }

    try {
      const response = await sendMove(gameId, session.playerToken, index)
      setGame(response.game)
      setError(null)
    } catch (moveError) {
      setError(moveError instanceof Error ? moveError.message : 'Move failed')
    }
  }

  const handleResign = async () => {
    if (!session) {
      navigate('/')
      return
    }

    try {
      const response = await resignGame(gameId, session.playerToken)
      setGame(response.game)
      setError(null)
    } catch (resignError) {
      setError(resignError instanceof Error ? resignError.message : 'Resign failed')
    }
  }

  const leaveGame = () => {
    if (session) {
      clearMultiplayerSession(gameId)
    }

    navigate('/')
  }

  const statusText = !game
    ? 'Loading game...'
    : game.status === 'waiting'
      ? 'Waiting for another player to join.'
      : game.status === 'active'
        ? role === 'spectator'
          ? `Watching live. ${game.currentPlayer} to move.`
          : game.currentPlayer === role
            ? 'Your turn'
            : "Opponent's turn"
        : game.endReason === 'draw'
          ? 'Draw game. No winner this round.'
          : game.winner && session && game.winner === session.playerRole
            ? 'You won the multiplayer match.'
            : game.winner && session
              ? 'You lost. Try again.'
              : game.winner
                ? `Winner: ${game.winner}`
                : 'Game over.'

  return (
    <GameLayout
      actions={
        <>
          <button type="button" className="secondary-action" onClick={leaveGame}>
            Return Home
          </button>
          {session && game?.status === 'active' ? (
            <button type="button" className="secondary-action" onClick={() => void handleResign()}>
              Resign
            </button>
          ) : null}
        </>
      }
      board={
        <>
          <div className="board" aria-label="Tic Tac Toe Board">
            {game?.board.map((cell, index) => {
              const legalMove = canMove && availableMoves.has(index)

              return (
                <CellButton
                  key={index}
                  cell={cell}
                  disabled={!legalMove}
                  hint={legalMove}
                  index={index}
                  onMove={(nextIndex) => {
                    void makeMove(nextIndex)
                  }}
                />
              )
            })}
          </div>
          <div className="board-feedback">
            {game?.status === 'waiting' ? (
              <p>Share this game by asking another player to join from the waiting list.</p>
            ) : null}
            {game?.status === 'active' ? (
              <p>Remote moves arrive live through the websocket connection.</p>
            ) : null}
            {game?.status === 'over' && game.winningLine ? (
              <p>Winning line: {game.winningLine.map((cell) => cell + 1).join(', ')}</p>
            ) : null}
          </div>
        </>
      }
      details={
        <>
          <section>
            <h2>Match State</h2>
            <dl className="detail-list">
              <div>
                <dt>Game ID</dt>
                <dd>{gameId.slice(0, 8)}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{game?.status ?? 'loading'}</dd>
              </div>
              <div>
                <dt>You Are</dt>
                <dd>{role}</dd>
              </div>
              <div>
                <dt>Connection</dt>
                <dd>{connectionLabel}</dd>
              </div>
            </dl>
          </section>

          <section>
            <h2>Move History</h2>
            <ol className="move-list">
              {game?.moves.map((move) => (
                <li key={`${move.turn}-${move.createdAt}`}>
                  Turn {move.turn}: {move.player} to cell {move.index + 1}
                </li>
              ))}
            </ol>
          </section>

          {error ? <p className="error-line">{error}</p> : null}
        </>
      }
      eyebrow="Multiplayer"
      title="Live Tic Tac Toe"
      statusText={statusText}
      subStatus={game ? `Current turn: ${game.currentPlayer}` : 'Connecting to server'}
    />
  )
}

type GameLayoutProps = {
  actions: ReactNode
  board: ReactNode
  details: ReactNode
  eyebrow: string
  statusText: string
  subStatus: string
  title: string
}

function GameLayout({
  actions,
  board,
  details,
  eyebrow,
  statusText,
  subStatus,
  title,
}: GameLayoutProps) {
  return (
    <main className="shell game-shell">
      <section className="game-panel">
        <header className="game-header">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
          </div>
          <div className="status-stack">
            <p className="status-badge">{statusText}</p>
            <p className="turn-line">{subStatus}</p>
          </div>
        </header>

        <div className="board-and-sidebar">
          <section className="board-card">{board}</section>

          <aside className="detail-card">
            {details}
            <section className="actions">{actions}</section>
          </aside>
        </div>
      </section>
    </main>
  )
}

function App() {
  const navigate = useNavigate()
  const [localGame, setLocalGame] = useState<GameState | null>(null)

  const startLocalGame = () => {
    setLocalGame(createGame())
    navigate('/local')
  }

  const quitLocalGame = () => {
    setLocalGame(null)
    navigate('/')
  }

  const createLiveGame = async () => {
    const response = await createMultiplayerGame()
    const session: MultiplayerSession = {
      gameId: response.game.id,
      playerRole: response.playerRole,
      playerToken: response.playerToken,
    }

    saveMultiplayerSession(session)
    navigate(`/multiplayer/${response.game.id}`)
  }

  const joinLiveGame = async (gameId: string) => {
    const response = await joinMultiplayerGame(gameId)
    const session: MultiplayerSession = {
      gameId: response.game.id,
      playerRole: response.playerRole,
      playerToken: response.playerToken,
    }

    saveMultiplayerSession(session)
    navigate(`/multiplayer/${response.game.id}`)
  }

  const spectateLiveGame = (gameId: string) => {
    navigate(`/multiplayer/${gameId}`)
  }

  const applyLocalMove = (index: number) => {
    setLocalGame((currentGame) => {
      if (!currentGame || !isMoveLegal(currentGame, index)) {
        return currentGame
      }

      return applyMove(currentGame, index)
    })
  }

  useEffect(() => {
    if (!localGame || localGame.status !== 'in_progress' || localGame.currentPlayer !== CPU_PLAYER) {
      return
    }

    const cpuMove = chooseCpuMove(localGame)

    if (cpuMove === null) {
      return
    }

    const timer = window.setTimeout(() => {
      setLocalGame((currentGame) => {
        if (!currentGame) {
          return currentGame
        }

        return applyMove(currentGame, cpuMove)
      })
    }, 450)

    return () => window.clearTimeout(timer)
  }, [localGame])

  return (
    <Routes>
      <Route
        path="/"
        element={
          <HomePage
            onCreateMultiplayer={createLiveGame}
            onJoinMultiplayer={joinLiveGame}
            onSpectate={spectateLiveGame}
            onStartLocalGame={startLocalGame}
          />
        }
      />
      <Route
        path="/local"
        element={
          localGame ? (
            <LocalGamePage
              game={localGame}
              onMove={applyLocalMove}
              onQuit={quitLocalGame}
              onRematch={startLocalGame}
            />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />
      <Route path="/multiplayer/:gameId" element={<MultiplayerGameRoute />} />
    </Routes>
  )
}

export default App
