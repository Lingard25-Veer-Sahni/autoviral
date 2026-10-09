#!/usr/bin/env python3
"""
Autoviral local AI video generation — EXPERIMENTAL, secondary path.

Runs entirely on-device (Apple Silicon, MPS backend), no API key, no cloud
call, zero marginal cost. Uses:
  - Motion module: ByteDance/AnimateDiff-Lightning (few-step distilled, fast)
  - Base checkpoint: SG161222/Realistic Vision V6.0 B1 (fp16, single-file,
    photorealistic-tuned SD1.5) — loaded via from_single_file so we only ever
    download the ~2.1GB fp16 safetensors, not a full fp32 diffusers repo.

This is explicitly a stopgap the user is evaluating locally before deciding
whether to pay for a real generative-video API (Runway/Kling/Luma/Higgsfield/etc).
It will be slower and lower-fidelity than those — SD1.5-based motion synthesis,
not a native video diffusion model. Called from Node via
server/src/services/localVideoGen.ts (child_process.execFile).

Usage:
  python3 generate_clip.py --prompt "..." --out /path/to/clip.mp4 \
      [--width 512] [--height 512] [--steps 4] [--num-frames 16] [--fps 8] [--seed N]

Prints exactly one JSON line to stdout:
  success: {"ok": true, "path": "...", "frames": N, "seconds": S}
  failure: {"ok": false, "error": "..."}   (also sets exit code 1)
All progress/diagnostic logging goes to stderr so stdout stays parseable.
"""
import argparse
import json
import os
import sys
import time


def log(msg: str) -> None:
    print(f"[generate_clip] {msg}", file=sys.stderr, flush=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--prompt", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--width", type=int, default=512)
    parser.add_argument("--height", type=int, default=512)
    parser.add_argument("--steps", type=int, default=4, choices=[1, 2, 4, 8])
    parser.add_argument("--num-frames", type=int, default=16)
    parser.add_argument("--fps", type=int, default=8)
    parser.add_argument("--seed", type=int, default=-1)
    args = parser.parse_args()

    t_start = time.time()

    try:
        log("importing torch/diffusers (first call may take a few seconds)...")
        import torch
        from diffusers import (
            AnimateDiffPipeline,
            MotionAdapter,
            EulerDiscreteScheduler,
            StableDiffusionPipeline,
        )
        from diffusers.utils import export_to_video
        from huggingface_hub import hf_hub_download
        from safetensors.torch import load_file
    except Exception as e:  # noqa: BLE001 - report any import failure as JSON, not a traceback
        print(json.dumps({"ok": False, "error": f"import failed: {e}"}))
        sys.exit(1)

    device = "mps" if torch.backends.mps.is_available() else "cpu"
    # fp16 on the MPS backend is known to produce black/NaN frames for SD1.5 —
    # fp32 is slower but reliable. This whole path is already "slow but free",
    # so we bias towards correctness over speed here.
    dtype = torch.float32
    log(f"device={device} dtype={dtype}")

    try:
        motion_repo = "ByteDance/AnimateDiff-Lightning"
        motion_ckpt = f"animatediff_lightning_{args.steps}step_diffusers.safetensors"
        log(f"loading motion adapter {motion_repo}/{motion_ckpt} (downloads on first run, ~900MB)...")
        adapter = MotionAdapter().to(device, dtype)
        adapter_path = hf_hub_download(motion_repo, motion_ckpt)
        adapter.load_state_dict(load_file(adapter_path, device="cpu"))

        base_repo = "SG161222/Realistic_Vision_V6.0_B1_noVAE"
        base_filename = "Realistic_Vision_V6.0_NV_B1_fp16.safetensors"
        log(f"loading base checkpoint (downloads on first run, ~2.1GB): {base_repo}/{base_filename}")
        # Download via hf_hub_download first (not from_single_file's own URL
        # parsing, which mis-splits some resolve:// URLs) then load the local path.
        base_ckpt_path = hf_hub_download(base_repo, base_filename)
        base = StableDiffusionPipeline.from_single_file(base_ckpt_path, torch_dtype=dtype)

        log("assembling AnimateDiffPipeline from base components + motion adapter...")
        pipe = AnimateDiffPipeline(
            vae=base.vae,
            text_encoder=base.text_encoder,
            tokenizer=base.tokenizer,
            unet=base.unet,
            motion_adapter=adapter,
            scheduler=base.scheduler,
        )
        # Per ByteDance's documented Lightning usage: trailing timestep spacing,
        # linear beta schedule, and CFG effectively disabled (guidance_scale=1.0)
        # since the distilled model is trained to work well without it.
        pipe.scheduler = EulerDiscreteScheduler.from_config(
            pipe.scheduler.config, timestep_spacing="trailing", beta_schedule="linear"
        )
        pipe.to(device)
        pipe.set_progress_bar_config(disable=True)

        generator = None
        if args.seed >= 0:
            # MPS generators are unreliable for reproducibility; seed on CPU instead.
            generator = torch.Generator(device="cpu").manual_seed(args.seed)

        log(f"generating {args.num_frames} frames at {args.width}x{args.height}, {args.steps} steps...")
        result = pipe(
            prompt=args.prompt,
            negative_prompt="blurry, low quality, distorted, deformed, watermark, text, cartoon, illustration",
            width=args.width,
            height=args.height,
            num_frames=args.num_frames,
            guidance_scale=1.0,
            num_inference_steps=args.steps,
            generator=generator,
        )

        frames = result.frames[0]
        out_dir = os.path.dirname(args.out)
        if out_dir:
            os.makedirs(out_dir, exist_ok=True)
        export_to_video(frames, args.out, fps=args.fps)

        elapsed = round(time.time() - t_start, 1)
        log(f"done in {elapsed}s -> {args.out}")
        print(json.dumps({"ok": True, "path": args.out, "frames": len(frames), "seconds": elapsed}))
    except Exception as e:  # noqa: BLE001 - always report failures as a single JSON line
        log(f"FAILED: {e}")
        print(json.dumps({"ok": False, "error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
