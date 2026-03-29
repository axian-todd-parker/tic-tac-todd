let audioContext: AudioContext | null = null

async function getAudioContext() {
  const Context =
    window.AudioContext ||
    ('webkitAudioContext' in window
      ? (window.webkitAudioContext as typeof AudioContext)
      : undefined)

  if (!Context) {
    return null
  }

  audioContext ??= new Context()

  if (audioContext.state === 'suspended') {
    await audioContext.resume()
  }

  return audioContext
}

async function playSequence(
  notes: Array<{ duration: number; frequency: number; gain: number; type: OscillatorType }>,
) {
  const context = await getAudioContext()

  if (!context) {
    return
  }

  let cursor = context.currentTime

  for (const note of notes) {
    const oscillator = context.createOscillator()
    const gainNode = context.createGain()

    oscillator.type = note.type
    oscillator.frequency.setValueAtTime(note.frequency, cursor)
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(note.frequency * 0.92, 40),
      cursor + note.duration,
    )

    gainNode.gain.setValueAtTime(0.0001, cursor)
    gainNode.gain.exponentialRampToValueAtTime(note.gain, cursor + 0.01)
    gainNode.gain.exponentialRampToValueAtTime(0.0001, cursor + note.duration)

    oscillator.connect(gainNode)
    gainNode.connect(context.destination)
    oscillator.start(cursor)
    oscillator.stop(cursor + note.duration)
    cursor += note.duration + 0.03
  }
}

export function playMoveSound() {
  return playSequence([
    { duration: 0.12, frequency: 180, gain: 0.08, type: 'triangle' },
    { duration: 0.08, frequency: 92, gain: 0.05, type: 'sine' },
  ])
}

export function playWinningSound() {
  return playSequence([
    { duration: 0.14, frequency: 440, gain: 0.05, type: 'triangle' },
    { duration: 0.14, frequency: 554, gain: 0.06, type: 'triangle' },
    { duration: 0.18, frequency: 659, gain: 0.08, type: 'triangle' },
  ])
}

export function playLosingSound() {
  return playSequence([
    { duration: 0.16, frequency: 329, gain: 0.05, type: 'sawtooth' },
    { duration: 0.18, frequency: 246, gain: 0.05, type: 'sawtooth' },
    { duration: 0.22, frequency: 164, gain: 0.05, type: 'sawtooth' },
  ])
}
