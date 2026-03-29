import { once } from 'node:events'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { WebSocket } from 'ws'
import {
  MULTIPLAYER_ABANDONMENT_MS,
  type MultiplayerSessionResponse,
  type MultiplayerWebSocketMessage,
} from '../../shared/multiplayer.js'
import { createApp } from '../src/app.js'
import { InMemoryGameStore } from '../src/store/in-memory-store.js'

describe('multiplayer server', () => {
  let now = Date.parse('2026-03-30T00:00:00.000Z')
  let address = ''
  let app: Awaited<ReturnType<typeof createApp>>

  beforeEach(async () => {
    now = Date.parse('2026-03-30T00:00:00.000Z')
    app = await createApp({
      now: () => now,
      store: new InMemoryGameStore(),
    })
    await app.listen({ host: '127.0.0.1', port: 0 })
    const listeningAddress = app.server.address()

    if (!listeningAddress || typeof listeningAddress === 'string') {
      throw new Error('Server did not provide a TCP address')
    }

    address = `http://127.0.0.1:${listeningAddress.port}`
  })

  afterEach(async () => {
    await app.close()
  })

  it('rejects the 26th concurrent game', async () => {
    for (let index = 0; index < 25; index += 1) {
      const response = await fetch(`${address}/api/games`, { method: 'POST' })
      expect(response.status).toBe(201)
    }

    const overflow = await fetch(`${address}/api/games`, { method: 'POST' })
    expect(overflow.status).toBe(429)
  })

  it('broadcasts remote moves over websocket', async () => {
    const created = await createGame(address)
    const joined = await joinGame(address, created.game.id)
    const socket = new WebSocket(`${address.replace('http', 'ws')}/ws?gameId=${created.game.id}`)

    const snapshotPromise = once(socket, 'message')
    await once(socket, 'open')
    const [snapshotRaw] = (await snapshotPromise) as [unknown]
    const snapshot = JSON.parse(String(snapshotRaw)) as MultiplayerWebSocketMessage
    expect(snapshot.type).toBe('snapshot')

    const updatePromise = once(socket, 'message')
    const moveResponse = await fetch(`${address}/api/games/${created.game.id}/moves`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        index: 4,
        playerToken: created.playerToken,
      }),
    })

    expect(moveResponse.status).toBe(200)

    const [updateRaw] = (await updatePromise) as [unknown]
    const update = JSON.parse(String(updateRaw)) as MultiplayerWebSocketMessage
    expect(update.event).toBe('move')
    expect(update.role).toBe('spectator')
    expect(update.game.board[4]).toBe('X')
    expect(update.game.currentPlayer).toBe('O')
    expect(joined.playerRole).toBe('O')

    socket.close()
  })

  it('lists active games for spectators after a second player joins', async () => {
    const created = await createGame(address)
    await joinGame(address, created.game.id)

    const response = await fetch(`${address}/api/games?status=active`)

    expect(response.status).toBe(200)
    const payload = (await response.json()) as {
      games: Array<{ id: string; moveCount: number; seatCount: number; status: string }>
    }

    expect(payload.games).toEqual([
      expect.objectContaining({
        id: created.game.id,
        moveCount: 0,
        seatCount: 2,
        status: 'active',
      }),
    ])
  })

  it('marks games over by abandonment when a player times out', async () => {
    const created = await createGame(address)
    await joinGame(address, created.game.id)

    await fetch(`${address}/api/games/${created.game.id}/moves`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        index: 4,
        playerToken: created.playerToken,
      }),
    })

    now += MULTIPLAYER_ABANDONMENT_MS + 1

    const response = await fetch(
      `${address}/api/games/${created.game.id}/abandonment-check`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          playerToken: created.playerToken,
        }),
      },
    )

    expect(response.status).toBe(200)
    const payload = (await response.json()) as {
      abandoned: boolean
      game: { endReason: string | null; status: string; winner: string | null }
    }
    expect(payload.abandoned).toBe(true)
    expect(payload.game.status).toBe('over')
    expect(payload.game.endReason).toBe('abandonment')
    expect(payload.game.winner).toBe('X')
  })

  it('allows players to resign active games', async () => {
    const created = await createGame(address)
    const joined = await joinGame(address, created.game.id)

    const response = await fetch(`${address}/api/games/${created.game.id}/resign`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        playerToken: joined.playerToken,
      }),
    })

    expect(response.status).toBe(200)
    const payload = (await response.json()) as {
      game: { endReason: string | null; status: string; winner: string | null }
    }
    expect(payload.game.status).toBe('over')
    expect(payload.game.endReason).toBe('resign')
    expect(payload.game.winner).toBe('X')
  })
})

async function createGame(address: string) {
  const response = await fetch(`${address}/api/games`, { method: 'POST' })
  return (await response.json()) as MultiplayerSessionResponse
}

async function joinGame(address: string, id: string) {
  const response = await fetch(`${address}/api/games/${id}/join`, { method: 'POST' })
  return (await response.json()) as MultiplayerSessionResponse
}
