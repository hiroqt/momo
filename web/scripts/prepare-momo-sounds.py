"""Build five short cartoon reactions from the project's CC0 monkey recordings.

Run with ``python3 web/scripts/prepare-momo-sounds.py`` (requires ffmpeg).
The source pack is by AntumDeluge and is distributed under CC0 1.0.
"""
from pathlib import Path
import subprocess

web = Path(__file__).resolve().parents[1]
sources = web / 'assets' / 'sounds'
sounds = web / 'public' / 'sounds'

# Each profile has its own source, crop, pitch, tempo, and tonal character.
# They stay under a second so repeated page clicks remain playful.
profiles = [
    ('monkey-1.ogg', 'momo-monkey-giggle', 0.00, 0.78, 1.16, 1.08, 950),
    ('monkey-2.ogg', 'momo-monkey-chatter', 0.00, 0.86, 1.08, 1.12, 1250),
    ('monkey-3.ogg', 'momo-monkey-hoot', 0.04, 0.92, 0.94, 1.05, 700),
    ('monkey-1.ogg', 'momo-monkey-squeak', 0.20, 0.72, 1.34, 1.15, 1650),
    ('monkey-3.ogg', 'momo-monkey-laugh', 0.22, 1.08, 1.13, 1.10, 1050),
]

for source, name, start, end, pitch, tempo, presence in profiles:
    filters = ','.join([
        f'atrim=start={start}:end={end}',
        'asetpts=PTS-STARTPTS',
        f'asetrate=44100*{pitch}',
        'aresample=44100',
        f'atempo={tempo}',
        'highpass=f=150',
        'lowpass=f=7600',
        f'equalizer=f={presence}:t=q:w=1:g=3',
        'acompressor=threshold=-20dB:ratio=2.5:attack=5:release=60',
        'loudnorm=I=-18:TP=-2.5:LRA=5',
        'afade=t=in:d=0.01',
        'areverse',
        'afade=t=in:d=0.045',
        'areverse',
    ])
    subprocess.run([
        'ffmpeg', '-hide_banner', '-loglevel', 'error', '-y',
        '-i', str(sources / source), '-af', filters,
        '-ar', '44100', '-ac', '1', '-b:a', '128k',
        str(sounds / f'{name}.mp3'),
    ], check=True)
