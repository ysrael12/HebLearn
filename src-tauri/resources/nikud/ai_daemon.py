import base64
import io
import json
import sys
import wave

sys.stdin.reconfigure(encoding="ascii")
sys.stdout.reconfigure(encoding="ascii")

TTS_MODEL = sys.argv[1] if len(sys.argv) > 1 else ""

_nakdimon = None
_voice = None


def b64e(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")


def strip_niqqud(text: str) -> str:
    """Remove marcas de vogal/hebraico (niqqud + cantilação) da entrada.

    O nakdimon rejeita texto já pontuado (assertion em `iterate_dotted_text`).
    """
    return "".join(ch for ch in text if not (0x0591 <= ord(ch) <= 0x05C7))


def do_nikud(text: str) -> bytes:
    global _nakdimon
    if _nakdimon is None:
        import nakdimon

        _nakdimon = nakdimon
    return _nakdimon.diacritize(strip_niqqud(text)).encode("utf-8")


def do_tts(text: str) -> bytes:
    global _voice
    if _voice is None:
        import piper

        _voice = piper.PiperVoice.load(TTS_MODEL)
    from piper.config import SynthesisConfig

    # length_scale > 1 deixa a fala mais lenta (config da voz é 1.0).
    # 1.5 ≈ 1.5x a duração — ritmo confortável para aprendizagem.
    syn_cfg = SynthesisConfig(length_scale=1.5)
    buf = io.BytesIO()
    wf = wave.open(buf, "wb")
    _voice.synthesize_wav(text, wf, syn_cfg)
    wf.close()
    return buf.getvalue()


for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    if line == "PING":
        sys.stdout.write("PONG\n")
        sys.stdout.flush()
        continue
    try:
        req = json.loads(line)
        text = base64.b64decode(req["text"]).decode("utf-8")
        op = req["op"]
        if op == "nikud":
            data = do_nikud(text)
        elif op == "tts":
            data = do_tts(text)
        else:
            raise ValueError("operação desconhecida: %r" % op)
        sys.stdout.write(json.dumps({"ok": True, "data": b64e(data)}) + "\n")
    except Exception as e:  # noqa: BLE001
        import traceback

        detail = traceback.format_exc()
        sys.stdout.write(
            json.dumps({"ok": False, "error": b64e(detail.encode("utf-8"))}) + "\n"
        )
    sys.stdout.flush()
