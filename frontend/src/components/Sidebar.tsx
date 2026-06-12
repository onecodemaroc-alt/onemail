import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  FileText,
  Send,
  Mail,
  ScrollText,
  Shield,
  LogOut,
  Languages,
  Inbox,
  PenSquare,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../i18n/I18nContext';

export default function Sidebar() {
  const { logout, userRole, sidebarPages } = useAuth();
  const { t, lang, setLang, dir } = useI18n();

  const canShow = (page: string) => sidebarPages.length === 0 || sidebarPages.includes(page);

  return (
    <aside className={`fixed top-0 ${dir === 'rtl' ? 'right-0' : 'left-0'} h-full w-64 bg-dark-800 border-${dir === 'rtl' ? 'left' : 'right'} border-dark-700 flex flex-col z-50`}>
      <div className="p-6 border-b border-dark-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center">
            <Mail className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">OneMail</h1>
            <p className="text-xs text-gray-500">{t('campaigns')}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {canShow('dashboard') && (
        <NavLink to="/" end className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <LayoutDashboard className="w-5 h-5" />
          <span>{t('dashboard')}</span>
        </NavLink>
        )}
        {canShow('contacts') && (
        <NavLink to="/contacts" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <Users className="w-5 h-5" />
          <span>{t('contacts')}</span>
        </NavLink>
        )}
        {canShow('templates') && (
        <NavLink to="/templates" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <FileText className="w-5 h-5" />
          <span>{t('templates')}</span>
        </NavLink>
        )}
        {canShow('compose') && (
        <NavLink to="/compose" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <PenSquare className="w-5 h-5" />
          <span>{t('compose')}</span>
        </NavLink>
        )}
        {canShow('campaigns') && (
        <NavLink to="/campaigns" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <Send className="w-5 h-5" />
          <span>{t('campaigns')}</span>
        </NavLink>
        )}
        {canShow('smtp') && (
        <NavLink to="/smtp" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <Mail className="w-5 h-5" />
          <span>{t('smtpAccounts')}</span>
        </NavLink>
        )}
        {canShow('inbox') && (
        <NavLink to="/inbox" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <Inbox className="w-5 h-5" />
          <span>{t('inbox')}</span>
        </NavLink>
        )}
        {canShow('logs') && (
        <NavLink to="/logs" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <ScrollText className="w-5 h-5" />
          <span>{t('logs')}</span>
        </NavLink>
        )}
        {userRole === 'admin' && (
          <NavLink to="/users" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <Shield className="w-5 h-5" />
            <span>{t('users')}</span>
          </NavLink>
        )}
      </nav>

      <div className="p-4 border-t border-dark-700 space-y-2">
        <button
          onClick={() => setLang(lang === 'ar' ? 'fr' : 'ar')}
          className="sidebar-link w-full"
        >
          <Languages className="w-5 h-5" />
          <span>{lang === 'ar' ? 'Français' : 'العربية'}</span>
        </button>
        <button onClick={logout} className="sidebar-link w-full text-red-400 hover:text-red-300">
          <LogOut className="w-5 h-5" />
          <span>{t('logout')}</span>
        </button>
      </div>
    </aside>
  );
}
