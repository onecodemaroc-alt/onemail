import { useState, useEffect } from 'react';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc,
} from 'firebase/firestore';
import { Plus, Plug, Power, PowerOff, Trash2, Edit3, RefreshCw } from 'lucide-react';
import { db } from '../lib/firebase';
import { apiClient } from '../lib/api';
import { useI18n } from '../i18n/I18nContext';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';

interface SmtpAccount {
  id: string;
  name: string;
  username: string;
  password: string;
  host: string;
  port: number;
  secure: boolean;
  status: 'active' | 'inactive';
  dailyLimit: number;
  ratePerMinute: number;
  sentToday: number;
  imapHost?: string;
  imapPort?: number;
  signature?: string;
}

export default function SmtpAccounts() {
  const { t } = useI18n();
  const [accounts, setAccounts] = useState<SmtpAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '', username: '', password: '', host: 'mail.onecode.ma',
    port: 465, secure: true, dailyLimit: 300, ratePerMinute: 5, status: 'active' as 'active' | 'inactive',
    imapHost: '', imapPort: 993, signature: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'smtpAccounts'));
      setAccounts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as SmtpAccount)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditId(null);
    setForm({ name: '', username: '', password: '', host: 'mail.onecode.ma', port: 465, secure: true, dailyLimit: 300, ratePerMinute: 5, status: 'active', imapHost: '', imapPort: 993, signature: '' });
    setModalOpen(true);
  };

  const openEdit = (acc: SmtpAccount) => {
    setEditId(acc.id);
    setForm({ name: acc.name, username: acc.username, password: '', host: acc.host, port: acc.port, secure: acc.secure, dailyLimit: acc.dailyLimit, ratePerMinute: acc.ratePerMinute || 5, status: acc.status, imapHost: acc.imapHost || '', imapPort: acc.imapPort || (acc.secure ? 993 : 143), signature: acc.signature || '' });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.username) { toast.error(t('required')); return; }
    try {
      if (editId) {
        const update: any = { name: form.name, username: form.username, host: form.host, port: form.port, secure: form.secure, dailyLimit: form.dailyLimit, ratePerMinute: form.ratePerMinute, status: form.status, imapHost: form.imapHost || form.host, imapPort: form.imapPort || (form.secure ? 993 : 143), signature: form.signature };
        if (form.password) update.password = btoa(form.password);
        await updateDoc(doc(db, 'smtpAccounts', editId), update);
        toast.success(t('success'));
      } else {
        await addDoc(collection(db, 'smtpAccounts'), {
          name: form.name, username: form.username, password: btoa(form.password),
          host: form.host, port: form.port, secure: form.secure,
          dailyLimit: form.dailyLimit, ratePerMinute: form.ratePerMinute, sentToday: 0, status: 'active',
          imapHost: form.imapHost || form.host, imapPort: form.imapPort || (form.secure ? 993 : 143),
          signature: form.signature,
        });
        toast.success(t('success'));
      }
      setModalOpen(false);
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('confirm'))) return;
    try {
      await deleteDoc(doc(db, 'smtpAccounts', id));
      toast.success(t('success'));
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const testConnection = async (acc: SmtpAccount) => {
    toast.loading(t('test'));
    try {
      const data = await apiClient.testSmtp({
        host: acc.host, port: acc.port, secure: acc.secure,
        user: acc.username, pass: atob(acc.password),
      });
      toast.dismiss();
      if (data.success) toast.success(t('success'));
      else toast.error(data.error || t('error'));
    } catch {
      toast.dismiss();
      toast.error(t('error'));
    }
  };

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
        <h1 className="text-2xl font-bold text-white">{t('smtpAccounts')}</h1>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> {t('add')}
        </button>
      </div>

      {accounts.length === 0 ? (
        <div className="card text-center py-12">
          <Plug className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500">{t('noAccounts')}</p>
          <button onClick={openAdd} className="btn-primary mt-4">{t('addFirstAccount')}</button>
        </div>
      ) : (
        <div className="grid gap-4">
          {accounts.map((acc) => (
            <div key={acc.id} className="card flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-lg ${acc.status === 'active' ? 'bg-green-900/20' : 'bg-gray-900/20'}`}>
                  {acc.status === 'active' ? <Power className="w-5 h-5 text-green-400" /> : <PowerOff className="w-5 h-5 text-gray-500" />}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-100">{acc.name}</h3>
                  <p className="text-sm text-gray-500">{acc.username} | {acc.host}:{acc.port}</p>
                  <div className="flex gap-4 mt-1 text-xs text-gray-500">
                    <span>{t('dailyLimit')}: {acc.dailyLimit}</span>
                    <span>{t('ratePerMinute')}: {acc.ratePerMinute || 5}/min</span>
                    <span>{t('sentToday')}: {acc.sentToday}</span>
                    <span className={`badge ${acc.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                      {t(acc.status)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => testConnection(acc)} className="btn-secondary p-2" title={t('testConnection')}>
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button onClick={() => openEdit(acc)} className="btn-secondary p-2" title={t('edit')}>
                  <Edit3 className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(acc.id)} className="btn-danger p-2" title={t('delete')}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? t('edit') : t('add')}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">{t('accountName')}</label>
            <input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">{t('smtpUser')}</label>
            <input className="input-field" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">{t('smtpPass')}</label>
            <input className="input-field" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={editId ? t('passwordPlaceholder') : ''} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">{t('smtpHost')}</label>
              <input className="input-field" value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">{t('smtpPort')}</label>
              <input className="input-field" type="number" value={form.port} onChange={(e) => setForm({ ...form, port: Number(e.target.value) })} />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-400">
              <input type="checkbox" checked={form.secure} onChange={(e) => setForm({ ...form, secure: e.target.checked })} className="rounded bg-dark-700 border-dark-400" />
              SSL/TLS
            </label>
          </div>
          <div className="border-t border-dark-700 pt-4">
            <h4 className="text-sm font-semibold text-gray-300 mb-3">{t('imapSettings')}</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">{t('imapHost')}</label>
                <input className="input-field" placeholder={form.host} value={form.imapHost} onChange={(e) => setForm({ ...form, imapHost: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">{t('imapPort')}</label>
                <input className="input-field" type="number" placeholder={form.secure ? '993' : '143'} value={form.imapPort} onChange={(e) => setForm({ ...form, imapPort: Number(e.target.value) })} />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">{t('imapHint')}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">{t('signature')}</label>
            <textarea className="input-field min-h-[80px]" value={form.signature} onChange={(e) => setForm({ ...form, signature: e.target.value })} placeholder={t('signaturePlaceholder')} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">{t('dailyLimit')}</label>
              <input className="input-field" type="number" value={form.dailyLimit} onChange={(e) => setForm({ ...form, dailyLimit: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">{t('ratePerMinute')}</label>
              <input className="input-field" type="number" min={1} max={60} value={form.ratePerMinute} onChange={(e) => setForm({ ...form, ratePerMinute: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">{t('status')}</label>
              <select className="input-field" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as 'active' | 'inactive' })}>
                <option value="active">{t('active')}</option>
                <option value="inactive">{t('inactive')}</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => setModalOpen(false)} className="btn-secondary">{t('cancel')}</button>
            <button onClick={handleSave} className="btn-primary">{t('save')}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
