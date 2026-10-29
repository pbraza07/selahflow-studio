"""Rebuild the source-verified owner PDF. Run from repository root (reportlab required)."""
from pathlib import Path
import sys
from PIL import Image
from xml.sax.saxutils import escape
from reportlab.pdfgen.canvas import Canvas
from reportlab.lib.colors import HexColor, white
from reportlab.lib.utils import ImageReader
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
ROOT=Path(__file__).resolve().parents[1]
STAGING='--staging' in sys.argv
OUT=ROOT/('public/guides/selahflow-business-owner-guide-staging.pdf' if STAGING else 'public/guides/selahflow-business-owner-guide.pdf')
ORIGIN='https://selahflow-staging.onrender.com' if STAGING else 'https://selahflow.onrender.com'
OUT.parent.mkdir(parents=True,exist_ok=True)
for name,file in [('Body','DejaVuSans.ttf'),('Bold','DejaVuSans-Bold.ttf')]:
 pdfmetrics.registerFont(TTFont(name,'/usr/share/fonts/truetype/dejavu/'+file))
pdfmetrics.registerFontFamily('Body',normal='Body',bold='Bold',italic='Body',boldItalic='Bold')
W,H=612,792; GREEN=HexColor('#123F3A'); INK=HexColor('#223C36'); MUTED=HexColor('#64736B'); PAPER=HexColor('#F7F4EC'); GOLD=HexColor('#CFAF63')
c=Canvas(str(OUT),pagesize=(W,H));c.setTitle('SelahFlow | Business Owner Guide');c.setAuthor('SelahFlow')
body=ParagraphStyle('body',fontName='Body',fontSize=10.4,leading=16,textColor=INK)
small=ParagraphStyle('small',parent=body,fontSize=9,leading=13,textColor=MUTED)
y=0;page=0

def p(text,style=body,width=512,x=50):
 global y
 q=Paragraph(text,style);_,h=q.wrap(width,700)
 if y-h<72:raise ValueError(f'Page {page} overflows: {text[:60]} y={y} h={h}')
 q.drawOn(c,x,y-h);y-=h+10

def start(n,title,subtitle):
 global y,page
 if page:c.showPage()
 page+=1;c.setFillColor(PAPER);c.rect(0,0,W,H,fill=1,stroke=0)
 c.bookmarkPage('p'+str(page));c.addOutlineEntry(title,'p'+str(page),0,False)
 c.setFillColor(GREEN);c.rect(0,H-109,W,109,fill=1,stroke=0)
 c.setFont('Bold',11);c.setFillColor(GOLD);c.drawString(50,H-32,'SELAHFLOW  /  BUSINESS OWNER GUIDE')
 c.setFillColor(white);c.setFont('Bold',23);c.drawString(50,H-65,title)
 c.setFont('Body',9);c.drawString(50,H-88,subtitle)
 c.setFillColor(GREEN);c.roundRect(50,27,180,26,7,fill=1,stroke=0)
 c.setFillColor(white);c.setFont('Bold',8);c.drawCentredString(140,36,'<  Back to owner dashboard')
 c.linkURL(ORIGIN+'/studio/owner',(50,27,230,53),relative=0,thickness=0)
 c.setFillColor(MUTED);c.setFont('Body',8);c.drawRightString(W-50,38,f'Owner guide  |  v1.3.180  |  {page}')
 if page>1:
  c.drawString(250,38,'Contents');c.linkRect('', 'p1',(246,27,300,53),thickness=0)
 y=H-137

def h(text):
 global y
 y-=5;p(text,ParagraphStyle('h',parent=body,fontName='Bold',fontSize=14,leading=19,textColor=GREEN))
def steps(items):
 for i,t in enumerate(items,1):p(f'<b>{i}.</b>  '+t)
def note(title,text):
 p('<b>'+title+'</b>  '+text,ParagraphStyle('note',parent=body,fontSize=9.5,leading=15,textColor=GREEN))
def shot(path,caption,maxh=230):
 global y
 im=Image.open(ROOT/path)
 if 'services-location' in str(path):im=im.crop((110,0,735,255))
 if 'team-email' in str(path):im=im.crop((445,270,920,490))
 img=ImageReader(im);iw,ih=img.getSize();scale=min(512/iw,maxh/ih);w,ht=iw*scale,ih*scale
 if y-ht<90:raise ValueError('Screenshot overflow')
 c.drawImage(img,50,y-ht,width=w,height=ht,mask='auto');y-=ht+8;p(caption,small)

start(0,'Your business, step by step','Simple how-tos  |  October 29, 2026  |  Follow this order for a new business')
p('Set up once. Then use Schedule and Dashboard for your daily work. Select any topic below to jump directly to its instructions.')
topics=[('01  Business details & finding your way',2),('02  Add services and prices',3),('03  Add team members & team logins',4),('04  Booking rules, questions & waivers',5),('05  Payment methods & commissions',6),('06  Create bookable sessions',7),('07  Create memberships & enroll clients',8),('08  Appointments, time off & attendance',9),('09  Customize your page & share links',10),('10  Clients, communications & notifications',11),('11  Payments, reports & account security',12),('12  Go-live checklist & quick fixes',13)]
for title,target in topics:
 yy=y;p(title);c.linkRect('', 'p'+str(target),(50,y+4,562,yy+2),thickness=0)
h('Three terms to know')
p('<b>Service:</b> what you sell, its price and duration.<br/><b>Bookable session:</b> a published date/time with seats clients can reserve.<br/><b>Appointment:</b> one client’s booking, either inside a session or at an available service time.')
note('Save as you go.','Business settings changes generally need <b>Save business settings</b>. Other tools have their own Save buttons. Wait for the success message before leaving.')
p('On mobile, open the menu first. The in-app guide has a Back to dashboard button; the PDF’s back button opens your signed-in production workspace (or asks you to sign in). Screens shown are cropped public interface references; no private client records are included.',small)

start(1,'01  Business details','Start here  /  Business settings > Business profile')
steps(['Sign in with your <b>business owner</b> account. If you are new, register your business and wait for approval before opening bookings.','Open <b>Business settings > Business profile</b>. Review your business name, phone, street address and opening hours.','Keep your <b>Description of services</b>, city and state accurate in your business profile/branding details. The service description helps clients find you by keywords.','Select the section’s Save button; use <b>Save business settings</b> for the main settings form.'])
h('Find the right workspace')
p('<b>Dashboard</b> = requests and daily activity.<br/><b>Schedule</b> = calendar, bookings and time off.<br/><b>Services &amp; pricing</b> = your service list.<br/><b>Business settings</b> = setup and operating rules.<br/><b>Website &amp; branding</b> = public page design.<br/><b>Owner guide</b> = this guide, available in the top bar and menu.')
shot(Path('docs/screenshots/services-location-form-v1.3.175.jpg'),'Registration reference: required service description. Existing owners edit their business details in the workspace.',140)
note('Location search','Discover uses the saved city/address and available verified Google location data. A Google listing must be connected and provider configuration available. Nearby towns are not automatically treated as the same city.')

start(2,'02  Services & prices','Business settings > Service catalog  /  Or Services & pricing > Edit services')
steps(['Select <b>Add service type</b>. Replace “New service” with a clear name and choose a service type/category.','Enter the <b>quantity and duration unit</b>, then the price. For timed appointments, use an accurate duration such as 30 or 60 minutes.','Set <b>Simultaneous slots</b> for concurrent service availability. A published group session has its own customer capacity.','Choose whether the service needs <b>owner approval</b> and a <b>participation waiver</b>. Assign a default team member once the team is configured.','Select <b>Save business settings</b>, then review the service on the customer booking page.'])
h('A simple example')
p('<b>Service name:</b> Small-group training<br/><b>Type:</b> Fitness<br/><b>Quantity / unit:</b> 60 minutes<br/><b>Price:</b> $30<br/><b>Session capacity:</b> choose 10 later when creating the session.')
h('Edit an existing service')
p('Return to Service catalog, update the row, and save. Recheck team service assignments if you add a new service. Use the session rescheduling tool for already-published session changes that affect booked clients.')
note('Before removing a service','Review existing sessions, bookings and memberships that use it. Follow the app’s confirmation messages; removing an offering is different from cancelling an existing booking.')
note('Plan allowance','The app displays your service allowance. If Add is unavailable, review your plan or ask the platform administrator about an override.')

start(3,'03  Your team','Business settings > Team members  /  Then Team logins')
h('Add the team member first')
steps(['Open <b>Team members</b> and select <b>Add team member</b>. Enter their name and role.','Select the services they provide. Add notification email/phone as needed. Leave them visible for client booking unless they are for internal assignments only.','Select <b>Save business settings</b>. Then open <b>Team logins</b>, enter their login email and select <b>Create login</b>.','Use <b>Copy sign-in details</b> and share them privately. The temporary password is <b>123456</b>; the member must replace it at first sign-in.'])
note('Limits','Team allowances depend on the business package and administrator-approved overrides/additional seats. The app enforces the current allowance. Owners can Reset access or Disable access in Team logins.')
h('What the member does next')
p('At team sign-in, use email and password only. In <b>My profile</b>, add a portrait, biography, public contact details and social links, then save. Copy/share the public page. In <b>My calendar</b>, book clients or block time off. <b>My clients</b> holds private visit notes and photos.')
shot(Path('docs/screenshots/team-email-login-v1.3.177.jpg'),'Team sign-in is separate from the business owner login. Team pages inherit the business’s saved branding.',155)
note('Privacy','Public pages show profile information and available times. Private client names, photos, notes, booking details and time-off reasons stay inside the authorized workspace.')

start(4,'04  Rules, questions & waivers','Business settings > Booking rules, Questions, Service catalog and Notifications')
h('Set how your business accepts bookings')
steps(['In <b>Booking rules</b>, review intervals, preparation buffer, cancellation policy, taxes and blocked dates/hours. Save business settings.','In <b>Questions</b>, review standard fields and add the custom booking or membership questions you need. Put them in the right order.','Use <b>Required</b> for mandatory answers. Use <b>Notify</b> and the available push-display option to choose which answers appear in notifications. Save your changes.','In <b>Service catalog</b>, turn on <b>Require owner approval</b> and/or <b>Require waiver</b> for the relevant services, then save.'])
h('Handle participation waivers')
p('Review the waiver controls in Service catalog before enabling a waiver-required service. Clients must complete a required signature before booking can finish. A saved waiver is reused for the same business/client identity; use the same client Unique ID for returning clients.')
p('Use the owner waiver controls to retrieve/download saved waivers. If a waiver is removed, the client may need to sign again. Check the record before removing it.')
h('Configure approval alerts separately')
p('In <b>Notifications</b>, enable booking approval notifications and choose the reviewer and channels. This controls alerts; the service’s <b>Require approval</b> checkbox controls whether the booking needs approval.')
note('Client journey','A client submits details and any required waiver. If approval is required, review the request first. Payment or eligible membership verification follows the applicable booking rules. A full or blocked slot cannot be booked.')

start(5,'05  Payment setup','Business settings > Payment setup')
h('Connect Stripe for online payments')
steps(['Select <b>Stripe</b> as the preferred provider and save your choice. Review the fee comparison shown in the tab.','Select <b>Connect Stripe payments</b>, or <b>Complete Stripe setup</b> if setup has already started.','On Stripe, choose the account belonging to <b>this business</b>. Complete the business, identity and bank verification Stripe requests.','Return to SelahFlow and select <b>Verify Stripe</b>. Continue only when the status says the account is ready to accept payments.','If more information is requested later, return to Stripe and complete it. Use <b>Help: set up Stripe</b> for the in-app walkthrough.'])
h('Other payment options')
p('<b>Helcim:</b> you can save the preference and request activation. This currently does <b>not</b> connect Helcim or enable Helcim checkout. Existing Stripe subscriptions remain with Stripe.')
p('<b>Cash/offline payments:</b> use the appropriate owner payment/confirmation controls only after receiving the money. Creating a booking or assigning a membership does not verify online payment. Additional methods appear only where configured and available.')
h('Understand SelahFlow commissions')
p('Only the <b>platform administrator</b> can enable/disable first-time booking and first-time membership commissions. When enabled and terms accepted, each qualifying first purchase uses the greater of <b>10% or $5</b>, subject to the app’s small-payment cap. The fee comes from business proceeds; processor fees are separate. Repeat bookings and renewals are commission-free under this rule.')
note('Setup help','Business owners do not enter platform server keys or webhook secrets. If the connection button says platform setup is required, contact the SelahFlow administrator. Saving a provider preference alone does not activate payment collection.')

start(6,'06  Bookable sessions','Business settings > Bookable sessions  /  Create the service and team member first')
steps(['Select <b>Create session</b>. Choose the <b>First session date</b> and <b>Service</b>.','Select the <b>Default session host</b> and <b>Start time (Eastern)</b>. The host must provide that service.','Set <b>Maximum customers per occurrence</b>. For a group of 10, enter 10. Choose whether membership session credits are allowed.','Leave <b>Only offer scheduled session start times</b> enabled when clients should book this service/host only at published starts. Use the automatic-host option if clients should not choose a team member.','For a series, turn on <b>Repeat this session</b>. Choose daily, weekly or monthly frequency, the interval and end date.','Select <b>Save business settings</b>. Open Schedule and the customer booking page to confirm the date, time and seats are visible.'])
h('Example: one group every week')
p('<b>Service:</b> Small-group training<br/><b>First date / start:</b> your chosen Monday, 6:00 PM Eastern<br/><b>Host:</b> your saved team member<br/><b>Maximum customers:</b> 10<br/><b>Repeat:</b> weekly, every 1 week, with an end date')
h('Manage a published session')
p('Select the session in <b>Schedule</b> to see its private client roster and remaining seats. To change a booked date, time or host, use <b>Reschedule · keep customers</b>. Check the occurrence and capacity before confirming; a recurring reschedule changes the selected occurrence.')
note('Tell affected clients','The session reschedule tool does not automatically email clients. Inform them of changes. Removing a session removes its published dates but retains existing appointments, requests, payments and history; review those records separately.')

start(7,'07  Memberships','Memberships > Create membership plan  /  Different from your SelahFlow business package')
h('Create an offer clients can buy')
steps(['Open <b>Memberships</b> and select <b>Create membership plan</b>. Enter a simple name and description.','Choose the price and billing interval. Set the included sessions or available weekly-session option to match your offer.','Choose the services/sessions where credits can be used. For a selected list, tick the eligible services or session series. The session must also allow membership credit.','Optionally choose a membership type and badge. Select <b>Create membership plan</b>. Use <b>Customer signup</b> to check the public offer.'])
h('Enroll a client')
steps(['Share Customer signup, or choose <b>Assign a member</b> and complete the client’s identity and registration details. Reuse the existing member/Unique ID for a returning client.','Select the membership package and save. If payment is needed, use <b>Send for payment</b> after confirming payment and email setup.','Check verified payment and the member’s status. Assignment alone leaves payment pending. Confirm an offline payment only after it has actually been received.'])
note('Credits & renewals','Check-in and No-show record session use once; Completed does not deduct again. Review the member’s remaining sessions and history before renewal. Monthly credits follow the member’s credit period and do not roll over. Review the configured period rather than assuming a calendar-month reset.')
note('Coupons','Open <b>Memberships > Coupons</b>, enter a code, discount type/value, optional expiry and membership discount duration, then select Create coupon. Clients enter the code during booking or membership checkout. Test the displayed discounted total before sharing.')

start(8,'08  Daily calendar work','Schedule  /  Day, week or month view')
h('Book an appointment for a client')
steps(['Open <b>Schedule</b>. Select a day in week/month view or an available hour in day view. Choose <b>Book a client</b>. You can also start with <b>New booking</b>.','Choose the team member, service, date and available time. Enter the client’s details and any required answers.','Review the booking summary and confirm. A full, unavailable or blocked time cannot be reserved.','Check the new record’s approval/payment status. Owner/team calendar booking does not collect a client’s online payment by itself.'])
h('Block hours or days off')
steps(['Click the relevant day/hour and choose <b>Block time off</b>. Select the team member.','Choose hours or whole days, and enter the date range. For a multi-day block, the selected hours apply on each day in the range.','Save the block. Resolve overlapping appointments or published sessions first. Select a covered day later to edit or remove the block.'])
h('Approve, reschedule and record attendance')
p('Review new requests on <b>Dashboard</b> and use Accept/Decline after checking the details. Open an appointment for its available status actions. For a group session, open the session roster to manage registered clients. Mark <b>Check-in</b> or <b>No-show</b> accurately so membership use stays correct.')
note('Two important checks','A booking record is not proof of payment. Rescheduling a session is separate from editing its individual client appointments. Confirm the target record before you save.')

start(9,'09  Your public page','Website & branding  /  Then Business settings > Important URLs')
steps(['Open <b>Website &amp; branding > Business &amp; logo</b>. Update your business story, service description and logo using the available save controls.','Open <b>Colors &amp; fonts</b>, choose readable colors and typography, and save. Team pages inherit the saved business branding.','Open <b>Page editor</b> to edit page wording/layout. Preview the result and select <b>Save page changes</b>.','In <b>Social links</b>, paste full HTTPS profile URLs and select <b>Save social links</b>. Empty fields hide the relevant buttons.','In <b>Google reviews &amp; photos</b>, select/connect the correct listing using the available controls. Verify the displayed business/address.','Use <b>Booking QR &amp; sharing</b> to create/share the booking QR code and page link.'])
h('Find every useful business link')
p('Open <b>Business settings > Important URLs</b>. Use <b>Open</b> or <b>Copy URL</b> for the business homepage, booking, memberships, owner workspace/settings, team sign-in, available team profiles and saved external links.')
note('Share the right destination','Give clients the public business, booking, membership or visible team profile link. Owner and team workspaces still require sign-in. Individual payment/waiver links belong in their client records.')
h('Check the client experience')
p('Open the public page in a separate tab. Check the logo, phone, description, location, social buttons, service prices, session availability and membership offers on a phone-sized screen. The workspace’s business tile also opens the public homepage.')

start(10,'10  Clients & notifications','Clients  /  Business settings > Client communications and Notifications')
h('Maintain your client directory')
steps(['Open <b>Clients</b> and search for the client before creating a new record. Reuse their existing Unique ID.','Open the client to review contact details, appointments, membership and history. Use the available Add/Edit controls when information needs updating.','Use the directory’s export controls for all clients or the selected client when needed. Keep exported client information private.'])
h('Set up owner and team alerts')
p('In <b>Business settings > Notifications</b>, enable the desired booking alerts, reviewer and channels, then save. Enable device push separately on each device and allow browser notifications. Email/SMS depend on a working provider connection; an enabled checkbox alone does not configure delivery.')
p('Team members use <b>My profile > Enable booking notifications</b> on each device. Scheduled or newly assigned appointments can notify their devices. Their own time-off blocks send no booking alert. On iPhone, add SelahFlow to the Home Screen from Safari and open the installed app before enabling push.')
h('Send a client announcement')
steps(['Open <b>Business settings > Client communications</b>. Check the email connection status and connect Gmail/the supported sender if required.','Sync client contacts, choose recipients and compose the subject/message.','Preview the email and recipient list. Edit if needed, then preview again. Select <b>Send now</b> only when ready; a saved draft is not sent.','Review campaign status and delivery issues. Provider acceptance does not guarantee that an email reached the inbox.'])
note('Client photos','Team members can save photos/notes only for assigned visits in My clients. Use photos you have permission to store. These are private records and do not appear on the public team page.')

start(11,'11  Payments & account care','Sales & payments  /  Financial reports  /  Activity history  /  Account security')
h('Record received money accurately')
p('Open <b>Sales &amp; payments</b> for the available cash/payment actions or an eligible booking’s payment control. Verify the client and amount first. Use the cash/offline confirmation action only after money is received. For online payments, rely on the verified provider status, not a client’s screenshot alone.')
h('Check results and outstanding balances')
steps(['Open <b>Financial reports</b> and choose the date range. Review paid revenue separately from amounts awaiting approval or payment.','Open the relevant detail/count cards where available to inspect their underlying records. Compare bookings and memberships when reconciling totals.','Use <b>Activity history</b> and the client’s history to investigate status changes and attendance. Export available records when needed.'])
h('Keep access current')
p('Use <b>Account security</b> to change your owner password. Under <b>Team logins</b>, disable access for people who leave; reset access when a member needs new sign-in details. A reset revokes existing team sessions and requires a new password at first sign-in.')
h('Know where the client assistant gets answers')
p('The <b>Client assistant</b> uses your published business information for guidance and provides supported booking/membership status lookups. Keep your services, public wording, policies and links accurate. Confirm financial or scheduling changes in the actual owner tools.')
note('Before deleting records','Read every confirmation carefully. Permanent client/appointment removal can affect history and cannot be treated as ordinary cancellation. Prefer correcting, cancelling or disabling when you need to preserve records; arrange a verified backup before any bulk cleanup.')
note('Business package changes','Your SelahFlow business package controls feature allowances. It is separate from the membership packages you sell to clients. Ask the platform administrator for entitlement changes or extra-team approval.')

start(12,'12  Ready to go live','Use this checklist once, then repeat the daily routine below')
h('Launch checklist')
for t in ['Business name, service description, address and opening hours are correct.','Services have the right prices, durations, approval and waiver settings.','Team members are assigned to services; login access is shared privately.','Booking rules, questions and notifications are saved.','Stripe reports ready if you will accept online payments.','Sessions appear at the correct time with the correct capacity.','Membership offers have the right credits and service eligibility.','Public page, social links, QR code and booking links work on a phone.']:
 p('&#8226;  '+t)
h('If something does not work')
p('<b>No bookable time?</b> Check hours, date, host’s service assignments, published session starts, remaining seats and time off.<br/><b>Team login missing?</b> Save the member first, then create the login in Team logins. Check allowance and email.<br/><b>Payment unavailable?</b> Open Payment setup, complete Stripe requirements and Verify Stripe. Helcim preference alone does not activate checkout.<br/><b>No email/push?</b> Check sender readiness, recipient/device permission and saved alert settings. On iPhone, use the installed Home Screen app.<br/><b>Changes not visible?</b> Check the section’s Save button, wait for confirmation, then reopen the public page.')
h('A simple daily routine')
p('Review new requests on Dashboard. Check today in Schedule. Confirm payment status and record attendance. Review remaining credits, pending payments and any notification failures before closing the day.')
p('This guide follows the implemented SelahFlow owner interface. Available features depend on the business package, administrator overrides and connected providers. Screenshot references show the current public form/sign-in interface; private owner steps are verified against application source.',small)
c.save();print(OUT)

