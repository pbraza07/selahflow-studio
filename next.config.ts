import type {NextConfig} from 'next';
const config: NextConfig = {
  poweredByHeader:false,
  serverExternalPackages:['pg'],
  async headers(){const privatePages=['/admin/:path*','/studio/:path*','/settings/:path*','/account/:path*','/api/:path*','/team/workspace','/team/review/:path*','/team/login','/business','/login','/signup','/registration-status','/payment/:path*','/membership-pay/:path*','/booking/respond/:path*','/customer/:path*','/onsite/:path*'];return [...privatePages.map(source=>({source,headers:[{key:'X-Robots-Tag',value:'noindex, nofollow'}]})),{source:'/:path*',headers:[
    ...(process.env.APP_ENV==='staging'?[{key:'X-Robots-Tag',value:'noindex, nofollow'}]:[]),
    {key:'X-Content-Type-Options',value:'nosniff'},
    {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
    {key:'X-Frame-Options',value:'DENY'},
    {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'}
  ]},{source:'/api/owner-guide',headers:[{key:'X-Frame-Options',value:'SAMEORIGIN'}]}];}
};
export default config;
