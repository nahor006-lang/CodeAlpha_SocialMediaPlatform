import { motion } from 'motion/react';
import { User } from '../types';
import { Home, User as UserIcon, LogOut, PenSquare, Search, Compass } from 'lucide-react';
import logoUrl from '../assets/logo.svg';

interface NavigationProps {
  currentUser: User | null;
  currentView: string;
  onNavigate: (view: string, data?: any) => void;
  onLogout: () => void;
  onOpenCompose: () => void;
}

export default function Navigation({
  currentUser,
  currentView,
  onNavigate,
  onLogout,
  onOpenCompose
}: NavigationProps) {
  return (
    <>
      {/* Desktop Left Sidebar / Navigation - Visible on md screens and up */}
      <aside className="hidden md:flex flex-col justify-between w-64 h-screen sticky top-0 py-8 px-6 border-r border-ink/5 bg-cream/20">
        <div className="space-y-8">
          {/* Logo */}
          <div 
            onClick={() => onNavigate('feed')}
            className="flex items-center gap-2.5 cursor-pointer hover:opacity-95 transition-opacity"
          >
            <img src={logoUrl} className="w-8.5 h-8.5 object-contain" alt="Knot Logo" />
            <span className="font-display font-bold text-2xl tracking-tight text-ink">Knot</span>
          </div>

          {/* Nav Items */}
          <nav className="flex flex-col gap-2">
            <button
              id="nav-home-desktop-btn"
              onClick={() => onNavigate('feed')}
              className={`flex items-center gap-3.5 px-4 py-3 rounded-2xl text-sm font-semibold tracking-tight transition-all ${
                currentView === 'feed'
                  ? 'bg-crimson/10 text-crimson font-bold'
                  : 'text-sage hover:text-ink hover:bg-white/50'
              }`}
            >
              <Home className="w-5 h-5" />
              <span>Home Feed</span>
            </button>

            {currentUser && (
              <>
                <button
                  id="nav-profile-desktop-btn"
                  onClick={() => onNavigate('profile', currentUser.username)}
                  className={`flex items-center gap-3.5 px-4 py-3 rounded-2xl text-sm font-semibold tracking-tight transition-all ${
                    currentView === 'profile'
                      ? 'bg-crimson/10 text-crimson font-bold'
                      : 'text-sage hover:text-ink hover:bg-white/50'
                  }`}
                >
                  <UserIcon className="w-5 h-5" />
                  <span>My Profile</span>
                </button>

                <button
                  id="nav-compose-desktop-btn"
                  onClick={onOpenCompose}
                  className="flex items-center gap-3.5 px-4 py-3 rounded-2xl text-sm font-semibold tracking-tight text-sage hover:text-ink hover:bg-white/50 transition-all"
                >
                  <PenSquare className="w-5 h-5" />
                  <span>Compose Knot</span>
                </button>
              </>
            )}
          </nav>
        </div>

        {/* User Card at Bottom of Desktop Sidebar */}
        <div className="border-t border-ink/5 pt-6 space-y-4">
          {currentUser ? (
            <div className="flex items-center justify-between gap-2.5">
              <div 
                onClick={() => onNavigate('profile', currentUser.username)}
                className="flex items-center gap-2.5 cursor-pointer group"
              >
                <div className="w-9 h-9 rounded-full bg-crimson/5 border border-crimson/20 flex items-center justify-center text-crimson font-bold text-sm overflow-hidden transition-transform group-hover:scale-105">
                  {currentUser.profile_picture ? (
                    <img referrerPolicy="no-referrer" src={currentUser.profile_picture} alt={currentUser.display_name} className="w-full h-full object-cover" />
                  ) : (
                    currentUser.display_name.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="leading-tight">
                  <h4 className="text-sm font-bold text-ink truncate max-w-27.5">{currentUser.display_name}</h4>
                  <p className="text-xs text-sage truncate max-w-27.5">@{currentUser.username}</p>
                </div>
              </div>
              <button
                id="nav-logout-desktop-btn"
                onClick={onLogout}
                title="Log Out"
                className="p-2 text-sage hover:text-crimson hover:bg-crimson/5 rounded-lg transition-colors"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <button
              id="nav-signin-desktop-btn"
              onClick={() => onNavigate('auth')}
              className="w-full py-2.5 bg-crimson text-white text-sm font-bold rounded-xl shadow hover:bg-crimson/95 transition-all text-center"
            >
              Sign In
            </button>
          )}
        </div>
      </aside>

      {/* Mobile / Tablet Header - Visible on screen sizes below md */}
      <header className="md:hidden flex items-center justify-between px-5 py-4 border-b border-ink/5 bg-cream/80 backdrop-blur sticky top-0 z-40">
        <div 
          onClick={() => onNavigate('feed')}
          className="flex items-center gap-2 cursor-pointer"
        >
          <img src={logoUrl} className="w-7 h-7 object-contain" alt="Knot Logo" />
          <span className="font-display font-bold text-xl tracking-tight text-ink">Knot</span>
        </div>

        <div className="flex items-center gap-2">
          {currentUser ? (
            <button
              id="nav-logout-mobile-btn"
              onClick={onLogout}
              className="p-1.5 text-sage hover:text-crimson transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          ) : (
            <button
              id="nav-signin-mobile-btn"
              onClick={() => onNavigate('auth')}
              className="px-3.5 py-1.5 bg-crimson text-white text-xs font-bold rounded-full hover:bg-crimson/95 transition-all"
            >
              Sign In
            </button>
          )}
        </div>
      </header>

      {/* Mobile Floating Bottom Bar - Visible on screen sizes below md */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white/90 backdrop-blur border-t border-ink/5 flex items-center justify-around px-4 pb-safe z-40 shadow-[0_-1px_3px_rgba(0,0,0,0.02)]">
        <button
          id="nav-home-mobile-btn"
          onClick={() => onNavigate('feed')}
          className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-all ${
            currentView === 'feed' ? 'text-crimson' : 'text-sage'
          }`}
        >
          <Home className="w-5.5 h-5.5" />
        </button>

        {currentUser && (
          <button
            id="nav-compose-mobile-btn"
            onClick={onOpenCompose}
            className="flex items-center justify-center w-11 h-11 rounded-full bg-crimson text-white shadow-sm active:scale-95 transition-all"
          >
            <PenSquare className="w-5 h-5" />
          </button>
        )}

        {currentUser ? (
          <button
            id="nav-profile-mobile-btn"
            onClick={() => onNavigate('profile', currentUser.username)}
            className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-all ${
              currentView === 'profile' ? 'text-crimson' : 'text-sage'
            }`}
          >
            <UserIcon className="w-5.5 h-5.5" />
          </button>
        ) : (
          <button
            id="nav-auth-mobile-btn"
            onClick={() => onNavigate('auth')}
            className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-all ${
              currentView === 'auth' ? 'text-crimson' : 'text-sage'
            }`}
          >
            <UserIcon className="w-5.5 h-5.5" />
          </button>
        )}
      </nav>
    </>
  );
}
