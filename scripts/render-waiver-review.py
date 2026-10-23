"""Render the server-generated waiver JSON as an unsigned one-page review PDF."""
import json, sys
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor, white
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from xml.sax.saxutils import escape
pdfmetrics.registerFont(TTFont('Body','/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
pdfmetrics.registerFont(TTFont('Bold','/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))
d=json.load(open(sys.argv[1]));c=canvas.Canvas(sys.argv[2],pagesize=(612,792))
c.setTitle(d['businessName']+' Participation Waiver - Review Draft');c.setAuthor(d['businessName'])
red=HexColor(d['colors']['button']);black=HexColor('#000000')
c.setFillColor(black);c.rect(0,699,612,93,fill=1,stroke=0);c.setFillColor(red);c.rect(0,693,612,6,fill=1,stroke=0)
c.setFillColor(white);c.setFont('Bold',23);c.drawString(38,754,d['businessName'].upper());c.setFont('Body',15);c.drawString(38,726,'Participation Waiver')
c.setFillColor(red);c.setFont('Bold',8.7);c.drawString(38,675,'REVIEW DRAFT - LEGAL APPROVAL REQUIRED BEFORE USE')
c.setFillColor(black);c.setFont('Body',8);c.drawString(38,660,'Facility activities | Indoor/outdoor training | Camps | Parties | Indoor soccer & pick-up')
y=638
for number,(title,body) in enumerate(d['sections'],1):
 c.setFillColor(red);c.setFont('Bold',9.5);c.drawString(38,y,str(number)+'. '+title);y-=5
 para=Paragraph(escape(body),ParagraphStyle('body',fontName='Body',fontSize=9,leading=11.5,textColor=black));_,h=para.wrap(536,700);para.drawOn(c,38,y-h);y-=h+14

def field(name,label,x,y,width):
 c.setFillColor(black);c.setFont('Body',7.5);c.drawString(x,y+24,label)
 c.acroForm.textfield(name=name,tooltip=label,x=x,y=y,width=width,height=20,fontName='Helvetica',fontSize=10,borderWidth=.6,borderColor=HexColor('#AAAAAA'),fillColor=white,textColor=black,forceBorder=True)
field('participant','Participant full name',38,y-25,320);field('client_id','Business client ID',374,y-25,200)
field('dob','Participant date of birth (YYYY-MM-DD)',38,y-69,245);field('date','Signing date (YYYY-MM-DD)',300,y-69,274)
field('signature','Adult participant OR parent/legal guardian electronic signature (type full name)',38,y-113,536)
c.setFont('Body',7.5);c.drawString(38,y-128,'Signer role:')
for x,key,label in [(95,'self','Adult participant'),(239,'parent','Parent'),(341,'guardian','Legal guardian')]:
 c.acroForm.checkbox(name=key,x=x,y=y-132,size=11,buttonStyle='check',borderWidth=.6);c.drawString(x+16,y-129,label)
c.setFont('Body',7.5);c.drawString(38,y-147,'Typing my name is intended as my electronic signature. A parent/legal guardian signs for a minor.')
c.setStrokeColor(red);c.line(38,36,574,36);c.setFont('Body',7);c.drawString(38,24,'Version '+d['version']+' | Unsigned review copy. Production signing retains timestamp and audit evidence.')
assert y-147>40, 'Signature fields exceed page'
c.showPage();c.save()
from pypdf import PdfReader
r=PdfReader(sys.argv[2]);assert len(r.pages)==1;assert len(r.get_fields())==8;assert 'SelahFlow' not in r.pages[0].extract_text()
print('Verified: one page; eight interactive fields; no SelahFlow branding')
