import test from 'node:test';
import assert from 'node:assert/strict';
import {businessGoogleReviewUrl,safeEmailReviewUrl} from '../server/google-review-link.mjs';

test('review destinations use an exact saved Google listing and reject unrelated links and unsafe URLs',()=>{
 const expected='https://search.google.com/local/writereview?placeid=ChIJBusinessA123';
 assert.equal(businessGoogleReviewUrl({placeId:'ChIJBusinessA123',listingUrl:'https://evil.example/'}),expected);
 assert.equal(businessGoogleReviewUrl({listingUrl:'https://www.google.com/maps/search/?api=1&query=Business&query_place_id=ChIJBusinessA123'}),expected);
 assert.equal(safeEmailReviewUrl(expected),expected);
 assert.equal(safeEmailReviewUrl('https://g.page/r/ExactBusiness/review?share=1'),'https://g.page/r/ExactBusiness/review');
 for(const value of ['javascript:alert(1)','http://search.google.com/local/writereview?placeid=ChIJBusinessA123','https://google.com.evil.test/maps?placeid=ChIJBusinessA123','https://google.com/url?placeid=ChIJBusinessA123&url=https://evil.test','https://user:secret@search.google.com/local/writereview?placeid=ChIJBusinessA123','https://www.google.com/maps/search/?query=Ambiguous+name','https://maps.app.goo.gl/unknown','https://g.page/r/no-review-page'])assert.equal(safeEmailReviewUrl(value),'',value);
 assert.equal(businessGoogleReviewUrl({}), '');assert.equal(businessGoogleReviewUrl({placeId:'<script>'}), '');
});
