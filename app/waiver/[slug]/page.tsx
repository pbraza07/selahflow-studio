import BookingWaiver from '../../components/booking-waiver';
export const metadata={title:'Review and sign your waiver',robots:{index:false,follow:false},referrer:'no-referrer'};
export default async function WaiverPage({params}:{params:Promise<{slug:string}>}){const {slug}=await params;return <BookingWaiver slug={slug}/>;}
