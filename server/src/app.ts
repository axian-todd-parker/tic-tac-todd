import cors from '@fastify/cors'
import websocket from '@fastify/websocket'
import Fastify from 'fastify'
import type { WebSocket } from 'ws'
import type { MultiplayerWebSocketMessage, MultiplayerWebSocketRole } from '../../shared/multiplayer.js'
import { GameService, HttpError } from './game-service.js'
import { DynamoGameStore } from './store/dynamo-store.js'
import { InMemoryGameStore } from './store/in-memory-store.js'
import type { GameStore } from './types.js'

type AppOptions = {
  now?: () => number
  store?: GameStore
}

type Listener = {
  role: MultiplayerWebSocketRole
  socket: WebSocket
}

type WebSocketRegistry = Map<string, Set<Listener>>

function createStore() {
  const tableName = process.env.DYNAMODB_TABLE_NAME

  if (tableName) {
    return new DynamoGameStore(tableName, process.env.AWS_REGION)
  }

  return new InMemoryGameStore()
}

function asRecord(value: unknown) {
  if (!value || typeof value !== 'object') {
    return {}
  }

  return value as Record<string, unknown>
}

function readPlayerToken(body: unknown) {
  const playerToken = asRecord(body).playerToken

  if (typeof playerToken !== 'string' || !playerToken) {
    throw new HttpError(400, 'playerToken is required')
  }

  return playerToken
}

function readMoveIndex(body: unknown) {
  const index = asRecord(body).index

  if (typeof index !== 'number' || !Number.isInteger(index)) {
    throw new HttpError(400, 'index must be an integer')
  }

  return index
}

export async function createApp(options: AppOptions = {}) {
  const app = Fastify({ logger: false })
  const service = new GameService({
    now: options.now,
    store: options.store ?? createStore(),
  })
  const sockets: WebSocketRegistry = new Map()

  await app.register(cors, { origin: true })
  await app.register(websocket)

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof HttpError) {
      reply.status(error.statusCode).send({ message: error.message })
      return
    }

    reply.status(500).send({ message: 'Internal server error' })
  })

  app.get('/health', async () => ({ ok: true }))

  app.get('/api/games', async (request) => {
    const query = request.query as { status?: string }
    const status = query.status

    if (status && status !== 'waiting' && status !== 'active' && status !== 'over') {
      throw new HttpError(400, 'status must be waiting, active, or over')
    }

    return service.listGames(status as 'waiting' | 'active' | 'over' | undefined)
  })

  app.get('/api/games/:id', async (request) => {
    const { id } = request.params as { id: string }
    return service.getGame(id)
  })

  app.post('/api/games', async (_request, reply) => {
    const created = await service.createGame()
    await broadcast(sockets, created.response.game.id, {
      event: created.event,
      game: created.response.game,
      history: created.response.game.moves,
      role: 'spectator',
      type: 'game-updated',
    })
    reply.status(201).send(created.response)
  })

  app.post('/api/games/:id/join', async (request) => {
    const { id } = request.params as { id: string }
    const joined = await service.joinGame(id)
    await broadcast(sockets, id, {
      event: joined.event,
      game: joined.response.game,
      history: joined.response.game.moves,
      role: 'spectator',
      type: 'game-updated',
    })
    return joined.response
  })

  app.post('/api/games/:id/moves', async (request) => {
    const { id } = request.params as { id: string }
    const playerToken = readPlayerToken(request.body)
    const index = readMoveIndex(request.body)
    const moved = await service.makeMove(id, playerToken, index)
    await broadcast(sockets, id, {
      event: moved.event,
      game: moved.response.game,
      history: moved.response.game.moves,
      role: 'spectator',
      type: 'game-updated',
    })
    return moved.response
  })

  app.post('/api/games/:id/resign', async (request) => {
    const { id } = request.params as { id: string }
    const playerToken = readPlayerToken(request.body)
    const resigned = await service.resignGame(id, playerToken)
    await broadcast(sockets, id, {
      event: resigned.event,
      game: resigned.response.game,
      history: resigned.response.game.moves,
      role: 'spectator',
      type: 'game-updated',
    })
    return resigned.response
  })

  app.post('/api/games/:id/spectate', async (request) => {
    const { id } = request.params as { id: string }
    return service.getGame(id)
  })

  app.post('/api/games/:id/abandonment-check', async (request) => {
    const { id } = request.params as { id: string }
    const body = asRecord(request.body)
    const playerToken = typeof body.playerToken === 'string' ? body.playerToken : undefined
    const checked = await service.abandonmentCheck(id, playerToken)

    if (checked.event) {
      await broadcast(sockets, id, {
        event: checked.event,
        game: checked.response.game,
        history: checked.response.game.moves,
        role: 'spectator',
        type: 'game-updated',
      })
    }

    return checked.response
  })

  app.get(
    '/ws',
    { websocket: true },
    async (socket: WebSocket, request) => {
      const query = request.query as { gameId?: string; playerToken?: string }
      const gameId = query.gameId

      if (!gameId) {
        socket.close(1008, 'gameId is required')
        return
      }

      const snapshot = await service.getGame(gameId).catch(() => null)

      if (!snapshot) {
        socket.close(1008, 'game not found')
        return
      }

      const role = await service.getViewerRole(gameId, query.playerToken)
      const listeners = sockets.get(gameId) ?? new Set<Listener>()
      const listener = { role, socket }
      listeners.add(listener)
      sockets.set(gameId, listeners)

      socket.send(
        JSON.stringify({
          event: 'snapshot',
          game: snapshot.game,
          history: snapshot.game.moves,
          role,
          type: 'snapshot',
        } satisfies MultiplayerWebSocketMessage),
      )

      socket.on('close', () => {
        const current = sockets.get(gameId)

        if (!current) {
          return
        }

        current.delete(listener)

        if (current.size === 0) {
          sockets.delete(gameId)
        }
      })
    },
  )

  return app
}

async function broadcast(
  sockets: WebSocketRegistry,
  gameId: string,
  message: MultiplayerWebSocketMessage,
) {
  const listeners = sockets.get(gameId)

  if (!listeners) {
    return
  }

  for (const listener of listeners) {
    if (listener.socket.readyState === 1) {
      listener.socket.send(JSON.stringify({ ...message, role: listener.role }))
    }
  }
}
