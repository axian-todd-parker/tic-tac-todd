import type {
  MultiplayerAbandonmentResponse,
  MultiplayerGameListResponse,
  MultiplayerGameMutationResponse,
  MultiplayerSessionResponse,
} from '../../shared/multiplayer'

async function requestJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init)

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null
    throw new Error(payload?.message ?? `Request failed with status ${response.status}`)
  }

  return (await response.json()) as T
}

export function listGames(status?: 'active' | 'over' | 'waiting') {
  const query = status ? `?status=${status}` : ''
  return requestJson<MultiplayerGameListResponse>(`/api/games${query}`)
}

export function getGame(id: string) {
  return requestJson<MultiplayerGameMutationResponse>(`/api/games/${id}`)
}

export function createMultiplayerGame() {
  return requestJson<MultiplayerSessionResponse>('/api/games', {
    method: 'POST',
  })
}

export function joinMultiplayerGame(id: string) {
  return requestJson<MultiplayerSessionResponse>(`/api/games/${id}/join`, {
    method: 'POST',
  })
}

export function sendMove(id: string, playerToken: string, index: number) {
  return requestJson<MultiplayerGameMutationResponse>(`/api/games/${id}/moves`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ index, playerToken }),
  })
}

export function resignGame(id: string, playerToken: string) {
  return requestJson<MultiplayerGameMutationResponse>(`/api/games/${id}/resign`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ playerToken }),
  })
}

export function checkAbandonment(id: string, playerToken: string) {
  return requestJson<MultiplayerAbandonmentResponse>(`/api/games/${id}/abandonment-check`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ playerToken }),
  })
}

export function multiplayerWebSocketUrl(gameId: string, playerToken?: string) {
  const url = new URL(`/ws?gameId=${encodeURIComponent(gameId)}`, window.location.origin)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'

  if (playerToken) {
    url.searchParams.set('playerToken', playerToken)
  }

  return url.toString()
}
