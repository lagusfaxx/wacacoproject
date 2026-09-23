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
    // El logo y los documentos que se envian por correo suben por una Server
    // Action, que por defecto corta el cuerpo en 1 MB. Se deja por encima del
    // mayor de los dos topes (MAX_TOTAL_DOCUMENT_BYTES, 15 MB) para que el
    // limite real sea el del formulario y no el del transporte, que da un
    // error mucho menos claro. El margen cubre el envoltorio multipart.
    serverActions: { bodySizeLimit: '20mb' },
  },
  // Descubrimiento OAuth del servidor MCP (lo consulta claude.ai al agregar el
  // conector). Las rutas viven en /api/mcp/oauth; aqui solo se publican en la
  // direccion estandar, con y sin el sufijo del recurso.
  async rewrites() {
    return [
      { source: '/.well-known/oauth-authorization-server', destination: '/api/mcp/oauth/metadata' },
      { source: '/.well-known/oauth-authorization-server/:path*', destination: '/api/mcp/oauth/metadata' },
      { source: '/.well-known/openid-configuration', destination: '/api/mcp/oauth/metadata' },
      { source: '/.well-known/oauth-protected-resource', destination: '/api/mcp/oauth/resource' },
      { source: '/.well-known/oauth-protected-resource/:path*', destination: '/api/mcp/oauth/resource' },
    ];
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
