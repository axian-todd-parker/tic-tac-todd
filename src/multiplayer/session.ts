import type { MultiplayerPlayer } from '../../shared/multiplayer'

const SESSION_PREFIX = 'tic-tac-toe-multiplayer:'

export type MultiplayerSession = {
  gameId: string
  playerRole: MultiplayerPlayer
  playerToken: string
}

function storageKey(gameId: string) {
  return `${SESSION_PREFIX}${gameId}`
}

export function saveMultiplayerSession(session: MultiplayerSession) {
  window.sessionStorage.setItem(storageKey(session.gameId), JSON.stringify(session))
}

export function readMultiplayerSession(gameId: string) {
  const raw = window.sessionStorage.getItem(storageKey(gameId))

  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as MultiplayerSession
  } catch {
    return null
  }
}

export function clearMultiplayerSession(gameId: string) {
  window.sessionStorage.removeItem(storageKey(gameId))
}
