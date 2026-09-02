import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

function createContentSecurityPolicy(nonce: string): string {
  const isDevelopment = process.env.NODE_ENV === 'development';
  return [
    "default-src 'self'",
    // Next.js reads this nonce during rendering and applies it to framework
    // scripts. strict-dynamic lets those trusted scripts load Razorpay safely.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ''} https://js.stripe.com https://checkout.razorpay.com`,
    // The UI intentionally uses React style attributes, so style-src remains
    // permissive while scripts are protected by a per-request nonce.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "frame-src 'self' https://js.stripe.com https://api.razorpay.com",
    "connect-src 'self' wss: https:",
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

// Middleware runs on the Edge runtime — we cannot throw at module scope here,
// so we return a 500 response if the secret is missing at request time.
export async function proxy(req: NextRequest) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    console.error('[FATAL] NEXTAUTH_SECRET is not set. Cannot validate session tokens.');
    return new NextResponse('Server misconfiguration: authentication secret is missing.', { status: 500 });
  }
  const token = await getToken({ req, secret });
  const { pathname } = req.nextUrl;
  const nonce = btoa(crypto.randomUUID());
  const contentSecurityPolicy = createContentSecurityPolicy(nonce);

  const isPublicAuthPage = pathname.startsWith('/auth/login') || pathname.startsWith('/auth/signup') || pathname.startsWith('/auth/verify');
  const isPublicPage = isPublicAuthPage || pathname === '/' || pathname.startsWith('/share/');
  const isApiAuthRoute = pathname.startsWith('/api/auth');

  if (isApiAuthRoute) {
    return NextResponse.next();
  }

  // 1. Unauthenticated users cannot access any protected page
  if (!token) {
    if (!isPublicPage) {
      const loginUrl = new URL('/auth/login', req.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // 2. Authenticated but unverified users must verify their email
  if (token && !token.isVerified && pathname !== '/auth/verify') {
    return NextResponse.redirect(new URL('/auth/verify', req.url));
  }

  // 3. Authenticated & Verified users are redirected away from auth pages to dashboard
  if (token && token.isVerified && isPublicAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  if (pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  // 4. Protect Admin routes
  if (pathname.startsWith('/admin')) {
    if (token?.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', contentSecurityPolicy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', contentSecurityPolicy);
  return response;
}

export const config = {
  matcher: [
    '/',
    '/dashboard/:path*',
    '/interview/:path*',
    '/quiz/:path*',
    '/resume/:path*',
    '/bookmarks/:path*',
    '/analytics/:path*',
    '/history/:path*',
    '/leaderboard/:path*',
    '/questions/:path*',
    '/system-design/:path*',
    '/tools/:path*',
    '/certificate/:path*',
    '/auth/:path*',
    '/admin/:path*',
  ],
};
