import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useI18n } from '../i18n/I18nContext';

export default function Layout() {
  const { dir } = useI18n();

  return (
    <div className="flex h-screen bg-dark-900">
      <Sidebar />
      <main className={`flex-1 overflow-auto p-6 ${dir === 'rtl' ? 'mr-64' : 'ml-64'}`}>
        <Outlet />
      </main>
    </div>
  );
}
