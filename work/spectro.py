# A spectrogram of a WAV as a PNG (log magnitude, 0-12 kHz), with one-second ticks.
#   python work/spectro.py <in.wav> <out.png>
import sys
import numpy as np
from scipy.io import wavfile
from scipy.signal import spectrogram
from PIL import Image, ImageDraw

sr, x = wavfile.read(sys.argv[1])
x = x.astype(np.float32) / 32768.0
if x.ndim > 1:
    x = x.mean(axis=1)
f, t, S = spectrogram(x, fs=sr, nperseg=1024, noverlap=768)
keep = f <= 12000
S = 10 * np.log10(S[keep] + 1e-12)
S = np.clip((S - (S.max() - 80)) / 80, 0, 1)
img = (255 * S[::-1]).astype(np.uint8)
im = Image.fromarray(img).resize((min(2400, img.shape[1] * 2), 400))
im = im.convert('RGB')
d = ImageDraw.Draw(im)
dur = len(x) / sr
for s in range(int(dur) + 1):
    X = int(s / dur * im.width)
    d.line([(X, 390), (X, 400)], fill=(255, 80, 80))
    d.text((X + 2, 380), str(s), fill=(255, 80, 80))
for k in range(0, 13, 2):
    Y = int(im.height * (1 - k / 12))
    d.text((2, max(0, Y - 12)), f'{k}k', fill=(80, 255, 80))
im.save(sys.argv[2])
print('saved', sys.argv[2], f'{dur:.1f}s')
