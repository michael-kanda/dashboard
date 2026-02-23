// src/components/layout/Sidebar.tsx
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import NotificationBell from '@/components/NotificationBell';
import { useTheme } from '@/components/ThemeProvider';
import { useState, useEffect, useCallback } from 'react';
import { 
  List, X, Briefcase, CalendarCheck, ShieldLock, Speedometer2, 
  BoxArrowRight, BoxArrowInRight, HddNetwork, Magic,
  ChevronLeft, ChevronRight, SunFill, MoonStarsFill,
  ChevronDown, ChevronUp,
  BarChartFill, GraphUpArrow, Robot, FileEarmarkText, PieChartFill, Search
} from 'react-bootstrap-icons';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  visible?: boolean;
  className?: string;
}

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

  const dashboardSections = [
    { id: 'section-kpis',         label: 'Traffic & Reichweite',  icon: <BarChartFill size={13} /> },
    { id: 'section-verlauf',      label: 'Verlauf & Analyse',     icon: <GraphUpArrow size={13} /> },
    { id: 'section-ki-traffic',   label: 'KI-Traffic',            icon: <Robot size={13} /> },
    { id: 'section-landingpages', label: 'Top Landingpages',      icon: <FileEarmarkText size={13} /> },
    { id: 'section-zugriffe',     label: 'Zugriffe nach Quelle',  icon: <PieChartFill size={13} /> },
    { id: 'section-semrush',      label: 'Semrush Keywords',      icon: <Search size={13} /> },
  ];

  // Scroll-Spy: Beobachte welche Sektion gerade sichtbar ist
  useEffect(() => {
    if (!isDashboardPage) return;
    if (typeof IntersectionObserver === 'undefined') return;

    let observer: IntersectionObserver | null = null;

    const timer = setTimeout(() => {
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

        dashboardSections.forEach(({ id }) => {
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
  const logoLight = "/logo-data-peak.webp"; // Pfad für helles Theme
  const logoDark = "/logo-data-peak-dark.webp";  // Hier den Pfad zum Dark-Logo eintragen (z.B. -white.webp)
  
  // Wählt das Logo basierend auf Theme oder User-Upload
  const systemLogo = theme === 'dark' ? logoDark : logoLight;
  const logoSrc = session?.user?.logo_url || systemLogo;
  const priorityLoad = true;

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
    { href: '/', label: 'Projekte', icon: <Briefcase size={18} />, visible: isAdmin },
    { href: '/', label: 'Dashboard', icon: <Speedometer2 size={18} />, visible: isUser },
    { href: '/admin/redaktionsplan', label: 'Redaktionspläne', icon: <CalendarCheck size={18} />, visible: isAdmin },
    { href: '/dashboard/freigabe', label: 'Redaktionsplan', icon: <CalendarCheck size={18} />, visible: shouldShowRedaktionsplanForUser },
    { href: '/admin/ki-tool', label: 'KI Tool', icon: <Magic size={18} />, visible: shouldShowKiTool },
  ];

  const adminNavItems: NavItem[] = [
    { href: '/admin', label: 'Admin-Bereich', icon: <ShieldLock size={18} />, visible: isAdmin },
    { href: '/admin/system', label: 'System', icon: <HddNetwork size={18} />, visible: isSuperAdmin, className: 'text-indigo-600 dark:text-indigo-400' },
  ];

  const isActive = (href: string): boolean => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(href + '/');
  };

  const renderNavLink = (item: NavItem, index: number) => {
    if (item.visible === false) return null;
    const active = isActive(item.href);
    return (
      <Link key={`${item.href}-${index}`} href={item.href} onClick={handleLinkClick}
        title={isCollapsed ? item.label : undefined}
        className={`
          group relative flex items-center gap-3 px-3 py-2.5 rounded-xl
          transition-all duration-150 text-sm font-medium
          ${active
            ? 'bg-indigo-50 text-indigo-700 shadow-sm dark:bg-indigo-500/15 dark:text-indigo-300'
            : 'text-muted hover:bg-surface-secondary hover:text-heading dark:hover:bg-white/5'
          }
          ${item.className || ''}
        `}
      >
        <span className={`flex-shrink-0 flex items-center justify-center w-5 h-5 ${active ? 'text-indigo-600 dark:text-indigo-400' : ''}`}>
          {item.icon}
        </span>
        <span className={`whitespace-nowrap transition-all duration-200 ${isCollapsed ? 'md:opacity-0 md:w-0 md:overflow-hidden' : 'opacity-100'}`}>
          {item.label}
        </span>
        {isCollapsed && (
          <span className="hidden md:group-hover:flex absolute left-full ml-3 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-xs font-medium px-3 py-1.5 rounded-lg whitespace-nowrap shadow-lg z-[100] pointer-events-none after:content-[''] after:absolute after:right-full after:top-1/2 after:-translate-y-1/2 after:border-[5px] after:border-transparent after:border-r-gray-900">
            {item.label}
          </span>
        )}
      </Link>
    );
  };

  const renderMobileNavLink = (item: NavItem, index: number) => {
    if (item.visible === false) return null;
    const active = isActive(item.href);
    return (
      <Link key={`mobile-${item.href}-${index}`} href={item.href} passHref onClick={handleLinkClick}>
        <button className={`
          w-full flex items-center justify-start gap-2 px-4 py-2.5 rounded-lg
          text-sm font-medium transition-all
          ${active
            ? 'bg-indigo-600 text-white shadow-sm'
            : 'bg-surface text-body border border-theme-border-default hover:bg-surface-secondary'
          }
          ${item.className || ''}
        `}>
          {item.icon}
          {item.label}
        </button>
      </Link>
    );
  };

  const renderThemeToggle = () => (
    <button onClick={toggleTheme}
      className="group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 text-sm font-medium text-muted hover:bg-surface-secondary hover:text-heading dark:hover:bg-white/5 w-full"
    >
      <span className="flex-shrink-0 flex items-center justify-center w-5 h-5">
        {theme === 'dark' ? <SunFill size={18} /> : <MoonStarsFill size={18} />}
      </span>
      <span className={`whitespace-nowrap transition-all duration-200 ${isCollapsed ? 'md:opacity-0 md:w-0 md:overflow-hidden' : 'opacity-100'}`}>
        {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
      </span>
    </button>
  );

  // ═══════════════════════════════════════════════════════
  // DESKTOP SIDEBAR
  // ═══════════════════════════════════════════════════════

  const renderDesktopSidebar = () => (
    <aside data-sidebar className={`
      hidden md:flex flex-col sidebar-bg border-r border-theme-border-default
      transition-all duration-200 ease-in-out relative flex-shrink-0 sticky top-0 h-screen
      ${isCollapsed ? 'w-[72px]' : 'w-[260px]'}
    `}>
      <button onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-[28px] z-50 w-6 h-6 sidebar-bg border border-theme-border-default rounded-full flex items-center justify-center shadow-sm hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-500 transition-all duration-150 text-faint hover:text-indigo-600"
      >
        {isCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>

      {/* Logo Bereich */}
      <div className="flex items-center h-[80px] px-4 border-b border-theme-border-subtle flex-shrink-0">
        <Link href="/" onClick={handleLinkClick} className="flex items-center justify-center w-full">
          <div className={`relative h-[50px] transition-all duration-200 ${isCollapsed ? 'w-[40px]' : 'w-full'}`}>
            <Image 
              src={logoSrc} 
              alt="Dashboard Logo" 
              fill 
              priority={priorityLoad}
              onError={(e) => { 
                const target = e.target as HTMLImageElement;
                if (logoSrc !== logoLight) target.src = logoLight; 
              }}
              className="object-contain transition-all duration-300"
              sizes={isCollapsed ? "40px" : "240px"} 
            />
          </div>
        </Link>
      </div>

      {status === 'authenticated' && session?.user && (
        <div className="flex items-center gap-3 px-4 py-3 border-b border-theme-border-subtle flex-shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-500/20 dark:to-teal-500/20 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center flex-shrink-0 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
            {(session.user.name || session.user.email || '?').charAt(0).toUpperCase()}
          </div>
          {!isCollapsed && (
            <div className="overflow-hidden">
              <div className="text-sm font-semibold text-theme-heading truncate">
                {session.user?.name ?? session.user?.email}
              </div>
              <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                {isAdmin && <ShieldLock size={9} />}
                <span>{session.user.role}</span>
              </div>
            </div>
          )}
        </div>
      )}

      <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-1 scrollbar-thin">
        {!isCollapsed && <div className="px-3 pt-2 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-faint">Navigation</div>}
        {mainNavItems.map((item, i) => renderNavLink(item, i))}
        
        {/* ── Dashboard Sektions-Untermenü ── */}
        {isDashboardPage && !isCollapsed && (
          <div className="ml-3 mt-1">
            <button 
              onClick={() => setDashboardSubmenuOpen(!dashboardSubmenuOpen)}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-faint hover:text-muted transition-colors"
            >
              <span>Sektionen</span>
              {dashboardSubmenuOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            </button>
            {dashboardSubmenuOpen && (
              <div className="space-y-0.5 mt-0.5">
                {dashboardSections.map(({ id, label, icon }) => {
                  const isActiveSection = activeSection === id;
                  return (
                    <button
                      key={id}
                      onClick={() => scrollToSection(id)}
                      className={`
                        flex items-center gap-2.5 w-full px-3 py-1.5 rounded-lg text-xs
                        transition-all duration-200 text-left relative
                        ${isActiveSection
                          ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300 font-semibold'
                          : 'text-faint hover:bg-surface-secondary hover:text-body dark:hover:bg-white/5 font-medium'
                        }
                      `}
                    >
                      {isActiveSection && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full bg-indigo-500 dark:bg-indigo-400" />
                      )}
                      <span className={`flex-shrink-0 ${isActiveSection ? 'text-indigo-500 dark:text-indigo-400' : ''}`}>{icon}</span>
                      <span className="truncate">{label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
        
        {adminNavItems.some(item => item.visible !== false) && (
          <>
            {!isCollapsed && <div className="px-3 pt-5 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-faint">Administration</div>}
            {isCollapsed && <div className="my-2 mx-3 h-px bg-theme-border-subtle" />}
            {adminNavItems.map((item, i) => renderNavLink(item, i))}
          </>
        )}

        <div className="my-2 mx-3 h-px bg-theme-border-subtle" />
        <div className="relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 text-sm font-medium text-muted hover:bg-surface-secondary hover:text-heading dark:hover:bg-white/5">
          <NotificationBell />
          {!isCollapsed && <span className="whitespace-nowrap">Benachrichtigungen</span>}
        </div>
        {renderThemeToggle()}
      </nav>

      <div className="px-2.5 py-3 border-t border-theme-border-subtle flex-shrink-0">
        {status === 'authenticated' ? (
          <button onClick={() => signOut({ callbackUrl: '/login' })}
            className="group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
          >
            <BoxArrowRight size={18} className="flex-shrink-0" />
            {!isCollapsed && <span>Abmelden</span>}
          </button>
        ) : (
          <Link href="/login" className="group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400">
            <BoxArrowInRight size={18} className="flex-shrink-0" />
            {!isCollapsed && <span>Anmelden</span>}
          </Link>
        )}
      </div>
    </aside>
  );

  // ═══════════════════════════════════════════════════════
  // MOBILE HEADER
  // ═══════════════════════════════════════════════════════

  const renderMobileHeader = () => (
    <header className="md:hidden sidebar-bg shadow-md relative print:hidden">
      <nav className="w-full px-6 py-3 flex justify-between items-center">
        <Link href="/" onClick={handleLinkClick}>
          <div className="relative h-[45px] w-[180px]">
            <Image 
              src={logoSrc} 
              alt="Dashboard Logo" 
              fill 
              priority={priorityLoad}
              onError={(e) => { 
                const target = e.target as HTMLImageElement;
                if (logoSrc !== logoLight) target.src = logoLight; 
              }}
              className="object-contain transition-all duration-300" 
              sizes="180px" 
            />
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <button onClick={toggleTheme} className="p-2 text-muted">
            {theme === 'dark' ? <SunFill size={18} /> : <MoonStarsFill size={18} />}
          </button>
          {status === 'authenticated' && <NotificationBell />}
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-secondary">
            {isMobileMenuOpen ? <X size={28} /> : <List size={28} />}
          </button>
        </div>
      </nav>

      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40 md:hidden backdrop-blur-[1px]"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}
      {isMobileMenuOpen && status === 'authenticated' && (
        <div className="absolute top-full left-0 w-full sidebar-bg shadow-xl border-t border-theme-border-subtle z-50 p-4 flex flex-col gap-2 max-h-[80vh] overflow-y-auto">
          {mainNavItems.map((item, i) => renderMobileNavLink(item, i))}
          
          {/* Mobile: Dashboard Sektionen */}
          {isDashboardPage && (
            <div className="space-y-1 ml-2 mt-1 mb-1">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-faint px-2">Sektionen</div>
              {dashboardSections.map(({ id, label, icon }) => (
                <button
                  key={id}
                  onClick={() => { scrollToSection(id); setIsMobileMenuOpen(false); }}
                  className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-medium transition-all
                    ${activeSection === id
                      ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300'
                      : 'text-muted hover:bg-surface-secondary dark:hover:bg-white/5'}`}
                >
                  {icon}
                  <span>{label}</span>
                </button>
              ))}
            </div>
          )}
          
          {adminNavItems.map((item, i) => renderMobileNavLink(item, i))}
          <hr className="my-2 border-theme-border-default" />
          <button className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-surface text-body border border-theme-border-default"
            onClick={() => signOut({ callbackUrl: '/login' })}>
            <BoxArrowRight size={16} /> Abmelden
          </button>
        </div>
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
