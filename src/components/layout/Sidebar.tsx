// src/components/layout/Sidebar.tsx
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import NotificationBell from '@/components/NotificationBell';
import { useState, useEffect } from 'react';
import { 
  List, 
  X, 
  Briefcase, 
  CalendarCheck, 
  ShieldLock, 
  Speedometer2, 
  BoxArrowRight, 
  BoxArrowInRight,
  HddNetwork,
  Magic,
  ChevronLeft,
  ChevronRight
} from 'react-bootstrap-icons';

// ─── Typen ──────────────────────────────────────────────
interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  /** Nur rendern wenn `true` (Default: true) */
  visible?: boolean;
  /** Extra-Klassen für den Link-Button */
  className?: string;
}

// ─── Komponente ─────────────────────────────────────────
export default function Sidebar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  // Sidebar collapsed/expanded
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Mobile Menü (< md)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // ── Wartungsmodus-Check (1:1 aus Header.tsx) ──
  const [isInMaintenance, setIsInMaintenance] = useState(false);
  const [isCheckingMaintenance, setIsCheckingMaintenance] = useState(true);

  // ── KI-Tool Berechtigung (1:1 aus Header.tsx) ──
  const [kiToolEnabled, setKiToolEnabled] = useState(true);

  // ── Landingpages-Check für BENUTZER (1:1 aus Header.tsx) ──
  const [hasLandingpages, setHasLandingpages] = useState(false);
  const [isCheckingLandingpages, setIsCheckingLandingpages] = useState(true);

  // ── Rollen (1:1 aus Header.tsx) ──
  const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPERADMIN';
  const isSuperAdmin = session?.user?.role === 'SUPERADMIN';
  const isUser = session?.user?.role === 'BENUTZER';

  // ── Logo-Logik (1:1 aus Header.tsx) ──
  const defaultLogo = "/logo-data-peak.webp";
  const logoSrc = session?.user?.logo_url || defaultLogo;
  const priorityLoad = logoSrc === defaultLogo;

  // ═══════════════════════════════════════════════════════
  // EFFEKTE – alle 1:1 aus Header.tsx übernommen
  // ═══════════════════════════════════════════════════════

  // Wartungsmodus-Status prüfen
  useEffect(() => {
    const checkMaintenanceStatus = async () => {
      if (status !== 'authenticated' || !session?.user) {
        setIsCheckingMaintenance(false);
        setIsInMaintenance(false);
        return;
      }

      if (session.user.role === 'SUPERADMIN') {
        setIsCheckingMaintenance(false);
        setIsInMaintenance(false);
        return;
      }

      try {
        const res = await fetch('/api/admin/maintenance?checkSelf=true');
        const data = await res.json();
        setIsInMaintenance(data.isInMaintenance === true);
      } catch (e) {
        console.error('Failed to check maintenance status:', e);
        setIsInMaintenance(false);
      } finally {
        setIsCheckingMaintenance(false);
      }
    };

    if (status !== 'loading') {
      checkMaintenanceStatus();
    }
  }, [session, status]);

  // KI-Tool Status prüfen
  useEffect(() => {
    const checkKiToolStatus = async () => {
      if (status !== 'authenticated' || !session?.user) {
        setKiToolEnabled(true);
        return;
      }

      // SUPERADMIN hat immer Zugriff
      if (session.user.role === 'SUPERADMIN') {
        setKiToolEnabled(true);
        return;
      }

      try {
        const res = await fetch('/api/admin/ki-tool-settings?checkSelf=true');
        const data = await res.json();
        setKiToolEnabled(data.kiToolEnabled !== false);
      } catch (e) {
        console.error('Failed to check KI-Tool status:', e);
        setKiToolEnabled(true); // Im Fehlerfall anzeigen
      }
    };

    if (status !== 'loading') {
      checkKiToolStatus();
    }
  }, [session, status]);

  // Landingpages-Check für BENUTZER
  useEffect(() => {
    const checkLandingpages = async () => {
      if (status !== 'authenticated' || !session?.user) {
        setIsCheckingLandingpages(false);
        setHasLandingpages(false);
        return;
      }

      // Admins sehen den Button immer (sie haben ja die Redaktionspläne)
      if (session.user.role === 'ADMIN' || session.user.role === 'SUPERADMIN') {
        setIsCheckingLandingpages(false);
        setHasLandingpages(true);
        return;
      }

      // Für BENUTZER: Live-Check ob Landingpages existieren
      try {
        const res = await fetch('/api/user/has-landingpages');
        const data = await res.json();
        setHasLandingpages(data.hasLandingpages === true);
      } catch (e) {
        console.error('Failed to check landingpages:', e);
        setHasLandingpages(false);
      } finally {
        setIsCheckingLandingpages(false);
      }
    };

    if (status !== 'loading') {
      checkLandingpages();
    }
  }, [session, status]);

  // ═══════════════════════════════════════════════════════
  // CONDITIONAL RETURNS – alle 1:1 aus Header.tsx
  // ═══════════════════════════════════════════════════════

  // Login-Seite: Sidebar nicht anzeigen
  if (pathname === '/login') {
    return null;
  }

  // Wartungsmodus aktiv -> Sidebar ausblenden
  if (isInMaintenance) {
    return null;
  }

  // Während der Prüfung Sidebar nicht anzeigen (verhindert Flackern)
  if (isCheckingMaintenance && status === 'authenticated' && session?.user?.role !== 'SUPERADMIN') {
    return null;
  }

  // ═══════════════════════════════════════════════════════
  // HILFSFUNKTIONEN
  // ═══════════════════════════════════════════════════════

  const handleLinkClick = () => {
    setIsMobileMenuOpen(false);
  };

  // Soll der KI-Tool Button angezeigt werden? (1:1 aus Header.tsx)
  const shouldShowKiTool = isAdmin && kiToolEnabled;

  // Soll der Redaktionsplan Button für User angezeigt werden? (1:1 aus Header.tsx)
  const shouldShowRedaktionsplanForUser = isUser && hasLandingpages && !isCheckingLandingpages;

  // ── Nav-Items nach Rolle aufbauen ──
  const mainNavItems: NavItem[] = [
    // ADMIN: Projekte
    {
      href: '/',
      label: 'Projekte',
      icon: <Briefcase size={18} />,
      visible: isAdmin,
    },
    // BENUTZER: Dashboard
    {
      href: '/',
      label: 'Dashboard',
      icon: <Speedometer2 size={18} />,
      visible: isUser,
    },
    // ADMIN: Redaktionspläne
    {
      href: '/admin/redaktionsplan',
      label: 'Redaktionspläne',
      icon: <CalendarCheck size={18} />,
      visible: isAdmin,
    },
    // BENUTZER: Redaktionsplan (nur wenn Landingpages vorhanden)
    {
      href: '/dashboard/freigabe',
      label: 'Redaktionsplan',
      icon: <CalendarCheck size={18} />,
      visible: shouldShowRedaktionsplanForUser,
    },
    // ADMIN: KI Tool (nur wenn aktiviert)
    {
      href: '/admin/ki-tool',
      label: 'KI Tool',
      icon: <Magic size={18} />,
      visible: shouldShowKiTool,
    },
  ];

  const adminNavItems: NavItem[] = [
    // ADMIN: Admin-Bereich
    {
      href: '/admin',
      label: 'Admin-Bereich',
      icon: <ShieldLock size={18} />,
      visible: isAdmin,
    },
    // SUPERADMIN: System
    {
      href: '/admin/system',
      label: 'System',
      icon: <HddNetwork size={18} />,
      visible: isSuperAdmin,
      className: 'text-indigo-600',
    },
  ];

  // ── Prüft ob ein Link aktiv ist ──
  const isActive = (href: string): boolean => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(href + '/');
  };

  // ═══════════════════════════════════════════════════════
  // RENDER: Einzelner Nav-Link
  // ═══════════════════════════════════════════════════════

  const renderNavLink = (item: NavItem, index: number) => {
    if (item.visible === false) return null;

    const active = isActive(item.href);

    return (
      <Link
        key={`${item.href}-${index}`}
        href={item.href}
        onClick={handleLinkClick}
        title={isCollapsed ? item.label : undefined}
        className={`
          group relative flex items-center gap-3 px-3 py-2.5 rounded-xl
          transition-all duration-150 text-sm font-medium
          ${active
            ? 'bg-indigo-50 text-indigo-700 shadow-sm'
            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
          }
          ${item.className || ''}
        `}
      >
        {/* Icon */}
        <span className={`flex-shrink-0 flex items-center justify-center w-5 h-5 ${active ? 'text-indigo-600' : ''}`}>
          {item.icon}
        </span>

        {/* Label (hidden when collapsed on desktop, always visible on mobile) */}
        <span className={`
          whitespace-nowrap transition-all duration-200
          ${isCollapsed ? 'md:opacity-0 md:w-0 md:overflow-hidden' : 'opacity-100'}
        `}>
          {item.label}
        </span>

        {/* Tooltip (nur collapsed, nur Desktop) */}
        {isCollapsed && (
          <span className="
            hidden md:group-hover:flex
            absolute left-full ml-3 top-1/2 -translate-y-1/2
            bg-gray-900 text-white text-xs font-medium
            px-3 py-1.5 rounded-lg whitespace-nowrap
            shadow-lg z-[100]
            pointer-events-none
            after:content-[''] after:absolute after:right-full after:top-1/2 after:-translate-y-1/2
            after:border-[5px] after:border-transparent after:border-r-gray-900
          ">
            {item.label}
          </span>
        )}
      </Link>
    );
  };

  // ═══════════════════════════════════════════════════════
  // RENDER: Mobile Nav-Link (für Dropdown – nutzt Button-Stil wie vorher)
  // ═══════════════════════════════════════════════════════

  const renderMobileNavLink = (item: NavItem, index: number) => {
    if (item.visible === false) return null;

    const active = isActive(item.href);

    return (
      <Link key={`mobile-${item.href}-${index}`} href={item.href} passHref onClick={handleLinkClick}>
        <button
          className={`
            w-full flex items-center justify-start gap-2 px-4 py-2.5 rounded-lg
            text-sm font-medium transition-all
            ${active
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }
            ${item.className || ''}
          `}
        >
          {item.icon}
          {item.label}
        </button>
      </Link>
    );
  };

  // ═══════════════════════════════════════════════════════
  // RENDER: DESKTOP SIDEBAR
  // ═══════════════════════════════════════════════════════

  const renderDesktopSidebar = () => (
    <aside
      className={`
        hidden md:flex flex-col h-screen bg-white border-r border-gray-200
        transition-all duration-200 ease-in-out relative flex-shrink-0
        ${isCollapsed ? 'w-[72px]' : 'w-[260px]'}
      `}
    >
      {/* ── Toggle Button ── */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="
          absolute -right-3 top-[28px] z-50
          w-6 h-6 bg-white border border-gray-200 rounded-full
          flex items-center justify-center
          shadow-sm hover:shadow-md hover:border-indigo-300 hover:bg-indigo-50
          transition-all duration-150 text-gray-400 hover:text-indigo-600
        "
        title={isCollapsed ? 'Sidebar ausklappen' : 'Sidebar einklappen'}
      >
        {isCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>

      {/* ── Logo ── */}
      <div className="flex items-center h-[68px] px-4 border-b border-gray-100 flex-shrink-0 gap-3">
        <Link href="/" onClick={handleLinkClick} className="flex items-center gap-3 flex-shrink-0">
          <div className="relative h-[40px] w-[40px] flex-shrink-0">
            <Image
              src={logoSrc}
              alt="Dashboard Logo"
              fill
              priority={priorityLoad}
              onError={(e) => {
                if (logoSrc !== defaultLogo) {
                  (e.target as HTMLImageElement).src = defaultLogo;
                }
              }}
              className="object-contain"
              sizes="40px"
            />
          </div>
          {!isCollapsed && (
            <span className="text-base font-bold text-gray-900 tracking-tight whitespace-nowrap">
              DataPeak
            </span>
          )}
        </Link>
      </div>

      {/* ── User-Info ── */}
      {status === 'authenticated' && session?.user && (
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 flex-shrink-0">
          {/* Avatar */}
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 flex items-center justify-center flex-shrink-0 text-sm font-semibold text-emerald-600">
            {(session.user.name || session.user.email || '?').charAt(0).toUpperCase()}
          </div>
          {!isCollapsed && (
            <div className="overflow-hidden">
              <div className="text-sm font-semibold text-gray-900 truncate">
                {session.user?.name ?? session.user?.email}
              </div>
              <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                {isAdmin && <ShieldLock size={9} />}
                <span>{session.user.role}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Navigation ── */}
      {status === 'authenticated' && (
        <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-1 scrollbar-none">
          
          {/* Haupt-Navigation */}
          {!isCollapsed && (
            <div className="px-3 pt-2 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
              Navigation
            </div>
          )}
          {mainNavItems.map((item, i) => renderNavLink(item, i))}

          {/* Admin-Navigation */}
          {adminNavItems.some(item => item.visible !== false) && (
            <>
              {!isCollapsed && (
                <div className="px-3 pt-5 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                  Administration
                </div>
              )}
              {isCollapsed && <div className="my-2 mx-3 h-px bg-gray-100" />}
              {adminNavItems.map((item, i) => renderNavLink(item, i))}
            </>
          )}

          {/* Benachrichtigungen */}
          {!isCollapsed && (
            <div className="px-3 pt-5 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
              Sonstiges
            </div>
          )}
          {isCollapsed && <div className="my-2 mx-3 h-px bg-gray-100" />}
          
          <div className={`
            relative flex items-center gap-3 px-3 py-2.5 rounded-xl
            transition-all duration-150 text-sm font-medium
            text-gray-500 hover:bg-gray-50 hover:text-gray-900
          `}>
            <NotificationBell />
            {!isCollapsed && (
              <span className="whitespace-nowrap">Benachrichtigungen</span>
            )}
          </div>
        </nav>
      )}

      {/* ── Footer: Abmelden / Anmelden ── */}
      <div className="px-2.5 py-3 border-t border-gray-100 flex-shrink-0">
        {status === 'authenticated' ? (
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="
              group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
              transition-all duration-150 text-sm font-medium
              text-red-500 hover:bg-red-50 hover:text-red-600
            "
          >
            <BoxArrowRight size={18} className="flex-shrink-0" />
            {!isCollapsed && <span>Abmelden</span>}
            {isCollapsed && (
              <span className="
                hidden md:group-hover:flex
                absolute left-full ml-3 top-1/2 -translate-y-1/2
                bg-gray-900 text-white text-xs font-medium
                px-3 py-1.5 rounded-lg whitespace-nowrap
                shadow-lg z-[100] pointer-events-none
                after:content-[''] after:absolute after:right-full after:top-1/2 after:-translate-y-1/2
                after:border-[5px] after:border-transparent after:border-r-gray-900
              ">
                Abmelden
              </span>
            )}
          </button>
        ) : status === 'unauthenticated' ? (
          <Link
            href="/login"
            className="
              group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
              transition-all duration-150 text-sm font-medium
              text-indigo-600 hover:bg-indigo-50
            "
          >
            <BoxArrowInRight size={18} className="flex-shrink-0" />
            {!isCollapsed && <span>Anmelden</span>}
            {isCollapsed && (
              <span className="
                hidden md:group-hover:flex
                absolute left-full ml-3 top-1/2 -translate-y-1/2
                bg-gray-900 text-white text-xs font-medium
                px-3 py-1.5 rounded-lg whitespace-nowrap
                shadow-lg z-[100] pointer-events-none
                after:content-[''] after:absolute after:right-full after:top-1/2 after:-translate-y-1/2
                after:border-[5px] after:border-transparent after:border-r-gray-900
              ">
                Anmelden
              </span>
            )}
          </Link>
        ) : null}
      </div>
    </aside>
  );

  // ═══════════════════════════════════════════════════════
  // RENDER: MOBILE HEADER + DROPDOWN (< md)
  // Bleibt als horizontaler Header auf Mobile – 1:1 wie vorher
  // ═══════════════════════════════════════════════════════

  const renderMobileHeader = () => (
    <header className="md:hidden bg-white shadow-md relative print:hidden">
      <nav className="w-full px-6 py-3 flex justify-between items-center">

        {/* Linke Seite: Logo und Begrüßung */}
        <div className="flex items-center space-x-4">
          <Link href="/" onClick={handleLinkClick}>
            <div className="relative h-[45px] w-[180px]">
              <Image
                src={logoSrc}
                alt="Dashboard Logo"
                fill
                priority={priorityLoad}
                onError={(e) => {
                  if (logoSrc !== defaultLogo) {
                    (e.target as HTMLImageElement).src = defaultLogo;
                  }
                }}
                className="object-contain"
                sizes="180px"
              />
            </div>
          </Link>

          {status === 'authenticated' && (
            <span className="text-gray-600 underline underline-offset-6 hidden sm:block">
              Hallo, {session?.user?.name ?? session?.user?.email}
            </span>
          )}
        </div>

        {/* Rechte Seite: Notification + Hamburger */}
        <div className="flex items-center">
          {status === 'authenticated' && <NotificationBell />}

          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="text-gray-600 hover:text-gray-900 p-2 ml-2"
            aria-label="Menü umschalten"
          >
            {isMobileMenuOpen ? <X size={28} /> : <List size={28} />}
          </button>
        </div>
      </nav>

      {/* Mobiles Dropdown-Menü – 1:1 wie vorher */}
      {isMobileMenuOpen && status === 'authenticated' && (
        <div
          className="absolute top-full left-0 w-full bg-white shadow-lg border-t border-gray-100 z-50"
          onClick={handleLinkClick}
        >
          <div className="flex flex-col space-y-2 p-4">

            {/* ADMIN Nav */}
            {isAdmin && (
              <>
                {renderMobileNavLink({ href: '/', label: 'Projekte', icon: <Briefcase size={16} />, visible: true }, 0)}
                {renderMobileNavLink({ href: '/admin/redaktionsplan', label: 'Redaktionspläne', icon: <CalendarCheck size={16} />, visible: true }, 1)}

                {/* KI Tool Button (Mobil) – nur wenn aktiviert */}
                {shouldShowKiTool && renderMobileNavLink({ href: '/admin/ki-tool', label: 'KI Tool', icon: <Magic size={16} />, visible: true }, 2)}

                {renderMobileNavLink({ href: '/admin', label: 'Admin-Bereich', icon: <ShieldLock size={16} />, visible: true }, 3)}

                {/* Superadmin: System */}
                {isSuperAdmin && renderMobileNavLink({
                  href: '/admin/system',
                  label: 'System Status',
                  icon: <HddNetwork size={16} />,
                  visible: true,
                  className: 'text-indigo-600 border-indigo-200 bg-indigo-50',
                }, 4)}
              </>
            )}

            {/* USER Nav */}
            {isUser && (
              <>
                {renderMobileNavLink({ href: '/', label: 'Dashboard', icon: <Speedometer2 size={16} />, visible: true }, 10)}

                {/* Redaktionsplan für User (Mobil) – nur wenn Landingpages vorhanden */}
                {shouldShowRedaktionsplanForUser && renderMobileNavLink({
                  href: '/dashboard/freigabe',
                  label: 'Redaktionsplan',
                  icon: <CalendarCheck size={16} />,
                  visible: true,
                }, 11)}
              </>
            )}

            <hr className="my-2" />

            <button
              className="w-full flex items-center justify-start gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 transition-all"
              onClick={() => signOut({ callbackUrl: '/login' })}
            >
              <BoxArrowRight size={16} />
              Abmelden
            </button>
          </div>
        </div>
      )}
    </header>
  );

  // ═══════════════════════════════════════════════════════
  // RENDER: FINAL
  // ═══════════════════════════════════════════════════════

  return (
    <>
      {renderDesktopSidebar()}
      {renderMobileHeader()}
    </>
  );
}
