from pathlib import Path
import re
import time
from playwright.sync_api import sync_playwright

import os

APP_URL = os.environ.get("APP_URL", "http://127.0.0.1:5173")
OUT_DIR = Path(".omx")
OUT_DIR.mkdir(exist_ok=True)


def main():
    results = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 950})
        page.goto(APP_URL, wait_until="networkidle")
        reset_browser_state(page)
        results.append(run_case("demo-realtime-captions", lambda: run_demo(page)))
        page.close()

        page = browser.new_page(viewport={"width": 1440, "height": 950}, accept_downloads=True)
        page.goto(APP_URL, wait_until="networkidle")
        reset_browser_state(page)
        results.append(run_case("manual-correction-export", lambda: run_manual_correction_export(page)))
        page.close()

        page = browser.new_page(viewport={"width": 1440, "height": 950})
        install_tts_mock(page)
        page.goto(APP_URL, wait_until="networkidle")
        reset_browser_state(page)
        results.append(run_case("demo-voice-output", lambda: run_demo_voice_output(page)))
        page.close()

        for label, media_path in [
            ("audio-file", "test-media/sample-live-chunk.wav"),
            ("adaptive-audio-file", "test-media/sample-english-speech.wav"),
            ("video-file", "test-media/sample-english-video.mp4"),
        ]:
            page = browser.new_page(viewport={"width": 1440, "height": 950})
            page.goto(APP_URL, wait_until="networkidle")
            reset_browser_state(page)
            results.append(run_case(f"{label}-interpretation", lambda page=page, label=label, media_path=media_path: run_file(page, label, media_path)))
            page.close()

        page = browser.new_page(viewport={"width": 1440, "height": 950})
        page.goto(APP_URL, wait_until="networkidle")
        reset_browser_state(page)
        results.append(run_case("live-sample-stream", lambda: run_live_sample(page)))
        page.close()

        page = browser.new_page(viewport={"width": 1440, "height": 950})
        page.goto(APP_URL, wait_until="networkidle")
        reset_browser_state(page)
        results.append(run_case("live-overlay-sync", lambda: run_live_overlay_sync(page)))
        page.close()

        page = browser.new_page(viewport={"width": 1440, "height": 950})
        page.goto(APP_URL, wait_until="networkidle")
        reset_browser_state(page)
        results.append(run_case("fast-live-sample-stream", lambda: run_fast_live_sample(page)))
        page.close()

        page = browser.new_page(viewport={"width": 1440, "height": 950})
        page.goto(APP_URL, wait_until="networkidle")
        reset_browser_state(page)
        results.append(run_case("diagnostic-interim-compact", lambda: run_diagnostic_interim_compact(page)))
        page.close()

        page = browser.new_page(viewport={"width": 1440, "height": 950})
        page.goto(APP_URL, wait_until="networkidle")
        reset_browser_state(page)
        results.append(run_case("live-stop-final-flush", lambda: run_live_stop_final_flush(page)))
        page.close()

        page = browser.new_page(viewport={"width": 1440, "height": 950})
        page.goto(APP_URL, wait_until="networkidle")
        reset_browser_state(page)
        results.append(run_case("live-silent-stream", lambda: run_silent_live_sample(page)))
        page.close()
        browser.close()

    for result in results:
        print(f"{result['status'].upper()} {result['name']} {result['detail']}")

    if any(result["status"] != "pass" for result in results):
        raise SystemExit(1)


def run_demo(page):
    page.locator("button.run-button").click()
    wait_for_stable_chinese_caption(page, timeout_ms=12000)
    wait_for_semantic_translation(page, ["全球", "产品", "发布"], timeout_ms=16000)
    page.screenshot(path=str(OUT_DIR / "ux-demo.png"), full_page=True)
    text = page.locator(".subtitle-scroll").inner_text(timeout=5000)
    control = page.locator(".quality-strip").inner_text(timeout=5000)
    return pass_result(
        "demo-realtime-captions",
        f"cards={page.locator('.subtitle-card').count()} control={compact(control)} sample={compact(text[:180])}",
    )


def run_manual_correction_export(page):
    corrected_text = "大家早上好，欢迎参加我们的全球 AI 产品发布会。（人工修正验收）"
    page.locator("button.run-button").click()
    wait_for_stable_chinese_caption(page, timeout_ms=12000)
    stable_cards = page.locator(".subtitle-card:not(.interim):not(.empty-state)")
    if stable_cards.count() == 0:
        raise AssertionError("No stable caption card available for manual correction.")
    stable_cards.nth(0).click()
    editor = page.locator("textarea[aria-label='Corrected Chinese subtitle']")
    editor.wait_for(state="visible", timeout=5000)
    editor.fill(corrected_text)
    page.locator(".correction-editor button").nth(0).click()
    page.wait_for_function(
        """(expected) => {
          const stats = document.querySelector('.stats-bar')?.textContent || '';
          const manualCard = Array.from(document.querySelectorAll('.subtitle-card.manual'))
            .some((node) => (node.textContent || '').includes(expected) && (node.textContent || '').includes('用户修正'));
          const saved = (document.body.textContent || '').includes('已保存到人工确认记忆');
          return saved && manualCard && /修正\\s*1|Corrections\\s*1/.test(stats);
        }""",
        arg=corrected_text,
        timeout=8000,
    )
    with page.expect_download(timeout=10000) as download_info:
        page.locator(".top-actions button").nth(2).click()
    download = download_info.value
    export_path = OUT_DIR / "ux-manual-correction.srt"
    download.save_as(str(export_path))
    exported = export_path.read_text(encoding="utf-8")
    if corrected_text not in exported:
        raise AssertionError(f"Corrected subtitle missing from exported SRT: {compact(exported[:500])}")
    page.screenshot(path=str(OUT_DIR / "ux-manual-correction-export.png"), full_page=True)
    return pass_result(
        "manual-correction-export",
        f"correction_count=1 export={export_path} corrected={corrected_text}",
    )


def run_demo_voice_output(page):
    page.evaluate("""() => {
      window.__ttsSpoken = [];
      window.__SIMULCAST_TEST__?.resetTTSStats?.();
    }""")
    page.locator(".top-actions button").nth(0).click()
    page.locator("label", has_text="Chinese voice output").locator("input").check()
    page.locator(".settings-modal header button").click()
    page.locator("button.run-button").click()
    wait_for_stable_chinese_caption(page, timeout_ms=12000)
    page.wait_for_function(
        """() => {
          const stats = window.__SIMULCAST_TEST__?.getTTSStats?.();
          const spoken = window.__ttsSpoken || [];
          return stats?.queued >= 1 && stats?.spoken >= 1
            && spoken.some((item) => /[\\u4e00-\\u9fff]/.test(item.text) && item.lang.startsWith('zh'));
        }""",
        timeout=12000,
    )
    stats = page.evaluate("""() => window.__SIMULCAST_TEST__?.getTTSStats?.()""")
    spoken = page.evaluate("""() => window.__ttsSpoken || []""")
    page.screenshot(path=str(OUT_DIR / "ux-demo-voice-output.png"), full_page=True)
    return pass_result(
        "demo-voice-output",
        f"tts={stats} spoken={compact(str(spoken[:2]))}",
    )


def reset_browser_state(page):
    page.evaluate("""() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    }""")
    page.reload(wait_until="networkidle")


def install_tts_mock(page):
    page.add_init_script("""(() => {
      Object.defineProperty(window, '__ttsSpoken', {
        value: [],
        writable: true,
        configurable: true,
      });
      Object.defineProperty(window, 'SpeechSynthesisUtterance', {
        configurable: true,
        value: class {
          constructor(text) {
            this.text = text;
            this.lang = '';
            this.rate = 1;
            this.pitch = 1;
            this.voice = null;
            this.onend = null;
            this.onerror = null;
          }
        },
      });
      Object.defineProperty(window, 'speechSynthesis', {
        configurable: true,
        value: {
          speaking: false,
          getVoices: () => [{ name: 'Test zh voice', lang: 'zh-CN' }],
          speak: (utterance) => {
            window.__ttsSpoken.push({
              text: utterance.text,
              lang: utterance.lang,
              rate: utterance.rate,
            });
            window.setTimeout(() => utterance.onend?.(), 0);
          },
          cancel: () => {},
          pause: () => {},
          resume: () => {},
        },
      });
    })();""")


def run_file(page, label, media_path):
    page.locator(".segmented button").nth(2).click()
    page.locator("input[type=file]").set_input_files(media_path)
    page.locator("button.run-button").click()
    page.wait_for_function(
        """() => (document.querySelector('.file-status')?.textContent || '').includes('真实 ASR 已完成')""",
        timeout=45000,
    )
    wait_for_stable_chinese_caption(page, timeout_ms=45000)
    wait_for_semantic_translation(page, ["SampleLab", "免费", "资源"], timeout_ms=45000)
    assert_no_domain_suffix_fragment(page)
    assert_current_caption_visible(page)
    if label == "adaptive-audio-file":
        assert_file_interpretation_stays_in_sync(page)
    page.screenshot(path=str(OUT_DIR / f"ux-{label}.png"), full_page=True)
    text = page.locator(".subtitle-scroll").inner_text(timeout=5000)
    status = inner_text_or_empty(page, ".file-status")
    assert_quality_feedback(page)
    return pass_result(
        f"{label}-interpretation",
        f"status={compact(status[:120])} sample={compact(text[:220])}",
    )


def run_live_sample(page):
    ok = page.evaluate("""async () => {
      if (!window.__SIMULCAST_TEST__) return false;
      await window.__SIMULCAST_TEST__.startLiveSample();
      return true;
    }""")
    if not ok:
      return fail_result("live-sample-stream", "test live hook unavailable")

    wait_for_stable_chinese_caption(page, timeout_ms=50000)
    wait_for_semantic_translation(page, ["SampleLab", "免费", "资源"], timeout_ms=50000)
    assert_no_domain_suffix_fragment(page)
    page.screenshot(path=str(OUT_DIR / "ux-live-sample.png"), full_page=True)
    text = page.locator(".subtitle-scroll").inner_text(timeout=5000)
    live = page.locator(".live-capture-card").inner_text(timeout=5000)
    if "Injected sample media stream" in live and "测试" not in live and "test" not in live.lower():
        raise AssertionError("Injected live stream is not visibly labelled as test-only.")
    return pass_result(
        "live-sample-stream",
        f"live={compact(live[:180])} sample={compact(text[:220])}",
    )


def run_live_overlay_sync(page):
    page.locator(".top-actions button").nth(1).click()
    ok = page.evaluate("""async () => {
      if (!window.__SIMULCAST_TEST__) return false;
      await window.__SIMULCAST_TEST__.startLiveSample();
      return true;
    }""")
    if not ok:
      return fail_result("live-overlay-sync", "test live hook unavailable")

    wait_for_stable_chinese_caption(page, timeout_ms=50000)
    page.wait_for_function(
        """() => {
          const text = window.__SIMULCAST_TEST__?.getCaptionOverlayText?.() || '';
          return /[\\u4e00-\\u9fff]/.test(text)
            && /SampleLab|Welcome|online resource/.test(text)
            && !/正在理解源语义并重组目标语言|正在低延迟转写|正在等待可同传/.test(text);
        }""",
        timeout=50000,
    )
    overlay_text = page.evaluate("""() => window.__SIMULCAST_TEST__?.getCaptionOverlayText?.() || ''""")
    if not overlay_text:
        raise AssertionError("Caption overlay did not expose synchronized text.")
    page.screenshot(path=str(OUT_DIR / "ux-live-overlay-sync.png"), full_page=True)
    return pass_result("live-overlay-sync", f"overlay={compact(overlay_text[:220])}")


def run_fast_live_sample(page):
    ok = page.evaluate("""async () => {
      if (!window.__SIMULCAST_TEST__?.startFastLiveSample) return false;
      await window.__SIMULCAST_TEST__.startFastLiveSample();
      return true;
    }""")
    if not ok:
      return fail_result("fast-live-sample-stream", "test fast live hook unavailable")

    wait_for_live_speed_feedback(page, timeout_ms=50000)
    assert_no_live_no_audio_mislabel(page)
    page.screenshot(path=str(OUT_DIR / "ux-live-fast-sample.png"), full_page=True)
    live = page.locator(".live-capture-card").inner_text(timeout=5000)
    text = page.locator(".subtitle-scroll").inner_text(timeout=5000)
    return pass_result(
        "fast-live-sample-stream",
        f"live={compact(live[:260])} sample={compact(text[:220])}",
    )


def run_diagnostic_interim_compact(page):
    ok = page.evaluate("""() => {
      if (!window.__SIMULCAST_TEST__?.setFastDiagnosticInterim) return false;
      return window.__SIMULCAST_TEST__.setFastDiagnosticInterim();
    }""")
    if not ok:
      return fail_result("diagnostic-interim-compact", "test diagnostic hook unavailable")

    page.wait_for_selector('[data-diagnostic-interim="true"]', timeout=5000)
    metrics = page.evaluate("""() => {
      const card = document.querySelector('[data-diagnostic-interim="true"]');
      const translated = card?.querySelector('.translated-text');
      const banner = document.querySelector('.subtitle-banner');
      const bannerText = banner?.textContent || '';
      const style = translated ? window.getComputedStyle(translated) : null;
      return {
        cardText: card?.textContent || '',
        bannerText,
        fontSize: style ? Number.parseFloat(style.fontSize) : 0,
        cardHeight: card?.getBoundingClientRect().height || 0,
      };
    }""")
    if "语速过快" not in metrics["cardText"]:
        raise AssertionError(f"Diagnostic interim card missing speed warning: {metrics}")
    if metrics["fontSize"] > 18:
        raise AssertionError(f"Diagnostic interim is rendered like a primary subtitle: {metrics}")
    if metrics["cardHeight"] > 150:
        raise AssertionError(f"Diagnostic interim card is too tall for live tracking: {metrics}")
    if "语速过快" in metrics["bannerText"]:
        raise AssertionError(f"Bottom subtitle banner displayed diagnostic text as target caption: {metrics}")
    page.screenshot(path=str(OUT_DIR / "ux-diagnostic-interim-compact.png"), full_page=True)
    return pass_result(
        "diagnostic-interim-compact",
        f"font={metrics['fontSize']} height={metrics['cardHeight']} banner={compact(metrics['bannerText'][:100])}",
    )


def run_live_stop_final_flush(page):
    ok = page.evaluate("""async () => {
      if (!window.__SIMULCAST_TEST__) return false;
      await window.__SIMULCAST_TEST__.startLiveSample();
      return true;
    }""")
    if not ok:
      return fail_result("live-stop-final-flush", "test live hook unavailable")

    wait_for_stable_chinese_caption(page, timeout_ms=50000)
    before_count = page.locator(".subtitle-card:not(.interim):not(.empty-state)").count()
    page.locator("button.run-button").click()
    page.wait_for_function(
        """() => {
          const live = document.querySelector('.live-capture-card')?.textContent || '';
          return !live.includes('Audio captured') && /已停止|Required|Not selected/.test(live);
        }""",
        timeout=12000,
    )
    page.wait_for_function(
        """(beforeCount) => {
          const stable = document.querySelectorAll('.subtitle-card:not(.interim):not(.empty-state)').length;
          const status = document.querySelector('.file-status')?.textContent || '';
          return stable >= beforeCount || /收尾|已停止/.test(status);
        }""",
        arg=before_count,
        timeout=50000,
    )
    live = page.locator(".live-capture-card").inner_text(timeout=5000)
    if "PERMISSION Audio captured" in live or "Audio captured" in live:
        raise AssertionError(f"Live stop did not release capture state: {compact(live[:600])}")
    page.screenshot(path=str(OUT_DIR / "ux-live-stop-final-flush.png"), full_page=True)
    text = page.locator(".subtitle-scroll").inner_text(timeout=5000)
    return pass_result(
        "live-stop-final-flush",
        f"stable_before={before_count} live={compact(live[:220])} sample={compact(text[:220])}",
    )


def run_silent_live_sample(page):
    ok = page.evaluate("""async () => {
      if (!window.__SIMULCAST_TEST__) return false;
      await window.__SIMULCAST_TEST__.startSilentLiveSample();
      return true;
    }""")
    if not ok:
      return fail_result("live-silent-stream", "test silent live hook unavailable")

    wait_for_silent_live_feedback(page, timeout_ms=22000)
    page.wait_for_timeout(1500)
    stable_count = page.locator(".subtitle-card:not(.interim):not(.empty-state)").count()
    if stable_count:
        text = page.locator(".subtitle-scroll").inner_text(timeout=5000)
        raise AssertionError(f"Silent live stream produced fake stable subtitles: {compact(text[:500])}")
    page.screenshot(path=str(OUT_DIR / "ux-live-silent.png"), full_page=True)
    live = page.locator(".live-capture-card").inner_text(timeout=5000)
    return pass_result("live-silent-stream", f"live={compact(live[:240])}")


def wait_for_stable_chinese_caption(page, timeout_ms):
    page.wait_for_function(
        """() => Array.from(document.querySelectorAll('.subtitle-card:not(.interim):not(.empty-state) .translated-text'))
          .some((node) => /[\\u4e00-\\u9fff]/.test(node.textContent || '')
            && !/[A-Za-z]{20,}/.test((node.textContent || '').replace(/SampleLab|AI/g, '')))""",
        timeout=timeout_ms,
    )
    text = page.locator(".subtitle-scroll").inner_text(timeout=5000)
    if not re.search(r"[\u4e00-\u9fff]", text):
        raise AssertionError("No Chinese interpretation text found.")


def wait_for_semantic_translation(page, required_terms, timeout_ms):
    expression = """(terms) => {
      const text = Array.from(document.querySelectorAll('.subtitle-card:not(.interim):not(.empty-state) .translated-text'))
        .map((node) => node.textContent || '')
        .join(' ');
      return terms.every((term) => text.includes(term));
    }"""
    try:
        page.wait_for_function(expression, arg=required_terms, timeout=timeout_ms)
    except Exception as exc:
        stable_text = page.evaluate("""() => Array.from(document.querySelectorAll('.subtitle-card:not(.interim):not(.empty-state) .translated-text')).map((node) => node.textContent || '').join(' | ')""")
        status = inner_text_or_empty(page, ".file-status") or inner_text_or_empty(page, ".live-capture-card")
        raise AssertionError(
            f"Semantic translation did not contain {required_terms}. "
            f"stable_text={compact(stable_text[:800])} status={compact(status[:500])}"
        ) from exc


def assert_quality_feedback(page):
    control = page.locator(".quality-strip").inner_text(timeout=5000)
    if "同传质量" not in control and "Quality feedback" not in control:
        raise AssertionError("Missing user-facing quality feedback.")
    if "Clear" in control:
        raise AssertionError("Quality feedback must not claim Clear accuracy.")


def wait_for_silent_live_feedback(page, timeout_ms):
    deadline = time.monotonic() + timeout_ms / 1000
    last_live = ""
    while time.monotonic() < deadline:
        last_live = inner_text_or_empty(page, ".live-capture-card")
        if "No audible input" in last_live and "\u97f3\u91cf" in last_live:
            return
        page.wait_for_timeout(500)
    raise AssertionError(f"Silent live stream did not show no-audio feedback: {compact(last_live[:800])}")


def wait_for_live_speed_feedback(page, timeout_ms):
    deadline = time.monotonic() + timeout_ms / 1000
    last_live = ""
    while time.monotonic() < deadline:
        last_live = inner_text_or_empty(page, ".live-capture-card")
        workspace = inner_text_or_empty(page, ".right-panel")
        text = f"{last_live}\n{workspace}"
        if re.search(r"语速(过快|偏快)|Speech overload|Fast speech|ASR 不稳定|ASR unstable|未稳定捕获", text):
            return
        page.wait_for_timeout(500)
    raise AssertionError(f"Fast live stream did not show speed/overload feedback: {compact(last_live[:800])}")


def assert_no_live_no_audio_mislabel(page):
    text = "\n".join([
        inner_text_or_empty(page, ".live-capture-card"),
        inner_text_or_empty(page, ".subtitle-scroll"),
        inner_text_or_empty(page, ".quality-strip"),
    ])
    if re.search(r"没有实际音量|未检测到实际音量|No audible input|过短或静音", text):
        raise AssertionError(f"Fast audible live stream was mislabeled as no-audio: {compact(text[:800])}")


def assert_current_caption_visible(page):
    current = page.locator('[data-current-subtitle="true"]').first
    current.wait_for(state="visible", timeout=5000)
    box = current.bounding_box()
    viewport = page.viewport_size or {"height": 950}
    if not box or box["y"] < 0 or box["y"] > viewport["height"] - 80:
        raise AssertionError(f"Current subtitle is not visible in viewport: {box}")


def assert_file_interpretation_stays_in_sync(page):
    media_state = page.evaluate("""() => {
      const media = document.querySelector('audio, video');
      return {
        currentTime: media?.currentTime || 0,
        duration: Number.isFinite(media?.duration) ? media.duration : 0,
        ended: Boolean(media?.ended),
      };
    }""")
    status = inner_text_or_empty(page, ".file-status")
    duration = float(media_state["duration"] or 0)
    checkpoint = max(3.0, duration * 0.4)
    if duration > 8 and media_state["currentTime"] < checkpoint and not media_state["ended"] and "闭环完成" in status:
        raise AssertionError(
            "File interpretation ended before adaptive media checkpoint: "
            f"t={media_state['currentTime']:.1f}s duration={duration:.1f}s checkpoint={checkpoint:.1f}s status={status}"
        )
    if duration > 8 and media_state["currentTime"] < checkpoint:
        page.wait_for_timeout(2500)
        next_state = page.evaluate("""() => {
          const media = document.querySelector('audio, video');
          return {
            currentTime: media?.currentTime || 0,
            duration: Number.isFinite(media?.duration) ? media.duration : 0,
            ended: Boolean(media?.ended),
          };
        }""")
        next_status = inner_text_or_empty(page, ".file-status")
        if next_state["currentTime"] < checkpoint and not next_state["ended"] and "闭环完成" in next_status:
            raise AssertionError(
                "File interpretation ended while media was still before adaptive checkpoint: "
                f"t={next_state['currentTime']:.1f}s duration={duration:.1f}s checkpoint={checkpoint:.1f}s status={next_status}"
            )
        if next_state["currentTime"] <= media_state["currentTime"] and not next_state["ended"]:
            raise AssertionError(
                "Media playback did not advance during adaptive sync check: "
                f"before={media_state['currentTime']:.1f}s after={next_state['currentTime']:.1f}s duration={duration:.1f}s"
            )


def assert_no_domain_suffix_fragment(page):
    text = page.evaluate("""() => Array.from(document.querySelectorAll('.subtitle-card:not(.interim):not(.empty-state)'))
      .map((node) => node.textContent || '')
      .join('\\n')""")
    if re.search(r"(?im)^\\s*(?:00:\\d\\d:\\d\\d\\s*)?(?:dot\\s+com|\\.com)[,，\\s]", text):
        raise AssertionError(f"ASR domain suffix fragment leaked into stable subtitles: {compact(text[:500])}")
    if "..com" in text:
        raise AssertionError(f"Malformed double-dot domain leaked into stable subtitles: {compact(text[:500])}")
    if "SampleLab.com" not in text:
        raise AssertionError(f"Expected repaired SampleLab.com in stable subtitles: {compact(text[:500])}")
    if re.search(r"(?i)free\\s+online\\s+re\\b", text):
        raise AssertionError(f"Truncated online resource phrase leaked into stable subtitles: {compact(text[:500])}")
    if re.search(r"(?i)code\\s+function|screen\\s+\\d+|\\bshit\\b|\\bi['’]?m\\s+sorry\\b|\\bthank\\s+you\\b|user\\s+language|emotion\\s+angry|<\\s*asr_text\\s*>|代码函数|该死|抱歉|谢谢", text):
        raise AssertionError(f"Instruction/code/noise artifact leaked into stable subtitles: {compact(text[:500])}")


def inner_text_or_empty(page, selector):
    locator = page.locator(selector)
    if locator.count() == 0:
        return ""
    return locator.last.inner_text(timeout=5000)


def compact(text):
    return re.sub(r"\s+", " ", text).strip()


def run_case(name, callback):
    try:
        result = callback()
        result["name"] = name
        return result
    except Exception as exc:
        return fail_result(name, str(exc))


def pass_result(name, detail):
    return {"name": name, "status": "pass", "detail": detail}


def fail_result(name, detail):
    return {"name": name, "status": "fail", "detail": detail}


if __name__ == "__main__":
    main()
