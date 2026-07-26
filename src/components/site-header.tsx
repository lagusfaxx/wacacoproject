'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { WacacoLogo } from './brand';
import {
  CartIcon,
  ChevronDownIcon,
  CloseIcon,
  MenuIcon,
  SearchIcon,
  UserIcon,
} from './icons';

export type HeaderCollection = { slug: string; name: string };

type Props = {
  collections: HeaderCollection[];
  productLinks: { slug: string; name: string }[];
  cartCount: number;
  userName: string | null;
  isAdmin: boolean;
  currency: string;
  announcement: string | null;
};

export function SiteHeader({
  collections,
  productLinks,
  cartCount,
  userName,
  isAdmin,
  currency,
  announcement,
}: Props) {
  const pathname = usePathname();
  const [openMenu, setOpenMenu] = useState<'products' | 'account' | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const navRef = useRef<HTMLDivElement>(null);

  // Cualquier navegacion cierra todo lo que este desplegado.
  useEffect(() => {
    setOpenMenu(null);
    setMobileOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpenMenu(null);
        setMobileOpen(false);
        setSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  // Evita que el fondo se desplace cuando el menu movil esta abierto.
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  return (
    <header className="sticky top-0 z-50 bg-white">
      {announcement ? (
        <div className="bg-ink px-4 py-2 text-center font-display text-[11px] uppercase tracking-[0.18em] text-white">
          {announcement}
        </div>
      ) : null}

      <div ref={navRef} className="relative border-b border-sand-dark">
        <div className="flex h-[70px] items-stretch">
          <Link
            href="/"
            className="flex shrink-0 items-center border-r border-sand-dark px-5 text-ink lg:px-8"
            aria-label="Wacaco - inicio"
          >
            <WacacoLogo />
          </Link>

          <nav className="hidden items-stretch lg:flex" aria-label="Principal">
            <div className="relative flex items-stretch">
              <button
                type="button"
                onClick={() => setOpenMenu(openMenu === 'products' ? null : 'products')}
                aria-expanded={openMenu === 'products'}
                aria-haspopup="true"
                className={`flex items-center gap-1.5 border-r border-sand-dark px-7 font-display text-sm font-semibold uppercase tracking-widest transition-colors ${
                  openMenu === 'products' ? 'text-brand' : 'text-ink hover:text-brand'
                }`}
              >
                Todos los productos
                <ChevronDownIcon
                  className={`h-4 w-4 transition-transform ${openMenu === 'products' ? 'rotate-180' : ''}`}
                />
              </button>
            </div>

            <Link
              href="/blog"
              className="flex items-center border-r border-sand-dark px-7 font-display text-sm font-semibold uppercase tracking-widest text-ink transition-colors hover:text-brand"
            >
              Novedades
            </Link>
            <Link
              href="/ayuda"
              className="flex items-center border-r border-sand-dark px-7 font-display text-sm font-semibold uppercase tracking-widest text-ink transition-colors hover:text-brand"
            >
              Ayuda
            </Link>
          </nav>

          <div className="ml-auto flex items-stretch">
            <span className="hidden items-center border-l border-sand-dark px-5 font-display text-xs font-semibold uppercase tracking-widest text-ink-soft xl:flex">
              Espanol | {currency}
            </span>

            <button
              type="button"
              onClick={() => setSearchOpen((value) => !value)}
              className="flex items-center border-l border-sand-dark px-5 text-ink transition-colors hover:text-brand"
              aria-label="Buscar productos"
              aria-expanded={searchOpen}
            >
              <SearchIcon className="h-5 w-5" />
            </button>

            <div className="relative hidden items-stretch sm:flex">
              <button
                type="button"
                onClick={() => setOpenMenu(openMenu === 'account' ? null : 'account')}
                aria-expanded={openMenu === 'account'}
                aria-haspopup="true"
                className="flex items-center gap-2 border-l border-sand-dark px-5 font-display text-sm font-semibold uppercase tracking-widest text-ink transition-colors hover:text-brand"
              >
                <UserIcon className="h-5 w-5" />
                <span className="hidden md:inline">{userName ? userName.split(' ')[0] : 'Cuenta'}</span>
                <ChevronDownIcon
                  className={`h-4 w-4 transition-transform ${openMenu === 'account' ? 'rotate-180' : ''}`}
                />
              </button>

              {openMenu === 'account' ? (
                <div className="absolute right-0 top-full z-50 w-60 border border-sand-dark bg-white py-2 shadow-lg animate-fadeIn">
                  {userName ? (
                    <>
                      <p className="px-5 py-2 text-xs text-ink-muted">
                        Sesion iniciada como <span className="font-semibold text-ink">{userName}</span>
                      </p>
                      <AccountLink href="/cuenta">Mi cuenta</AccountLink>
                      <AccountLink href="/cuenta/pedidos">Mis pedidos</AccountLink>
                      {isAdmin ? <AccountLink href="/admin">Panel de administracion</AccountLink> : null}
                      <form action="/api/auth/logout" method="post" className="border-t border-sand-dark">
                        <button
                          type="submit"
                          className="w-full px-5 py-3 text-left font-display text-xs font-semibold uppercase tracking-widest text-ink transition-colors hover:bg-sand"
                        >
                          Cerrar sesion
                        </button>
                      </form>
                    </>
                  ) : (
                    <>
                      <AccountLink href="/cuenta/ingresar">Iniciar sesion</AccountLink>
                      <AccountLink href="/cuenta/registro">Crear cuenta</AccountLink>
                      <AccountLink href="/seguimiento">Seguir mi pedido</AccountLink>
                    </>
                  )}
                </div>
              ) : null}
            </div>

            <Link
              href="/carrito"
              className="flex items-center gap-2 border-l border-sand-dark px-5 font-display text-sm font-semibold uppercase tracking-widest text-ink transition-colors hover:text-brand lg:px-7"
            >
              <span className="relative">
                <CartIcon className="h-5 w-5" />
                {cartCount > 0 ? (
                  <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
                    {cartCount > 99 ? '99+' : cartCount}
                  </span>
                ) : null}
              </span>
              <span className="hidden md:inline">Carrito</span>
            </Link>

            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="flex items-center border-l border-sand-dark px-5 text-ink lg:hidden"
              aria-label="Abrir menu"
            >
              <MenuIcon className="h-6 w-6" />
            </button>
          </div>
        </div>

        {searchOpen ? (
          <div className="border-t border-sand-dark bg-white px-4 py-4 animate-fadeIn sm:px-6 lg:px-10">
            <form action="/buscar" method="get" className="mx-auto flex max-w-3xl items-center gap-3">
              <input
                ref={searchInputRef}
                type="search"
                name="q"
                placeholder="Buscar cafeteras, accesorios..."
                className="field flex-1"
                maxLength={80}
              />
              <button type="submit" className="btn-dark btn-sm py-3">
                Buscar
              </button>
            </form>
          </div>
        ) : null}

        {openMenu === 'products' ? (
          <div className="absolute left-0 top-full z-40 hidden w-full border-b border-sand-dark bg-white shadow-lg animate-fadeIn lg:block">
            <div className="container-site grid gap-10 py-10 md:grid-cols-[220px_1fr]">
              <div>
                <p className="mb-4 font-display text-xs font-bold uppercase tracking-[0.2em] text-ink-muted">
                  Colecciones
                </p>
                <ul className="space-y-1">
                  <li>
                    <Link
                      href="/productos"
                      className="block py-2 font-display text-sm font-semibold uppercase tracking-widest text-ink hover:text-brand"
                    >
                      Catalogo completo
                    </Link>
                  </li>
                  {collections.map((collection) => (
                    <li key={collection.slug}>
                      <Link
                        href={`/coleccion/${collection.slug}`}
                        className="block py-2 font-display text-sm font-semibold uppercase tracking-widest text-ink hover:text-brand"
                      >
                        {collection.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="mb-4 font-display text-xs font-bold uppercase tracking-[0.2em] text-ink-muted">
                  Productos
                </p>
                <ul className="grid grid-cols-2 gap-x-8 gap-y-1 xl:grid-cols-3">
                  {productLinks.map((product) => (
                    <li key={product.slug}>
                      <Link
                        href={`/productos/${product.slug}`}
                        className="block py-2 text-sm text-ink-soft transition-colors hover:text-brand"
                      >
                        {product.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-white lg:hidden">
          <div className="flex h-[70px] items-center justify-between border-b border-sand-dark px-5">
            <WacacoLogo />
            <button type="button" onClick={() => setMobileOpen(false)} aria-label="Cerrar menu">
              <CloseIcon className="h-6 w-6" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-6">
            <p className="mb-3 font-display text-xs font-bold uppercase tracking-[0.2em] text-ink-muted">
              Colecciones
            </p>
            <ul className="mb-8 space-y-1">
              <li>
                <Link href="/productos" className="block py-2.5 font-display text-lg font-bold uppercase">
                  Catalogo completo
                </Link>
              </li>
              {collections.map((collection) => (
                <li key={collection.slug}>
                  <Link
                    href={`/coleccion/${collection.slug}`}
                    className="block py-2.5 font-display text-lg font-bold uppercase"
                  >
                    {collection.name}
                  </Link>
                </li>
              ))}
            </ul>

            <p className="mb-3 font-display text-xs font-bold uppercase tracking-[0.2em] text-ink-muted">
              Tienda
            </p>
            <ul className="space-y-1">
              <li>
                <Link href="/blog" className="block py-2.5 text-base text-ink-soft">
                  Novedades
                </Link>
              </li>
              <li>
                <Link href="/ayuda" className="block py-2.5 text-base text-ink-soft">
                  Ayuda
                </Link>
              </li>
              <li>
                <Link href="/seguimiento" className="block py-2.5 text-base text-ink-soft">
                  Seguir mi pedido
                </Link>
              </li>
              <li>
                <Link href="/carrito" className="block py-2.5 text-base text-ink-soft">
                  Carrito ({cartCount})
                </Link>
              </li>
              {userName ? (
                <>
                  <li>
                    <Link href="/cuenta" className="block py-2.5 text-base text-ink-soft">
                      Mi cuenta
                    </Link>
                  </li>
                  {isAdmin ? (
                    <li>
                      <Link href="/admin" className="block py-2.5 text-base text-ink-soft">
                        Panel de administracion
                      </Link>
                    </li>
                  ) : null}
                  <li>
                    <form action="/api/auth/logout" method="post">
                      <button type="submit" className="py-2.5 text-base text-ink-soft">
                        Cerrar sesion
                      </button>
                    </form>
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <Link href="/cuenta/ingresar" className="block py-2.5 text-base text-ink-soft">
                      Iniciar sesion
                    </Link>
                  </li>
                  <li>
                    <Link href="/cuenta/registro" className="block py-2.5 text-base text-ink-soft">
                      Crear cuenta
                    </Link>
                  </li>
                </>
              )}
            </ul>
          </div>
        </div>
      ) : null}
    </header>
  );
}

function AccountLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="block px-5 py-3 font-display text-xs font-semibold uppercase tracking-widest text-ink transition-colors hover:bg-sand"
    >
      {children}
    </Link>
  );
}
