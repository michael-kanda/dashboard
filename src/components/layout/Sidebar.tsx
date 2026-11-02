// src/components/layout/Sidebar.tsx
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { useTheme } from '@/components/ThemeProvider';
import { useState, useEffect, useCallback } from 'react';
import { 
  List, X, Briefcase, CalendarCheck, ShieldLock, Speedometer2, 
  BoxArrowRight, BoxArrowInRight, HddNetwork, Magic,
  LayoutSidebarInset, SunFill, MoonStarsFill,
  ChevronDown, ChevronUp,
  BarChartFill, GraphUpArrow, Robot, FileEarmarkText, PieChartFill, Search, Google, GeoAlt
} from 'react-bootstrap-icons';
import { initials, roleLabel } from '@/lib/ui-labels';

// ═══════════════════════════════════════════════════════
// KONFIGURATION
// ═══════════════════════════════════════════════════════

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  visible?: boolean;
}

// Wir lagern die Sektionen aus, damit sie übersichtlich an einem Ort sind
const DASHBOARD_SECTIONS = [
  { id: 'section-kpis',         label: 'Traffic & Reichweite',  icon: <BarChartFill size={14} /> },
  { id: 'section-verlauf',      label: 'Verlauf & Analyse',     icon: <GraphUpArrow size={14} /> },
  { id: 'section-local-seo',    label: 'Lokale Sichtbarkeit',   icon: <GeoAlt size={14} /> },
  { id: 'section-google-genai', label: 'Google GenAI Sichtbarkeit', icon: <Google size={14} /> },
  { id: 'section-ki-traffic',   label: 'KI-Traffic',            icon: <Robot size={14} /> },
  { id: 'section-top-queries',  label: 'Top Suchanfragen',      icon: <Search size={14} /> },
  { id: 'section-landingpages', label: 'Top Landingpages',      icon: <FileEarmarkText size={14} /> },
  { id: 'section-zugriffe',     label: 'Zugriffe nach Quelle',  icon: <PieChartFill size={14} /> },
  { id: 'section-google-ads',   label: 'Google Ads Performance', icon: <Google size={14} /> },
  { id: 'section-semrush',      label: 'Semrush Keywords',      icon: <Search size={14} /> },
];

export default function Sidebar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [dashboardSubmenuOpen, setDashboardSubmenuOpen] = useState(true);
  const [activeSection, setActiveSection] = useState<string>('');
  const [isCheckingMaintenance, setIsCheckingMaintenance] = useState(true);
  const [isInMaintenance, setIsInMaintenance] = useState(false);
  const [kiToolEnabled, setKiToolEnabled] = useState(true);
  const [hasLandingpages, setHasLandingpages] = useState(false);
  const [isCheckingLandingpages, setIsCheckingLandingpages] = useState(true);

  // NEU: State speichert alle Sektions-IDs, die tatsächlich im DOM existieren.
  // Standardmäßig nehmen wir erstmal an, dass alle da sind, bis geprüft wurde.
  const [availableSectionIds, setAvailableSectionIds] = useState<string[]>(
    DASHBOARD_SECTIONS.map(s => s.id)
  );

  const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPERADMIN';
  const isSuperAdmin = session?.user?.role === 'SUPERADMIN';
  const isUser = session?.user?.role === 'BENUTZER';

  // ═══════════════════════════════════════════════════════
  // DASHBOARD SEKTIONEN – Untermenü für Projekt-Dashboard
  // ═══════════════════════════════════════════════════════

  // Dashboard-Seite erkennen: Admin über /projekt/[id], User über / oder /dashboard/[id]
  const isDashboardPage = pathname.startsWith('/projekt/') || 
    (pathname.startsWith('/dashboard/') && pathname !== '/dashboard/freigabe') ||
    (session?.user?.role === 'BENUTZER' && pathname === '/');

  // Scroll-Spy: Beobachte welche Sektion gerade sichtbar ist & prüfe auf Existenz
  useEffect(() => {
    if (!isDashboardPage) return;
    if (typeof IntersectionObserver === 'undefined') return;

    let observer: IntersectionObserver | null = null;

    const timer = setTimeout(() => {
      // 1. NEU: DOM-Check - Welche Sektionen existieren wirklich auf der Seite?
      const foundIds = DASHBOARD_SECTIONS
        .map(sec => sec.id)
        .filter(id => document.getElementById(id) !== null);
      
      setAvailableSectionIds(foundIds);

      // 2. Observer aufsetzen (nur für die gefundenen Sektionen)
      try {
        observer = new IntersectionObserver(
          (entries) => {
            const visible = entries
              .filter(e => e.isIntersecting)
              .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
            if (visible.length > 0) {
              setActiveSection(visible[0].target.id);
            }
          },
          { rootMargin: '-80px 0px -50% 0px', threshold: 0.1 }
        );

        foundIds.forEach((id) => {
          const el = document.getElementById(id);
          if (el && observer) observer.observe(el);
        });
      } catch (e) {
        // Silent fail – Sektionen noch nicht im DOM
      }
    }, 1000);

    return () => {
      clearTimeout(timer);
      if (observer) observer.disconnect();
    };
  }, [isDashboardPage, pathname]);

  // Smooth Scroll zu einer Sektion
  const scrollToSection = useCallback((sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSection(sectionId);
    }
  }, []);

  // ═══════════════════════════════════════════════════════
  // LOGO-KONFIGURATION (DATEITAUSCH)
  // ═══════════════════════════════════════════════════════
  // Mandanten-Logo (White Label) bleibt erhalten; ohne Logo erscheint die DataPeak-Marke.
  const tenantLogo = session?.user?.logo_url || null;

  // ═══════════════════════════════════════════════════════
  // EFFEKTE
  // ═══════════════════════════════════════════════════════

  useEffect(() => {
    const checkMaintenanceStatus = async () => {
      if (status !== 'authenticated' || !session?.user) { setIsCheckingMaintenance(false); setIsInMaintenance(false); return; }
      if (session.user.role === 'SUPERADMIN') { setIsCheckingMaintenance(false); setIsInMaintenance(false); return; }
      try {
        const res = await fetch('/api/admin/maintenance?checkSelf=true');
        const data = await res.json();
        setIsInMaintenance(data.isInMaintenance === true);
      } catch (e) { setIsInMaintenance(false); } finally { setIsCheckingMaintenance(false); }
    };
    if (status !== 'loading') checkMaintenanceStatus();
  }, [session, status]);

  useEffect(() => {
    const checkKiToolStatus = async () => {
      if (status !== 'authenticated' || !session?.user) { setKiToolEnabled(true); return; }
      if (session.user.role === 'SUPERADMIN') { setKiToolEnabled(true); return; }
      try {
        const res = await fetch('/api/admin/ki-tool-settings?checkSelf=true');
        const data = await res.json();
        setKiToolEnabled(data.kiToolEnabled !== false);
      } catch (e) { setKiToolEnabled(true); }
    };
    if (status !== 'loading') checkKiToolStatus();
  }, [session, status]);

  useEffect(() => {
    const checkLandingpages = async () => {
      if (status !== 'authenticated' || !session?.user) { setIsCheckingLandingpages(false); setHasLandingpages(false); return; }
      if (session.user.role === 'ADMIN' || session.user.role === 'SUPERADMIN') { setIsCheckingLandingpages(false); setHasLandingpages(true); return; }
      try {
        const res = await fetch('/api/user/has-landingpages');
        const data = await res.json();
        setHasLandingpages(data.hasLandingpages === true);
      } catch (e) { setHasLandingpages(false); } finally { setIsCheckingLandingpages(false); }
    };
    if (status !== 'loading') checkLandingpages();
  }, [session, status]);

  if (pathname === '/login' || isInMaintenance) return null;
  if (isCheckingMaintenance && status === 'authenticated' && session?.user?.role !== 'SUPERADMIN') return null;

  const handleLinkClick = () => setIsMobileMenuOpen(false);
  const shouldShowKiTool = isAdmin && kiToolEnabled;
  const shouldShowRedaktionsplanForUser = isUser && hasLandingpages && !isCheckingLandingpages;

  const mainNavItems: NavItem[] = [
    { href: '/', label: 'Projekte', icon: <Briefcase size={16} />, visible: isAdmin },
    { href: '/', label: 'Dashboard', icon: <Speedometer2 size={16} />, visible: isUser },
    { href: '/admin/redaktionsplan', label: 'Redaktionspläne', icon: <CalendarCheck size={16} />, visible: isAdmin },
    { href: '/dashboard/freigabe', label: 'Redaktionsplan', icon: <CalendarCheck size={16} />, visible: shouldShowRedaktionsplanForUser },
    { href: '/admin/ki-tool', label: 'Content Studio', icon: <Magic size={16} />, visible: shouldShowKiTool },
  ];

  const adminNavItems: NavItem[] = [
    { href: '/admin', label: 'Admin-Bereich', icon: <ShieldLock size={16} />, visible: isAdmin },
    { href: '/admin/system', label: 'System', icon: <HddNetwork size={16} />, visible: isSuperAdmin },
  ];

  const isActive = (href: string): boolean => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(href + '/');
  };

  const visibleSections = DASHBOARD_SECTIONS.filter(section => availableSectionIds.includes(section.id));
  const userLabel = session?.user?.name ?? session?.user?.email ?? '';
  const themeLabel = theme === 'dark' ? 'Heller Modus' : 'Dunkler Modus';

  const groupTitle = (label: string) => (
    <div className="px-3 pt-4 pb-1.5 text-[11px] font-semibold text-muted">{label}</div>
  );

  const renderNavLink = (item: NavItem, index: number, collapsed: boolean) => {
    if (item.visible === false) return null;
    const active = isActive(item.href);
    return (
      <Link
        key={`${item.href}-${index}`}
        href={item.href}
        onClick={handleLinkClick}
        aria-current={active ? 'page' : undefined}
        title={collapsed ? item.label : undefined}
        className={`group flex h-9 items-center gap-2.5 rounded-lg px-3 text-[13px] transition-colors duration-150 ease-out
          ${collapsed ? 'md:justify-center md:px-0' : ''}
          ${active
            ? 'bg-accent-solid font-semibold text-white'
            : 'font-medium text-secondary hover:bg-fill'
          }`}
      >
        <span className={`flex h-4 w-4 flex-shrink-0 items-center justify-center ${active ? 'text-white' : 'text-accent'}`}>
          {item.icon}
        </span>
        <span className={collapsed ? 'md:sr-only' : 'truncate'}>{item.label}</span>
      </Link>
    );
  };

  const renderSections = (onSelect?: () => void) => (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setDashboardSubmenuOpen(!dashboardSubmenuOpen)}
        aria-expanded={dashboardSubmenuOpen}
        className="flex w-full items-center justify-between rounded-lg px-3 pt-4 pb-1.5 text-[11px] font-semibold text-muted hover:text-heading"
      >
        <span>Abschnitte</span>
        {dashboardSubmenuOpen ? <ChevronUp size={11} aria-hidden="true" /> : <ChevronDown size={11} aria-hidden="true" />}
      </button>
      {dashboardSubmenuOpen && (
        <div className="space-y-0.5">
          {visibleSections.map(({ id, label, icon }) => {
            const isActiveSection = activeSection === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => { scrollToSection(id); onSelect?.(); }}
                aria-current={isActiveSection ? 'location' : undefined}
                className={`flex h-8 w-full items-center gap-2.5 rounded-lg px-3 text-left text-[12px] transition-colors duration-150 ease-out
                  ${isActiveSection ? 'bg-accent-tint font-semibold text-accent' : 'font-medium text-muted hover:bg-fill hover:text-heading'}`}
              >
                <span className="flex-shrink-0 text-accent" aria-hidden="true">{icon}</span>
                <span className="truncate">{label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderBrand = (collapsed: boolean) => (
    <Link href="/" onClick={handleLinkClick} className="flex min-w-0 items-center gap-2.5" aria-label="Zur Startseite">
      {tenantLogo ? (
        <span className={`relative block h-[26px] ${collapsed ? 'w-[26px]' : 'w-[150px]'}`}>
          <Image src={tenantLogo} alt="Logo" fill priority className="object-contain object-left" sizes="150px" />
        </span>
      ) : (
        <>
          <span className="flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-[7px] bg-accent-solid text-[11px] font-bold text-white">
            DP
          </span>
          {!collapsed && <span className="truncate text-[15px] font-semibold text-heading">DataPeak</span>}
        </>
      )}
    </Link>
  );

  const iconButton = 'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg transition-colors duration-150 ease-out hover:bg-fill';

  // ═══════════════════════════════════════════════════════
  // DESKTOP SIDEBAR
  // ═══════════════════════════════════════════════════════

  const renderDesktopSidebar = () => (
    <aside
      data-sidebar
      aria-label="Hauptnavigation"
      className={`sticky top-0 hidden h-screen flex-shrink-0 flex-col border-r border-border bg-sidebar transition-[width] duration-200 ease-out md:flex print:hidden
        ${isCollapsed ? 'w-[64px]' : 'w-[232px]'}`}
    >
      <div className={`flex h-14 flex-shrink-0 items-center gap-2 px-4 ${isCollapsed ? 'flex-col justify-center gap-1 px-2 h-auto py-3' : 'justify-between'}`}>
        {renderBrand(isCollapsed)}
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          aria-label={isCollapsed ? 'Seitenleiste ausklappen' : 'Seitenleiste einklappen'}
          aria-expanded={!isCollapsed}
          className={`${iconButton} text-muted`}
        >
          <LayoutSidebarInset size={16} aria-hidden="true" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 pb-3 scrollbar-thin">
        {!isCollapsed && groupTitle('Arbeit')}
        <div className="space-y-0.5">{mainNavItems.map((item, i) => renderNavLink(item, i, isCollapsed))}</div>

        {isDashboardPage && !isCollapsed && visibleSections.length > 0 && renderSections()}

        {adminNavItems.some(item => item.visible !== false) && (
          <>
            {isCollapsed ? <div className="mx-3 my-3 h-px bg-border-subtle" /> : groupTitle('Verwaltung')}
            <div className="space-y-0.5">{adminNavItems.map((item, i) => renderNavLink(item, i, isCollapsed))}</div>
          </>
        )}
      </nav>

      <div className={`flex flex-shrink-0 items-center gap-2.5 border-t border-border px-3 py-3 ${isCollapsed ? 'flex-col' : ''}`}>
        {status === 'authenticated' && session?.user ? (
          <>
            <span
              className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full bg-accent-tint text-[11px] font-bold text-accent"
              title={session.user.email ?? undefined}
              aria-hidden="true"
            >
              {initials(userLabel)}
            </span>
            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold text-heading">{userLabel}</div>
                <div className="truncate text-[11px] text-muted">{roleLabel(session.user.role)}</div>
              </div>
            )}
            <button type="button" onClick={toggleTheme} aria-label={themeLabel} title={themeLabel} className={`${iconButton} text-muted hover:text-heading`}>
              {theme === 'dark' ? <SunFill size={16} aria-hidden="true" /> : <MoonStarsFill size={16} aria-hidden="true" />}
            </button>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: '/login' })}
              aria-label="Abmelden"
              title="Abmelden"
              className={`${iconButton} text-danger`}
            >
              <BoxArrowRight size={16} aria-hidden="true" />
            </button>
          </>
        ) : (
          <>
            <Link href="/login" className="flex h-9 flex-1 items-center gap-2.5 rounded-lg px-3 text-[13px] font-medium text-accent hover:bg-fill">
              <BoxArrowInRight size={16} aria-hidden="true" />
              {!isCollapsed && <span>Anmelden</span>}
            </Link>
            <button type="button" onClick={toggleTheme} aria-label={themeLabel} title={themeLabel} className={`${iconButton} text-muted hover:text-heading`}>
              {theme === 'dark' ? <SunFill size={16} aria-hidden="true" /> : <MoonStarsFill size={16} aria-hidden="true" />}
            </button>
          </>
        )}
      </div>
    </aside>
  );

  // ═══════════════════════════════════════════════════════
  // MOBILE HEADER
  // ═══════════════════════════════════════════════════════

  const renderMobileHeader = () => (
    <header className="relative border-b border-border bg-sidebar md:hidden print:hidden">
      <div className="flex h-14 items-center justify-between px-4">
        {renderBrand(false)}
        <div className="flex items-center gap-1">
          <button type="button" onClick={toggleTheme} aria-label={themeLabel} className={`${iconButton} text-muted`}>
            {theme === 'dark' ? <SunFill size={18} aria-hidden="true" /> : <MoonStarsFill size={18} aria-hidden="true" />}
          </button>
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label={isMobileMenuOpen ? 'Menü schließen' : 'Menü öffnen'}
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-navigation"
            className={`${iconButton} text-heading`}
          >
            {isMobileMenuOpen ? <X size={22} aria-hidden="true" /> : <List size={22} aria-hidden="true" />}
          </button>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-[var(--dp-surface-overlay)] md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}
      {isMobileMenuOpen && status === 'authenticated' && (
        <nav
          id="mobile-navigation"
          aria-label="Hauptnavigation"
          className="absolute left-0 top-full z-50 max-h-[80vh] w-full overflow-y-auto border-b border-border bg-sidebar px-3 pb-4"
        >
          {groupTitle('Arbeit')}
          <div className="space-y-0.5">{mainNavItems.map((item, i) => renderNavLink(item, i, false))}</div>

          {isDashboardPage && visibleSections.length > 0 && renderSections(() => setIsMobileMenuOpen(false))}

          {adminNavItems.some(item => item.visible !== false) && (
            <>
              {groupTitle('Verwaltung')}
              <div className="space-y-0.5">{adminNavItems.map((item, i) => renderNavLink(item, i, false))}</div>
            </>
          )}

          <div className="mt-3 flex items-center gap-2.5 border-t border-border pt-3">
            <span className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full bg-accent-tint text-[11px] font-bold text-accent" aria-hidden="true">
              {initials(userLabel)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold text-heading">{userLabel}</div>
              <div className="truncate text-[11px] text-muted">{roleLabel(session?.user?.role)}</div>
            </div>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="flex h-9 items-center gap-2 rounded-lg px-3 text-[13px] font-medium text-danger hover:bg-fill"
            >
              <BoxArrowRight size={16} aria-hidden="true" /> Abmelden
            </button>
          </div>
        </nav>
      )}
    </header>
  );

  return (
    <>
      {renderDesktopSidebar()}
      {renderMobileHeader()}
    </>
  );
}
