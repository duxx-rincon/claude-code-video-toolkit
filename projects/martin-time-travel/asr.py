import sys, subprocess
from pocketsphinx import Decoder
f = sys.argv[1]
raw = subprocess.run(["ffmpeg","-v","error","-i",f,"-ac","1","-ar","16000","-f","s16le","-"],capture_output=True,check=True).stdout
d = Decoder(samprate=16000)
d.start_utt(); d.process_raw(raw, full_utt=True); d.end_utt()
for s in d.seg():
    if s.word.startswith('<') or s.word.startswith('['): continue
    print(f"{s.start_frame/100:6.2f}-{s.end_frame/100:6.2f} {s.word}")
