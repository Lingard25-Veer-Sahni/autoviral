import { Composition } from 'remotion'
import {
  VideoComposition,
  defaultRemotionProps,
  totalDurationInFrames,
  type RemotionVideoProps,
} from './VideoComposition'

export function RemotionRoot() {
  return (
    <Composition
      id="AutoviralVideo"
      component={VideoComposition}
      durationInFrames={150}
      fps={30}
      width={defaultRemotionProps.width}
      height={defaultRemotionProps.height}
      defaultProps={defaultRemotionProps}
      // Every real video has a different scene count/duration and aspect
      // ratio, so duration/fps/width/height are all derived from whatever
      // `inputProps` the bridge module (remotionRender.ts) passes in via
      // `selectComposition`, rather than being fixed at registration time.
      calculateMetadata={async ({ props }) => {
        const typedProps = props as RemotionVideoProps
        const fps = typedProps.fps || defaultRemotionProps.fps
        // Scenes cross-fade/slide/wipe into each other (see VideoComposition's
        // TransitionSeries), which overlaps adjacent scenes' frames — so the
        // actual rendered length is shorter than a naive sum of scene durations.
        const durationInFrames = totalDurationInFrames(typedProps.scenes)
        return {
          durationInFrames,
          fps,
          width: typedProps.width || defaultRemotionProps.width,
          height: typedProps.height || defaultRemotionProps.height,
        }
      }}
    />
  )
}
