import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Emits a minimal self-contained server bundle so the Docker image stays small.
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: {
    // Linting runs as its own step; a lint warning should never break a deploy.
    ignoreDuringBuilds: true,
  },
  // sharp es un modulo nativo: se deja fuera del empaquetado para que se cargue
  // desde node_modules en tiempo de ejecucion, que es la unica forma de que su
  // binario acompane a la salida standalone.
  serverExternalPackages: ['sharp'],
  experimental: {
    // El logo se sube por una Server Action, que por defecto corta el cuerpo en
    // 1 MB. Se deja por encima de MAX_IMAGE_BYTES para que el limite real sea
    // el de las imagenes y no el del transporte, que da un error mucho menos
    // claro. El margen cubre el envoltorio multipart.
    serverActions: { bodySizeLimit: '12mb' },
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
