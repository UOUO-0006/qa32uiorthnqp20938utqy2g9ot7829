#!/usr/bin/env python3
"""DDBBS MV Build07: lossless Chrome CDP PNG-frame recorder."""
from __future__ import annotations

import argparse
import asyncio
import base64
from collections import deque
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from io import BytesIO
import os
from pathlib import Path
import statistics
import threading
import time
from typing import Any
from urllib.parse import unquote, urlparse
from zipfile import ZIP_STORED, ZipFile

try:
    from PIL import Image
    from playwright.async_api import async_playwright
except ImportError as exc:
    print("必要なPythonパッケージがありません。capture_helper.pyと同じフォルダーで次を実行してください:")
    print("  py -3 -m pip install -r requirements.txt")
    print(f"詳細: {exc}")
    raise SystemExit(2)

BUILD_ID = "DDBBS-MV-20261019-07"
OUTPUT_W, OUTPUT_H = 1440, 1080
OUTPUT_FPS = 30
MAX_ARCHIVE_BYTES = 500_000_000
README_OVERHEAD_RESERVE = 16_384
PNG_COMPRESS_LEVEL = 3
PNG_WORKERS = 2


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args: Any) -> None:
        pass


def local_site_url(site_root: Path) -> tuple[str, ThreadingHTTPServer]:
    site_root = site_root.expanduser().resolve()
    page_path = site_root / "html" / "DDBBS_MV.html"
    if not page_path.is_file():
        raise FileNotFoundError(f"{page_path} が見つかりません。Build07の差分をサイトにコピーしてください。")

    class Handler(QuietHandler):
        def __init__(self, *args: Any, **kwargs: Any) -> None:
            super().__init__(*args, directory=str(site_root), **kwargs)

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    port = server.server_address[1]
    return f"http://127.0.0.1:{port}/html/DDBBS_MV.html", server


def resolve_target(args: argparse.Namespace) -> tuple[str, ThreadingHTTPServer | None]:
    if args.url:
        return args.url, None
    if args.site_root:
        return local_site_url(Path(args.site_root))

    entered = input(
        "Build07の DDBBS_MV.html のHTTPS URL、または html と image を含むサイトフォルダーのパスを入力してください:\n> "
    ).strip().strip('"')
    if not entered:
        raise ValueError("URLまたはサイトフォルダーが入力されていません。")
    if entered.startswith(("https://", "http://")):
        return entered, None
    parsed = urlparse(entered)
    if parsed.scheme == "file":
        file_path = Path(unquote(parsed.path))
        if os.name == "nt" and len(str(file_path)) > 2 and str(file_path)[0] == "\\" and str(file_path)[2] == ":":
            file_path = Path(str(file_path)[1:])
        return local_site_url(file_path.parent.parent if file_path.name.lower() == "ddbbs_mv.html" else file_path)
    path = Path(entered).expanduser()
    if path.is_file() and path.name.lower() == "ddbbs_mv.html":
        return local_site_url(path.parent.parent)
    return local_site_url(path)


def encode_image(image: Image.Image, source_size: tuple[int, int], profile: bytes | None = None) -> tuple[bytes, tuple[int, int], bool, bool]:
    """4:3に画素単位で中央切り出しし、最近傍法だけで1440x1080にする。"""
    width, height = image.size
    if width <= 0 or height <= 0:
        raise ValueError("ブラウザーのスクリーンショットが空です。")
    if abs(width / height - 4 / 3) > 0.005:
        raise ValueError(f"撮影範囲が4:3ではありません: {width}×{height}")

    crop_used = False
    left = top = 0
    right, bottom = width, height
    if width * 3 > height * 4:
        crop_width = min(width, max(1, round(height * 4 / 3)))
        left = (width - crop_width) // 2
        right = left + crop_width
        crop_used = crop_width != width
    elif width * 3 < height * 4:
        crop_height = min(height, max(1, round(width * 3 / 4)))
        top = (height - crop_height) // 2
        bottom = top + crop_height
        crop_used = crop_height != height
    if crop_used:
        image = image.crop((left, top, right, bottom))

    resized = image.size != (OUTPUT_W, OUTPUT_H)
    if resized:
        image = image.resize((OUTPUT_W, OUTPUT_H), resample=Image.Resampling.NEAREST)

    out = BytesIO()
    save_options: dict[str, Any] = {
        "format": "PNG",
        "compress_level": PNG_COMPRESS_LEVEL,
        "optimize": False,
    }
    if profile:
        save_options["icc_profile"] = profile
    image.save(out, **save_options)
    return out.getvalue(), source_size, crop_used, resized


def encode_screencast_frame(raw_png: bytes, rect: dict[str, Any], viewport: tuple[int, int]) -> tuple[bytes, tuple[int, int], bool, bool]:
    """Viewport PNGから#c60だけを切り出し、losslessで1440x1080に正規化する。"""
    with Image.open(BytesIO(raw_png)) as viewport_image:
        viewport_image.load()
        css_w, css_h = viewport
        sx = viewport_image.width / max(1, css_w)
        sy = viewport_image.height / max(1, css_h)
        x0 = round(float(rect["x"]) * sx)
        y0 = round(float(rect["y"]) * sy)
        crop_w = round(float(rect["width"]) * sx)
        crop_h = round(float(rect["height"]) * sy)
        if x0 < 0 or y0 < 0 or crop_w <= 0 or crop_h <= 0 or x0 + crop_w > viewport_image.width or y0 + crop_h > viewport_image.height:
            raise ValueError("CDPスクリーンショット内に4:3撮影範囲が収まりません。")
        stage = viewport_image.crop((x0, y0, x0 + crop_w, y0 + crop_h))
        return encode_image(stage, stage.size, viewport_image.info.get("icc_profile"))


async def stage_rect(page: Any) -> dict[str, Any]:
    rect = await page.evaluate("""() => {
      const box = document.getElementById('c60').getBoundingClientRect();
      return {x: box.x, y: box.y, width: box.width, height: box.height,
              step: window.__mvDirectCapture.getStep()};
    }""")
    if rect["width"] <= 0 or rect["height"] <= 0:
        raise ValueError("4:3撮影範囲 #c60 を取得できません。")
    return rect


async def estimate_refresh_rate(page: Any) -> float:
    intervals = await page.evaluate("""() => new Promise(resolve => {
      const times = [];
      const tick = t => {
        times.push(t);
        if (times.length >= 17) resolve(times.slice(1).map((v, i) => v - times[i]));
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    })""")
    positive = [float(value) for value in intervals if float(value) > 0]
    return 1000.0 / statistics.median(positive) if positive else 60.0


def make_readme(
    *, frames: int, total_bytes: int, sizes: list[int], source_sizes: set[tuple[int, int]],
    cropped_any: bool, resized_any: bool, start_scroll: int, first_scroll: int, end_scroll: int,
    step_values: set[int], elapsed: float, refresh_rate: float, frame_stride: int,
    budget_reached: bool, error: str | None,
) -> bytes:
    avg = round(total_bytes / frames) if frames else 0
    max_size = max(sizes) if sizes else 0
    p95 = sorted(sizes)[max(0, int(.95 * len(sizes)) - 1)] if sizes else 0
    measured_fps = frames / max(elapsed, .001)
    step_text = ", ".join(str(x) for x in sorted(step_values)) if step_values else "20"
    src_text = ", ".join(f"{w}x{h}" for w, h in sorted(source_sizes)) or "未撮影"
    status = f"{MAX_ARCHIVE_BYTES:,} byte ZIP上限に到達" if budget_reached else (f"エラー: {error}" if error else "手動停止")
    text = [
        "DDBBS MV 直接スクリーンショット連番",
        f"Build ID: {BUILD_ID}",
        "撮影方法: PlaywrightからCDP Page.startScreencast（PNG）を受信し、表示画素から#c60を切り出し（getDisplayMedia動画経由なし）",
        f"出力フレーム: {OUTPUT_W} × {OUTPUT_H}",
        f"連番読み込み速度: {OUTPUT_FPS} fps（固定）",
        f"フレーム数: {frames}",
        "開始位置: 現在のスクロール位置を保持し、指定ステップを1回進めた状態をframe_000000.pngに記録",
        f"撮影中のスクロール量（CSS px/フレーム）: {step_text}",
        f"PNG画素: 可逆PNG（zlib圧縮レベル{PNG_COMPRESS_LEVEL}）。パレット変換、ディザリング、閾値化、非可逆圧縮なし",
        "4:3化: ピクセル丸めで縦横比がずれた場合のみ中央を切り出し" + ("（実施）" if cropped_any else "（未実施）"),
        "リサイズ: CSS画素スクリーンショットを1440×1080へ最近傍法のみで変換" + ("（実施）" if resized_any else "（未実施）"),
        f"PNG合計（展開後）: {total_bytes:,} byte（{total_bytes/1e6:.3f} MB）",
        f"PNG平均: {avg:,} byte/フレーム、p95 {p95:,} byte、最大 {max_size:,} byte",
        f"ZIP全体の上限: {MAX_ARCHIVE_BYTES:,} byte（PNGとZIP管理情報を含む）" + ("。上限を超える前に停止" if budget_reached else ""),
        f"4:3ステージの撮影元サイズ: {src_text}",
        f"最初のステップ前 scrollTop: {start_scroll}、frame_000000の scrollTop: {first_scroll}、終了時 scrollTop: {end_scroll}",
        f"Chrome表示更新: {refresh_rate:.1f} Hz、CDP間隔: {frame_stride}更新ごとに1枚",
        f"実測撮影速度: {measured_fps:.2f} 枚/秒（目標ペース {OUTPUT_FPS} fps）",
        "PNG個別の秒数情報はありません。番号順の連番を30fpsで読み込んでください。",
        f"停止理由: {status}",
    ]
    return ("\n".join(text) + "\n").encode("utf-8")


async def record(page: Any, state: dict[str, Any], out_dir: Path, fps: int) -> None:
    state["start_event"].clear()
    cdp = await page.context.new_cdp_session(page)
    pool = ThreadPoolExecutor(max_workers=PNG_WORKERS, thread_name_prefix="mv-png")
    stream_started = False
    pending: deque[tuple[asyncio.Future, int]] = deque()
    frame_events: asyncio.Queue = asyncio.Queue()

    def on_screencast_frame(event: dict[str, Any]) -> None:
        frame_events.put_nowait(event)

    cdp.on("Page.screencastFrame", on_screencast_frame)
    frames = 0
    total_bytes = 0
    zip_entry_overhead = 0
    cropped_any = False
    resized_any = False
    budget_reached = False
    encode_failed = False
    capture_error: str | None = None
    sizes: list[int] = []
    source_sizes: set[tuple[int, int]] = set()
    step_values: set[int] = set()
    start_scroll = first_scroll = final_scroll = 0
    refresh_rate = 60.0
    frame_stride = 2
    helper_start_time = time.perf_counter()
    capture_start_time: float | None = None
    capture_end_time: float | None = None
    last_ui_update = 0.0
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    final_path = out_dir / f"DDBBS_MV_{BUILD_ID[-2:]}_{stamp}.zip"
    part_path = final_path.with_suffix(final_path.suffix + ".part")

    async def write_oldest(archive: ZipFile) -> bool:
        nonlocal frames, total_bytes, zip_entry_overhead, cropped_any, resized_any
        nonlocal budget_reached, encode_failed, capture_error
        future, step_value = pending.popleft()
        try:
            png, source_size, cropped, resized = await future
        except Exception as exc:
            encode_failed = True
            capture_error = str(exc)
            return False
        name = f"frame_{frames:06d}.png"
        entry_overhead = 76 + 2 * len(name)
        projected = total_bytes + len(png) + zip_entry_overhead + entry_overhead + README_OVERHEAD_RESERVE + 22
        if projected > MAX_ARCHIVE_BYTES:
            budget_reached = True
            return False
        archive.writestr(name, png, compress_type=ZIP_STORED)
        zip_entry_overhead += entry_overhead
        frames += 1
        total_bytes += len(png)
        sizes.append(len(png))
        source_sizes.add(source_size)
        cropped_any = cropped_any or cropped
        resized_any = resized_any or resized
        step_values.add(step_value)
        return True

    print(f"\n直接スクリーンショット録画を開始しました。出力先: {final_path}")
    try:
        await cdp.send("Page.enable")
        refresh_rate = await estimate_refresh_rate(page)
        frame_stride = max(1, int(refresh_rate / max(1, fps) + 0.5))
        begin = await page.evaluate("() => window.__mvDirectCapture.begin()")
        start_scroll = int(begin.get("startScrollTop", 0))
        first_scroll = int(begin.get("firstFrameScrollTop", begin.get("scrollTop", 0)))
        final_scroll = first_scroll
        step_values.add(int(begin.get("step", 20)))
        viewport = await page.evaluate("() => ({width: innerWidth, height: innerHeight})")
        await cdp.send("Page.startScreencast", {
            "format": "png", "maxWidth": int(viewport["width"]),
            "maxHeight": int(viewport["height"]), "everyNthFrame": frame_stride,
        })
        stream_started = True

        with ZipFile(part_path, "w", compression=ZIP_STORED, allowZip64=True) as archive:
            while True:
                try:
                    event = frame_events.get_nowait()
                except asyncio.QueueEmpty:
                    if state["stop_event"].is_set():
                        break
                    try:
                        event = await asyncio.wait_for(frame_events.get(), timeout=0.1)
                    except asyncio.TimeoutError:
                        if state["stop_event"].is_set():
                            break
                        continue

                if capture_start_time is None:
                    capture_start_time = time.perf_counter()
                try:
                    raw_viewport = base64.b64decode(event["data"])
                    metadata = event.get("metadata", {})
                    stream_viewport = (
                        int(metadata.get("deviceWidth", viewport["width"])),
                        int(metadata.get("deviceHeight", viewport["height"])),
                    )
                    if state["stop_event"].is_set():
                        capture_info = await stage_rect(page)
                        step_now = int(capture_info.get("step", begin.get("step", 20)))
                    else:
                        capture_info = await page.evaluate("() => window.__mvDirectCapture.captureAndAdvance()")
                        step_now = int(capture_info.get("step", begin.get("step", 20)))
                        final_scroll = int(capture_info.get("nextScrollTop", final_scroll))
                    loop = asyncio.get_running_loop()
                    future = loop.run_in_executor(pool, encode_screencast_frame, raw_viewport, capture_info, stream_viewport)
                    pending.append((future, step_now))
                except Exception as exc:
                    capture_error = str(exc)
                    break

                # Every acknowledged CDP PNG frame is kept in order. The page advances
                # exactly one scroll step per accepted frame; encoding is lossless/in parallel.
                if not state["stop_event"].is_set():
                    try:
                        await cdp.send("Page.screencastFrameAck", {"sessionId": event["sessionId"]})
                    except Exception as exc:
                        capture_error = str(exc)
                        break

                if len(pending) > 1 and not await write_oldest(archive):
                    break

                now = time.perf_counter()
                if now - last_ui_update >= 0.5:
                    elapsed = max(.001, now - (capture_start_time or now))
                    try:
                        await page.evaluate("info => window.__mvDirectCapture.update(info)", {
                            "frames": frames, "bytes": total_bytes, "fps": frames / elapsed,
                        })
                    except Exception:
                        pass
                    last_ui_update = now

                if state["stop_event"].is_set():
                    break

            if stream_started:
                try:
                    await cdp.send("Page.stopScreencast")
                except Exception:
                    pass
                stream_started = False

            capture_end_time = time.perf_counter()
            while pending and not budget_reached and not encode_failed:
                if not await write_oldest(archive):
                    break

            elapsed = max(.001, (capture_end_time or time.perf_counter()) - (capture_start_time or helper_start_time))
            readme = make_readme(
                frames=frames, total_bytes=total_bytes, sizes=sizes, source_sizes=source_sizes,
                cropped_any=cropped_any, resized_any=resized_any,
                start_scroll=start_scroll, first_scroll=first_scroll, end_scroll=final_scroll,
                step_values=step_values, elapsed=elapsed, refresh_rate=refresh_rate,
                frame_stride=frame_stride, budget_reached=budget_reached, error=capture_error,
            )
            if frames:
                archive.writestr("README.txt", readme, compress_type=ZIP_STORED)

        if frames:
            if part_path.stat().st_size > MAX_ARCHIVE_BYTES:
                part_path.unlink(missing_ok=True)
                raise RuntimeError("ZIPアーカイブが500,000,000 byte上限を超えたため保存を中止しました")
            os.replace(part_path, final_path)
            info = {"frames": frames, "bytes": total_bytes, "budgetReached": budget_reached, "path": final_path.name}
            await page.evaluate("info => window.__mvDirectCapture.finish(info)", info)
            print(f"保存しました: {final_path} ({frames} PNG, ZIP {final_path.stat().st_size/1e6:.2f} MB)")
        else:
            part_path.unlink(missing_ok=True)
            await page.evaluate("info => window.__mvDirectCapture.finish(info)", {
                "frames": 0, "bytes": 0, "error": capture_error or "保存できるPNGがありません",
            })
            print("保存できるPNGがありませんでした。")
    except Exception as exc:
        capture_error = str(exc)
        try:
            if frames and part_path.exists():
                with ZipFile(part_path, "r") as check:
                    if check.testzip() is None and part_path.stat().st_size <= MAX_ARCHIVE_BYTES:
                        os.replace(part_path, final_path)
                    else:
                        part_path.unlink(missing_ok=True)
            else:
                part_path.unlink(missing_ok=True)
        except Exception:
            part_path.unlink(missing_ok=True)
        try:
            await page.evaluate("info => window.__mvDirectCapture.finish(info)", {
                "frames": frames, "bytes": total_bytes, "error": capture_error,
            })
        except Exception:
            pass
        print(f"撮影エラー: {capture_error}")
    finally:
        if stream_started:
            try:
                await cdp.send("Page.stopScreencast")
            except Exception:
                pass
        pool.shutdown(wait=True, cancel_futures=True)
        try:
            await cdp.detach()
        except Exception:
            pass
        state["busy"] = False
        state["stop_event"].clear()


async def run_browser(args: argparse.Namespace, url: str, out_dir: Path) -> int:
    state: dict[str, Any] = {
        "busy": False,
        "start_event": asyncio.Event(),
        "stop_event": asyncio.Event(),
    }
    browser = None
    try:
        async with async_playwright() as playwright:
            if args.browser == "chrome":
                browser = await playwright.chromium.launch(channel="chrome", headless=False)
            else:
                browser = await playwright.chromium.launch(headless=False)
            context = await browser.new_context(
                viewport={"width": args.width, "height": args.height},
                device_scale_factor=1,
                accept_downloads=False,
            )
            page = await context.new_page()
            page.set_default_timeout(30_000)
            page.on("pageerror", lambda exc: print(f"ページエラー: {exc}"))

            async def on_start(options: dict[str, Any]) -> dict[str, Any]:
                if state["busy"]:
                    return {"accepted": False, "error": "すでに録画中です"}
                state["busy"] = True
                state["stop_event"].clear()
                state["start_event"].set()
                return {"accepted": True}

            async def on_stop() -> dict[str, bool]:
                state["stop_event"].set()
                return {"accepted": True}

            await page.expose_function("__mvHostStart", on_start)
            await page.expose_function("__mvHostStop", on_stop)
            print(f"Chromeでページを開きます: {url}")
            await page.goto(url, wait_until="domcontentloaded")
            await page.wait_for_selector("#c60", state="visible")
            await page.evaluate("() => document.fonts.ready")
            await page.wait_for_timeout(800)
            print("ブラウザー内で開始位置までスクロールし、ページ内の『録画開始』を押してください。")
            print("停止はページ内ボタン / Esc。通常版DDBBS.htmlには触れません。")

            while not page.is_closed():
                try:
                    await asyncio.wait_for(state["start_event"].wait(), timeout=0.1)
                except asyncio.TimeoutError:
                    continue
                state["start_event"].clear()
                if state["stop_event"].is_set():
                    state["busy"] = False
                    state["stop_event"].clear()
                    continue
                try:
                    await record(page, state, out_dir, OUTPUT_FPS)
                except Exception as exc:
                    state["busy"] = False
                    try:
                        await page.evaluate("info => window.__mvDirectCapture.finish(info)", {
                            "frames": 0, "bytes": 0, "error": str(exc),
                        })
                    except Exception:
                        pass
                    print(f"録画を開始できませんでした: {exc}")
        return 0
    except KeyboardInterrupt:
        print("終了します。")
        return 0
    except Exception as exc:
        print(f"起動エラー: {exc}")
        print("Chromeが未インストールの場合はChromeをインストールしてください。Playwright同梱Chromiumを使う場合は --browser chromium を指定します。")
        return 1
    finally:
        if browser is not None:
            try:
                await browser.close()
            except Exception:
                pass


def main() -> int:
    parser = argparse.ArgumentParser(description="DDBBS MV Build07 直接スクリーンショット補助処理")
    parser.add_argument("--url", help="html/DDBBS_MV.html のHTTPS/localhost URL")
    parser.add_argument("--site-root", help="html/DDBBS_MV.html と image/ を含むサイトフォルダー")
    parser.add_argument("--output-dir", help="ZIP保存先（初期値: Downloads）")
    parser.add_argument("--browser", choices=("chrome", "chromium"), default="chrome", help="インストール済みChrome、またはPlaywright Chromium")
    parser.add_argument("--width", type=int, default=1334, help="ブラウザー表示領域の幅（初期値1334）")
    parser.add_argument("--height", type=int, default=800, help="ブラウザー表示領域の高さ（初期値800）")
    args = parser.parse_args()
    if args.width < 640 or args.height < 480:
        print("Viewportの指定が範囲外です。")
        return 2

    server: ThreadingHTTPServer | None = None
    try:
        url, server = resolve_target(args)
        out_dir = Path(args.output_dir).expanduser() if args.output_dir else (Path.home() / "Downloads")
        out_dir.mkdir(parents=True, exist_ok=True)
        return asyncio.run(run_browser(args, url, out_dir.resolve()))
    except KeyboardInterrupt:
        print("終了します。")
        return 0
    except Exception as exc:
        print(f"起動エラー: {exc}")
        return 1
    finally:
        if server is not None:
            server.shutdown()
            server.server_close()


if __name__ == "__main__":
    raise SystemExit(main())
