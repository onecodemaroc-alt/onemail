import { useState, useEffect } from 'react';
import {
  collection, getDocs, addDoc, doc, getDoc, setDoc,
} from 'firebase/firestore';
import { Users as UsersIcon, Shield, User, ShieldCheck, Plus } from 'lucide-react';
import { db } from '../lib/firebase';
import { apiClient } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';

interface AppUser {
  id: string;
  email: string;
  role: 'admin' | 'sender';
  createdAt: string;
}

export default function UsersPage() {
  const { t, lang } = useI18n();
  const { userRole } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', role: 'sender' as 'admin' | 'sender' });

  const load = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'users'));
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AppUser)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleAddUser = async () => {
    if (!form.email || !form.password) { toast.error(t('required')); return; }
    try {
      const data = await apiClient.createUser({ email: form.email, password: form.password, role: form.role });
      if (data.success) {
        toast.success(t('userAdded'));
        setModalOpen(false);
        setForm({ email: '', password: '', role: 'sender' });
        load();
      } else {
        toast.error(data.error || t('error'));
      }
    } catch {
      toast.error(t('error'));
    }
  };

  if (userRole !== 'admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">{t('onlyAdminCanAdd')}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">{t('manageUsers')}</h1>
        <button onClick={() => setModalOpen(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> {t('addUser')}
        </button>
      </div>

      {users.length === 0 ? (
        <div className="card text-center py-12">
          <UsersIcon className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500">{t('noUsers')}</p>
          <button onClick={() => setModalOpen(true)} className="btn-primary mt-4">{t('addFirstUser')}</button>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-700 bg-dark-800">
                  <th className="table-header">{t('email')}</th>
                  <th className="table-header">{t('userRole')}</th>
                  <th className="table-header">{t('createdByAdmin')}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-dark-700 hover:bg-dark-700/50">
                    <td className="table-cell font-medium text-gray-100">{u.email}</td>
                    <td className="table-cell">
                      <span className={`badge ${u.role === 'admin' ? 'badge-info' : 'badge-success'}`}>
                        <div className="flex items-center gap-1">
                          {u.role === 'admin' ? <Shield className="w-3 h-3" /> : <User className="w-3 h-3" />}
                          {t(u.role)}
                        </div>
                      </span>
                    </td>
                    <td className="table-cell text-xs text-gray-500">
                      {new Date(u.createdAt || Date.now()).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t('addUser')}>
        <div className="space-y-4">
          <p className="text-sm text-gray-500 mb-4">{t('onlyAdminCanAdd')}</p>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">{t('userEmail')}</label>
            <input className="input-field" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">{t('tempPassword')}</label>
            <input className="input-field" type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={t('tempPassword')} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">{t('userRole')}</label>
            <select className="input-field" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as 'admin' | 'sender' })}>
              <option value="sender">{t('sender')}</option>
              <option value="admin">{t('admin')}</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => setModalOpen(false)} className="btn-secondary">{t('cancel')}</button>
            <button onClick={handleAddUser} className="btn-primary">{t('add')}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
