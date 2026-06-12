import { useState, useEffect } from 'react';
import {
  collection, getDocs, addDoc, doc, getDoc, setDoc,
} from 'firebase/firestore';
import { Users as UsersIcon, Shield, User, ShieldCheck, Plus, Mail, List } from 'lucide-react';
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
  allowedSmtpIds?: string[];
  visibleListIds?: string[];
}

interface SmtpAccount {
  id: string;
  name: string;
  username: string;
}

interface ContactList {
  id: string;
  name: string;
}

export default function UsersPage() {
  const { t, lang } = useI18n();
  const { userRole } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [accounts, setAccounts] = useState<SmtpAccount[]>([]);
  const [lists, setLists] = useState<ContactList[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editUser, setEditUser] = useState<AppUser | null>(null);
  const [form, setForm] = useState({ email: '', password: '', role: 'sender' as 'admin' | 'sender', allowedSmtpIds: [] as string[], visibleListIds: [] as string[] });

  const load = async () => {
    setLoading(true);
    try {
      const [uSnap, aSnap, lSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'smtpAccounts')),
        getDocs(collection(db, 'contactLists')),
      ]);
      setUsers(uSnap.docs.map((d) => ({ id: d.id, ...d.data() } as AppUser)));
      setAccounts(aSnap.docs.map((d) => ({ id: d.id, ...d.data() } as SmtpAccount)));
      setLists(lSnap.docs.map((d) => ({ id: d.id, ...d.data() } as ContactList)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleAddUser = async () => {
    if (!form.email || !form.password) { toast.error(t('required')); return; }
    try {
      const data = await apiClient.createUser({ email: form.email, password: form.password, role: form.role, allowedSmtpIds: form.allowedSmtpIds, visibleListIds: form.visibleListIds });
      if (data.success) {
        toast.success(t('userAdded'));
        setModalOpen(false);
        setForm({ email: '', password: '', role: 'sender', allowedSmtpIds: [], visibleListIds: [] });
        load();
      } else {
        toast.error(data.error || t('error'));
      }
    } catch {
      toast.error(t('error'));
    }
  };

  const openEdit = (u: AppUser) => {
    setEditUser(u);
    setForm({ email: u.email, password: '', role: u.role, allowedSmtpIds: u.allowedSmtpIds || [], visibleListIds: u.visibleListIds || [] });
    setModalOpen(true);
  };

  const handleEditSave = async () => {
    if (!editUser) return;
    try {
      await setDoc(doc(db, 'users', editUser.id), {
        email: form.email,
        role: form.role,
        allowedSmtpIds: form.allowedSmtpIds,
        visibleListIds: form.visibleListIds,
        createdAt: editUser.createdAt,
      }, { merge: true });
      toast.success(t('success'));
      setModalOpen(false);
      setEditUser(null);
      setForm({ email: '', password: '', role: 'sender', allowedSmtpIds: [], visibleListIds: [] });
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const toggleSmtpId = (id: string) => {
    setForm(f => ({
      ...f,
      allowedSmtpIds: f.allowedSmtpIds.includes(id)
        ? f.allowedSmtpIds.filter(i => i !== id)
        : [...f.allowedSmtpIds, id],
    }));
  };

  const toggleListId = (id: string) => {
    setForm(f => ({
      ...f,
      visibleListIds: f.visibleListIds.includes(id)
        ? f.visibleListIds.filter(i => i !== id)
        : [...f.visibleListIds, id],
    }));
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
        <button onClick={() => { setEditUser(null); setForm({ email: '', password: '', role: 'sender', allowedSmtpIds: [], visibleListIds: [] }); setModalOpen(true); }} className="btn-primary flex items-center gap-2">
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
                  <th className="table-header">{t('smtpAccounts')}</th>
                  <th className="table-header">{t('contactLists')}</th>
                  <th className="table-header">{t('createdByAdmin')}</th>
                  <th className="table-header">{t('actions')}</th>
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
                      {u.allowedSmtpIds?.length
                        ? accounts.filter(a => u.allowedSmtpIds?.includes(a.id)).map(a => a.name).join(', ') || '-'
                        : t('all')}
                    </td>
                    <td className="table-cell text-xs text-gray-500">
                      {u.visibleListIds?.length
                        ? lists.filter(l => u.visibleListIds?.includes(l.id)).map(l => l.name).join(', ') || '-'
                        : t('all')}
                    </td>
                    <td className="table-cell text-xs text-gray-500">
                      {new Date(u.createdAt || Date.now()).toLocaleString()}
                    </td>
                    <td className="table-cell">
                      <button onClick={() => openEdit(u)} className="btn-secondary text-xs px-2 py-1">{t('edit')}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editUser ? t('edit') : t('addUser')}>
        <div className="space-y-4">
          <p className="text-sm text-gray-500 mb-4">{t('onlyAdminCanAdd')}</p>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">{t('userEmail')}</label>
            <input className="input-field" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={!!editUser} />
          </div>
          {!editUser && (
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">{t('tempPassword')}</label>
              <input className="input-field" type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={t('tempPassword')} />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">{t('userRole')}</label>
            <select className="input-field" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as 'admin' | 'sender' })}>
              <option value="sender">{t('sender')}</option>
              <option value="admin">{t('admin')}</option>
            </select>
          </div>

          <div className="border-t border-dark-700 pt-4">
            <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2"><Mail className="w-4 h-4" /> {t('smtpAccounts')}</h4>
            {accounts.length === 0 ? (
              <p className="text-xs text-gray-500">{t('noAccounts')}</p>
            ) : (
              <div className="space-y-1 max-h-[150px] overflow-y-auto">
                {accounts.map(a => (
                  <label key={a.id} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer p-1 rounded hover:bg-dark-700/50">
                    <input type="checkbox" checked={form.allowedSmtpIds.includes(a.id)} onChange={() => toggleSmtpId(a.id)} className="rounded bg-dark-700 border-dark-400" />
                    {a.name} ({a.username})
                  </label>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-600 mt-1">{t('smtpPermissionsHint')}</p>
          </div>

          <div className="border-t border-dark-700 pt-4">
            <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2"><List className="w-4 h-4" /> {t('contactLists')}</h4>
            {lists.length === 0 ? (
              <p className="text-xs text-gray-500">{t('noLists')}</p>
            ) : (
              <div className="space-y-1 max-h-[150px] overflow-y-auto">
                {lists.map(l => (
                  <label key={l.id} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer p-1 rounded hover:bg-dark-700/50">
                    <input type="checkbox" checked={form.visibleListIds.includes(l.id)} onChange={() => toggleListId(l.id)} className="rounded bg-dark-700 border-dark-400" />
                    {l.name}
                  </label>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-600 mt-1">{t('listPermissionsHint')}</p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => setModalOpen(false)} className="btn-secondary">{t('cancel')}</button>
            <button onClick={editUser ? handleEditSave : handleAddUser} className="btn-primary">{t('save')}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
