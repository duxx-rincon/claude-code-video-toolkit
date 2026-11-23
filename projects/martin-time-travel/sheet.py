import sys
from PIL import Image, ImageDraw
out=sys.argv[1]; files=sys.argv[2:]; cols=min(4,len(files)); rows=(len(files)+cols-1)//cols
w,h=360,640; S=Image.new('RGB',(cols*w,rows*h),'black'); d=ImageDraw.Draw(S)
for i,f in enumerate(files):
    im=Image.open(f).resize((w,h)); S.paste(im,((i%cols)*w,(i//cols)*h)); d.text(((i%cols)*w+6,(i//cols)*h+4),f.split('/')[-1],fill='yellow')
S.save(out,quality=88)
