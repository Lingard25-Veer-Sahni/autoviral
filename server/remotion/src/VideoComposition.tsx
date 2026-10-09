import { useMemo } from 'react'
import {
  AbsoluteFill,
  Audio,
  Img,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from 'remotion'
import { TransitionSeries, linearTiming, type TransitionPresentation } from '@remotion/transitions'
import { fade } from '@remotion/transitions/fade'
import { slide } from '@remotion/transitions/slide'
import { wipe } from '@remotion/transitions/wipe'
import { clockWipe } from '@remotion/transitions/clock-wipe'

// The real (non-canvas) rendering path: each scene is a <TransitionSeries.Sequence>
// containing a real animated background (Ken-Burns pan on a still image, or the
// actual stock video clip playing), an animated caption overlay (spring-in slide +
// fade, not a static PNG), and the scene's real narration audio in sync. Adjacent
// scenes crossfade/slide/wipe into each other via `@remotion/transitions` instead
// of hard-cutting, for a more "produced" feel. Assets referenced by filename are
// resolved via Remotion's `staticFile()` against the `publicDir` the bridge module
// (remotionRender.ts) points at — a per-render temp directory containing that
// video's real narration/footage.

// How long each cross-scene transition takes, in frames (at 30fps this is ~0.4s) —
// short enough that the brief narration overlap between adjacent scenes isn't
// jarring, long enough to actually read as an intentional transition. Exported
// so Root.tsx's `calculateMetadata` can compute the *actual* total duration:
// TransitionSeries overlaps each transition's frames between the two scenes it
// joins, so the rendered composition is shorter than a naive sum of scene
// durations by (TRANSITION_FRAMES * number of transitions).
export const TRANSITION_FRAMES = 12

/** Total frames a TransitionSeries built from these scenes actually renders to. */
export function totalDurationInFrames(scenes: RemotionScene[]): number {
  const rawSum = scenes.reduce((sum, scene) => sum + scene.durationInFrames, 0)
  const transitionCount = Math.max(0, scenes.length - 1)
  return Math.max(1, rawSum - transitionCount * TRANSITION_FRAMES)
}

// Cycle through a few different transition "looks" so a multi-scene video doesn't
// just crossfade the same way every time — genuinely varied, not just one preset.
// clockWipe needs the actual composition dimensions, so this is a function of
// (index, width, height) rather than a static table.
function transitionPresentationFor(
  index: number,
  width: number,
  height: number
  // Each presentation factory returns a differently-parameterized
  // `TransitionPresentation<XProps>` — `<any>` here is the deliberately loose
  // common type across all of them (mirrors how @remotion/transitions'
  // examples type a variable list of presentations), not an escape hatch for
  // an actual typing gap.
): TransitionPresentation<any> {
  const variants: TransitionPresentation<any>[] = [
    fade(),
    slide({ direction: 'from-right' }),
    wipe({ direction: 'from-left' }),
    clockWipe({ width, height }),
    slide({ direction: 'from-bottom' }),
  ]
  return variants[index % variants.length]
}

export interface RemotionScene {
  /** Filename (relative to publicDir) of this scene's real TTS narration audio. */
  narrationFile: string
  /** Exact frame count this scene occupies, derived from the real narration duration. */
  durationInFrames: number
  /** How many of `durationInFrames` are real speech (excludes the trailing pad) --
   * captions are timed against this so they finish advancing exactly as the audio does. */
  narrationDurationInFrames: number
  /** Real narration text for this scene -- what the captions are actually built from. */
  narration: string
  /** Bold short caption blurb (unused for the caption itself now, kept as a fallback
   * for scenes with no narration text). */
  onScreenText: string
  /** Whether the background asset is a real stock video clip or a still fallback image. */
  backgroundType: 'video' | 'image'
  /** Filename (relative to publicDir) of the background asset. */
  backgroundFile: string
}

export interface RemotionVideoProps {
  scenes: RemotionScene[]
  width: number
  height: number
  fps: number
  brandYellow: string
  // Mirrors the index signature on `RemotionVideoInputProps` in the server's
  // remotionRender.ts — Remotion's own `<Composition>`/`calculateMetadata`
  // types treat props as `Record<string, unknown>`, so this keeps the shared
  // JSON-serializable shape assignable there too.
  [key: string]: unknown
}

export const defaultRemotionProps: RemotionVideoProps = {
  scenes: [],
  width: 1080,
  height: 1920,
  fps: 30,
  brandYellow: '#f5c400',
}

const CAPTION_FONT_FAMILY = '"Arial Black", Arial, sans-serif'
const CAPTION_LINE_HEIGHT = 1.22
const CAPTION_MAX_LINES = 4

// Lazily created + cached measuring canvas. Remotion compositions only ever
// execute in a real browser (Studio preview or the headless-Chromium
// renderer), so `document` is always available at render time — this guard
// just keeps the module importable in non-DOM contexts (e.g. type-checking).
let measureCtx: CanvasRenderingContext2D | null | undefined
function getMeasureContext(): CanvasRenderingContext2D | null {
  if (measureCtx !== undefined) return measureCtx
  if (typeof document === 'undefined') {
    measureCtx = null
    return measureCtx
  }
  measureCtx = document.createElement('canvas').getContext('2d')
  return measureCtx
}

/** Real (canvas-measured) pixel width of `text` set at `fontSize`, falling back to an
 * average glyph-width estimate when no canvas is available (non-DOM typecheck context). */
function measureTextWidth(text: string, fontSize: number): number {
  const ctx = getMeasureContext()
  if (ctx) {
    ctx.font = `900 ${fontSize}px ${CAPTION_FONT_FAMILY}`
    return ctx.measureText(text).width
  }
  return text.length * fontSize * 0.62
}

/** Greedy word-wrap `text` into lines that each fit within `maxWidth` px at `fontSize`. */
function wrapToLines(text: string, fontSize: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) return ['']

  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (!current || measureTextWidth(candidate, fontSize) <= maxWidth) {
      current = candidate
    } else {
      lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines
}

/**
 * Real shrink-to-fit: finds the largest font size (down to a hard floor) at
 * which the caption both wraps to no more than CAPTION_MAX_LINES lines *and*
 * the resulting text block's height stays within the frame — mirroring the
 * legacy canvas engine's shrink loop, but computed once per scene (not per
 * frame) via a real text-measuring canvas instead of a fixed font size.
 */
function useFitCaption(text: string, width: number, height: number) {
  return useMemo(() => {
    const upper = text.toUpperCase()
    // Sized for a single word/very short chunk at a time (see
    // CAPTION_WORDS_PER_CHUNK below) — with that little text on screen at
    // once there's room to go noticeably bigger than the old multi-word
    // caption block, which is the point: bigger + one word at a time reads
    // as real karaoke-style captions instead of a subtitle bar.
    const maxFontSize = width * 0.15
    const minFontSize = width * 0.05
    // Must match the caption card's actual rendered inner width, not just "how much
    // room looks available" -- the card div is capped at maxWidth: 86% of the full
    // frame *and* has 5%+5% horizontal padding subtracted from that (both percentages
    // are relative to the frame, since that's the padding's containing block), so the
    // real usable text width is ~76% of the frame, not 88%. Using 88% here previously
    // let this function report text as "fitting" when the actual card would still
    // clip it off the edge — confirmed via a real rendered frame.
    const maxTextWidth = width * 0.72
    const maxBlockHeight = height * 0.4

    // wrapToLines always keeps at least one word per line even if that word alone
    // overflows maxWidth (there's nothing smaller to break it into) -- with
    // one-word-at-a-time captions at this larger font size, a long word hitting
    // that case is common, so the shrink loop must also check each line's actual
    // rendered width, not just line count / block height (which alone would never
    // catch a single too-wide word before this).
    let fontSize = maxFontSize
    let lines = wrapToLines(upper, fontSize, maxTextWidth)
    const widestLineWidth = () => Math.max(...lines.map((l) => measureTextWidth(l, fontSize)))
    while (
      fontSize > minFontSize &&
      (lines.length > CAPTION_MAX_LINES ||
        lines.length * fontSize * CAPTION_LINE_HEIGHT > maxBlockHeight ||
        widestLineWidth() > maxTextWidth)
    ) {
      fontSize -= 2
      lines = wrapToLines(upper, fontSize, maxTextWidth)
    }
    return { fontSize, lines }
  }, [text, width, height])
}

// One word on screen at a time — real karaoke-style captions that advance
// with each word of the actual narration, not multi-word chunks.
const CAPTION_WORDS_PER_CHUNK = 1

/** Splits narration into individual words (CAPTION_WORDS_PER_CHUNK = 1) so the
 * on-screen caption advances word-by-word as speech progresses, instead of
 * showing one fixed caption for an entire (possibly multi-sentence) scene. */
function splitCaptionChunks(text: string): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) return ['']
  const chunks: string[] = []
  for (let i = 0; i < words.length; i += CAPTION_WORDS_PER_CHUNK) {
    chunks.push(words.slice(i, i + CAPTION_WORDS_PER_CHUNK).join(' '))
  }
  return chunks
}

interface CaptionTimelineEntry {
  text: string
  start: number
  end: number
}

/**
 * Assigns each caption chunk (a single word) a frame range within the
 * scene's real narration audio duration, weighted by word length (a
 * reasonable proxy for how long it takes to say without real
 * forced-alignment/ASR word timestamps) — longer words get proportionally
 * more screen time, so words advance roughly in step with the actual
 * speech. Every word is floored to a minimum on-screen duration so short
 * words (e.g. "a", "to") don't flash by unreadably fast.
 */
function useCaptionTimeline(chunks: string[], narrationDurationInFrames: number, fps: number): CaptionTimelineEntry[] {
  return useMemo(() => {
    const safeDuration = Math.max(narrationDurationInFrames, chunks.length)
    const minFrames = Math.max(1, Math.round(fps * 0.16))
    const weights = chunks.map((c) => Math.max(c.length, 1))
    const totalWeight = weights.reduce((a, b) => a + b, 0)
    let cursor = 0
    return chunks.map((text, i) => {
      const isLast = i === chunks.length - 1
      const proportional = Math.round((weights[i] / totalWeight) * safeDuration)
      const frames = isLast ? Math.max(safeDuration - cursor, minFrames) : Math.max(proportional, minFrames)
      const start = cursor
      cursor += frames
      return { text, start, end: start + frames }
    })
  }, [chunks, narrationDurationInFrames, fps])
}

function SceneCaption({
  narration,
  onScreenText,
  narrationDurationInFrames,
  brandYellow,
}: {
  narration: string
  onScreenText: string
  narrationDurationInFrames: number
  brandYellow: string
}) {
  const frame = useCurrentFrame()
  const { fps, width, height } = useVideoConfig()

  const chunks = useMemo(() => splitCaptionChunks(narration.trim() || onScreenText), [narration, onScreenText])
  const timeline = useCaptionTimeline(chunks, narrationDurationInFrames, fps)
  const active =
    timeline.find((entry) => frame >= entry.start && frame < entry.end) ?? timeline[timeline.length - 1]
  // Frame relative to this chunk's own start, so the entrance spring/fade
  // replays fresh for every chunk instead of only playing once at frame 0.
  const localFrame = frame - active.start

  const { fontSize, lines } = useFitCaption(active.text, width, height)

  // Real spring physics for the pop-in entrance, plus a quick fade-in.
  // Tuned much snappier than the old multi-word version (higher stiffness,
  // lower mass, shorter travel distance) since individual words can be on
  // screen for well under half a second at normal speaking pace — a slow
  // settle would still be animating in when the next word already swapped in.
  const entrance = spring({ frame: localFrame, fps, config: { damping: 16, mass: 0.3, stiffness: 260 } })
  const translateY = interpolate(entrance, [0, 1], [20, 0])
  const opacity = interpolate(localFrame, [0, fps * 0.06], [0, 1], { extrapolateRight: 'clamp' })
  // Subtle shine sweep across the caption card right as it lands.
  const shineX = interpolate(entrance, [0, 1], [-120, 220])

  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: '9%' }}>
      <div
        style={{
          transform: `translateY(${translateY}px)`,
          opacity,
          maxWidth: '86%',
          textAlign: 'center',
          background:
            'linear-gradient(to top, rgba(10,10,10,0.8) 0%, rgba(10,10,10,0.55) 55%, rgba(10,10,10,0) 100%)',
          padding: '4.5% 5% 3%',
          borderRadius: 28,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${shineX}%`,
            width: '30%',
            background: 'linear-gradient(75deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.14) 50%, rgba(255,255,255,0) 100%)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            width: 100,
            height: 6,
            background: brandYellow,
            margin: '0 auto 20px',
            borderRadius: 3,
          }}
        />
        <div
          style={{
            fontFamily: CAPTION_FONT_FAMILY,
            fontWeight: 900,
            fontSize,
            color: '#f5f5f0',
            textShadow: '0 4px 20px rgba(0,0,0,0.85)',
            lineHeight: CAPTION_LINE_HEIGHT,
            textTransform: 'uppercase',
          }}
        >
          {lines.map((line, idx) => (
            <div key={idx}>{line}</div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  )
}

/** Real Ken Burns pan/zoom on a still image — slow scale + drift across the scene's duration. */
function KenBurnsImage({ src }: { src: string }) {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  const progress = durationInFrames > 1 ? frame / (durationInFrames - 1) : 0
  const scale = interpolate(progress, [0, 1], [1.08, 1.24])
  const translateX = interpolate(progress, [0, 1], [0, -22])
  const translateY = interpolate(progress, [0, 1], [0, 14])

  return (
    <Img
      src={src}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        transform: `scale(${scale}) translate(${translateX}px, ${translateY}px)`,
      }}
    />
  )
}

/** Quick white punch-in flash at the very start of a scene, for a "produced" cut feel. */
function SceneFlash() {
  const frame = useCurrentFrame()
  const opacity = interpolate(frame, [0, 7], [0.3, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return <AbsoluteFill style={{ backgroundColor: '#ffffff', opacity, pointerEvents: 'none' }} />
}

/** Cinematic corner vignette — keeps focus on the center where the subject/caption sits. */
function Vignette() {
  return (
    <AbsoluteFill
      style={{
        background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,0.4) 100%)',
        pointerEvents: 'none',
      }}
    />
  )
}

/** Segmented progress bar across the top — one pill per scene, filling as the current scene plays. */
function SceneProgress({
  sceneIndex,
  totalScenes,
  brandYellow,
}: {
  sceneIndex: number
  totalScenes: number
  brandYellow: string
}) {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  const progress = durationInFrames > 1 ? Math.min(1, Math.max(0, frame / durationInFrames)) : 1

  if (totalScenes <= 1) return null

  return (
    <AbsoluteFill style={{ justifyContent: 'flex-start', alignItems: 'center', paddingTop: '4.2%' }}>
      <div style={{ display: 'flex', gap: 6, width: '86%' }}>
        {Array.from({ length: totalScenes }).map((_, idx) => {
          const fill = idx < sceneIndex ? 1 : idx === sceneIndex ? progress : 0
          return (
            <div
              key={idx}
              style={{
                flex: 1,
                height: 5,
                borderRadius: 3,
                background: 'rgba(255,255,255,0.25)',
                overflow: 'hidden',
                boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
              }}
            >
              <div style={{ width: `${fill * 100}%`, height: '100%', background: brandYellow }} />
            </div>
          )
        })}
      </div>
    </AbsoluteFill>
  )
}

function SceneBackground({ scene }: { scene: RemotionScene }) {
  const file = staticFile(scene.backgroundFile)
  if (scene.backgroundType === 'video') {
    return (
      <OffthreadVideo
        src={file}
        muted
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    )
  }
  return <KenBurnsImage src={file} />
}

export function VideoComposition({ scenes, brandYellow, width, height }: RemotionVideoProps) {
  // TransitionSeries reads its children directly (Sequence/Transition pairs in
  // render order) rather than via React.Children flattening, so this builds one
  // real flat array — a Fragment-per-scene wrapper would NOT reliably flatten
  // the way a plain array does.
  const items = scenes.flatMap((scene, i) => {
    const sequence = (
      <TransitionSeries.Sequence
        key={`scene-${i}`}
        durationInFrames={scene.durationInFrames}
        name={`scene-${i}`}
      >
        <AbsoluteFill>
          <SceneBackground scene={scene} />
          <AbsoluteFill
            style={{
              background: 'radial-gradient(circle at 50% 15%, rgba(245,196,0,0.14), rgba(0,0,0,0) 60%)',
            }}
          />
          <Vignette />
          <SceneFlash />
          <SceneProgress sceneIndex={i} totalScenes={scenes.length} brandYellow={brandYellow} />
          <SceneCaption
            narration={scene.narration}
            onScreenText={scene.onScreenText}
            narrationDurationInFrames={scene.narrationDurationInFrames}
            brandYellow={brandYellow}
          />
          <Audio src={staticFile(scene.narrationFile)} />
        </AbsoluteFill>
      </TransitionSeries.Sequence>
    )
    // No transition after the final scene — nothing to cross into.
    if (i === scenes.length - 1) return [sequence]
    const transition = (
      <TransitionSeries.Transition
        key={`transition-${i}`}
        presentation={transitionPresentationFor(i, width, height)}
        timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
      />
    )
    return [sequence, transition]
  })

  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0a' }}>
      <TransitionSeries>{items}</TransitionSeries>
      <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: '2.4%' }}>
        <div
          style={{
            color: 'rgba(245,245,240,0.5)',
            fontWeight: 600,
            fontSize: 26,
            fontFamily: 'Arial, sans-serif',
            letterSpacing: 1,
          }}
        >
          AUTOVIRAL
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
