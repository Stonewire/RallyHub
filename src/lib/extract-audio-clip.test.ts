import { describe, expect, it } from 'vitest'

import { buildClipCommand, LOUDNORM_FILTER } from '@/lib/extract-audio-clip'

// The clip command feeds ffmpeg.wasm directly, so its shape is load-bearing:
// codec, bitrate, sample rate and channel count must stay exactly as before,
// with single-pass loudnorm added so every cut clip plays at an even level.
describe('buildClipCommand', () => {
  it('produces the full argument list in order', () => {
    expect(buildClipCommand('in.mp3', 'out.mp3', 45, 30)).toEqual([
      '-ss',
      '45',
      '-i',
      'in.mp3',
      '-t',
      '30',
      '-af',
      'loudnorm=I=-14:TP=-1.5:LRA=11',
      '-acodec',
      'libmp3lame',
      '-b:a',
      '128k',
      '-ar',
      '44100',
      '-ac',
      '2',
      'out.mp3',
    ])
  })

  it('normalises to the streaming standard', () => {
    expect(LOUDNORM_FILTER).toBe('loudnorm=I=-14:TP=-1.5:LRA=11')
    expect(buildClipCommand('a.mp3', 'b.mp3', 0, 60)).toContain(LOUDNORM_FILTER)
  })

  it('seeks before the input and cuts after it, so start and duration both apply', () => {
    const args = buildClipCommand('song.mp3', 'clip.mp3', 12.5, 90)
    expect(args.indexOf('-ss')).toBeLessThan(args.indexOf('-i'))
    expect(args[args.indexOf('-ss') + 1]).toBe('12.5')
    expect(args.indexOf('-t')).toBeGreaterThan(args.indexOf('-i'))
    expect(args[args.indexOf('-t') + 1]).toBe('90')
  })

  it('pins the output sample rate, which loudnorm would otherwise raise to 192kHz', () => {
    const args = buildClipCommand('in.mp3', 'out.mp3', 0, 30)
    const afIndex = args.indexOf('-af')
    const arIndex = args.indexOf('-ar')
    expect(afIndex).toBeGreaterThan(-1)
    expect(arIndex).toBeGreaterThan(afIndex)
    expect(args[arIndex + 1]).toBe('44100')
  })

  it('ends with the output filename', () => {
    const args = buildClipCommand('in.mp3', 'final.mp3', 30, 30)
    expect(args[args.length - 1]).toBe('final.mp3')
  })
})
