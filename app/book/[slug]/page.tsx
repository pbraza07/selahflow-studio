import {cache} from 'react';
import {notFound} from 'next/navigation';
import Booking from '../page';
import {BookingIntroductionProvider} from '../../components/booking-introduction';
import {getPool} from '../../../server/database.mjs';
import {publicPageMetadata, validPublicSlug} from '../../../server/search-metadata.mjs';

export const dynamic = 'force-dynamic';
type Props = {params: Promise<{slug: string}>};

const publicBusiness = cache(async (slug: string) => {
  if (!validPublicSlug(slug)) notFound();
  const result = await getPool().query(
    "SELECT name, city, region FROM businesses WHERE slug=$1 AND status='active' LIMIT 1",
    [slug]
  );
  const business = result.rows[0];
  if (!business) notFound();
  const location = [business.city, business.region].filter(Boolean).join(', ');
  return {
    name: business.name as string,
    profile: '/' + encodeURIComponent(slug),
    description: 'View available services and session times at ' + business.name +
      (location ? ' in ' + location : '') + ' and book your visit online.'
  };
});

export async function generateMetadata({params}: Props) {
  const {slug} = await params;
  const business = await publicBusiness(slug);
  return publicPageMetadata('/book/' + encodeURIComponent(slug),
    'Book with ' + business.name + ' | SelahFlow', business.description);
}

export default async function BusinessBookingPage({params}: Props) {
  const business = await publicBusiness((await params).slug);
  return <BookingIntroductionProvider value={business}><Booking /></BookingIntroductionProvider>;
}
