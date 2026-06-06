import { useState, useEffect, useRef } from 'react';
import {
  collection, getDocs, addDoc, deleteDoc, doc, query, orderBy,
} from 'firebase/firestore';
import {
  Plus, Upload, Camera, Trash2, Search, FileSpreadsheet, List,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import Tesseract from 'tesseract.js';
import { db } from '../lib/firebase';
import { useI18n } from '../i18n/I18nContext';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';

interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  title: string;
  tags: string[];
  listId: string;
  createdAt: string;
}

interface ContactList {
  id: string;
  name: string;
  count: number;
}

export default function Contacts() {
  const { t } = useI18n();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [lists, setLists] = useState<ContactList[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedList, setSelectedList] = useState('all');
  const [addModal, setAddModal] = useState(false);
  const [importModal, setImportModal] = useState(false);
  const [aiModal, setAiModal] = useState(false);
  const [listModal, setListModal] = useState(false);

  const [form, setForm] = useState({ name: '', email: '', phone: '', company: '', title: '', tags: '', listId: '' });
  const [newListName, setNewListName] = useState('');

  const [importData, setImportData] = useState<any[]>([]);
  const [importColumns, setImportColumns] = useState<string[]>([]);
  const [columnMap, setColumnMap] = useState<Record<string, string>>({});
  const [importProgress, setImportProgress] = useState(0);

  const [aiImage, setAiImage] = useState<string | null>(null);
  const [aiData, setAiData] = useState<any>(null);
  const [aiScanning, setAiScanning] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [cSnap, lSnap] = await Promise.all([
        getDocs(query(collection(db, 'contacts'), orderBy('createdAt', 'desc'))),
        getDocs(collection(db, 'contactLists')),
      ]);
      setContacts(cSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Contact)));
      setLists(lSnap.docs.map((d) => ({ id: d.id, ...d.data() } as ContactList)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleAddContact = async () => {
    if (!form.name || !form.email) { toast.error(t('required')); return; }
    try {
      await addDoc(collection(db, 'contacts'), {
        ...form, tags: form.tags.split(',').map((s) => s.trim()).filter(Boolean),
        createdAt: new Date().toISOString(),
      });
      if (form.listId) {
        const list = lists.find((l) => l.id === form.listId);
        if (list) await addDoc(collection(db, 'contactLists'), { ...list, count: list.count + 1 });
      }
      toast.success(t('success'));
      setAddModal(false);
      setForm({ name: '', email: '', phone: '', company: '', title: '', tags: '', listId: '' });
      load();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target!.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<any>(ws);
      if (json.length === 0) { toast.error(t('noData')); return; }
      setImportColumns(Object.keys(json[0]));
      setImportData(json);
      const autoMap: Record<string, string> = {};
      Object.keys(json[0]).forEach((k) => {
        const lower = k.toLowerCase();
        if (lower.includes('nom') || lower.includes('name') || lower.includes('اسم')) autoMap[k] = 'name';
        else if (lower.includes('mail') || lower.includes('email') || lower.includes('بريد')) autoMap[k] = 'email';
        else if (lower.includes('tel') || lower.includes('phone') || lower.includes('هاتف')) autoMap[k] = 'phone';
        else if (lower.includes('société') || lower.includes('company') || lower.includes('شركة')) autoMap[k] = 'company';
        else autoMap[k] = '';
      });
      setColumnMap(autoMap);
      setImportModal(true);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    const fields = ['name', 'email', 'phone', 'company'];
    const colName = Object.entries(columnMap).find(([, v]) => v === 'name')?.[0];
    const colEmail = Object.entries(columnMap).find(([, v]) => v === 'email')?.[0];
    if (!colName || !colEmail) { toast.error(t('required')); return; }

    let imported = 0;
    for (let i = 0; i < importData.length; i++) {
      const row = importData[i];
      try {
        await addDoc(collection(db, 'contacts'), {
          name: row[colName] || '',
          email: row[colEmail] || '',
          phone: colName ? row[Object.entries(columnMap).find(([, v]) => v === 'phone')?.[0] || ''] : '',
          company: colName ? row[Object.entries(columnMap).find(([, v]) => v === 'company')?.[0] || ''] : '',
          tags: [],
          listId: '',
          createdAt: new Date().toISOString(),
        });
        imported++;
      } catch { /* skip */ }
      setImportProgress(Math.round(((i + 1) / importData.length) * 100));
    }
    toast.success(`${imported} ${t('rowsImported')}`);
    setImportModal(false);
    setImportProgress(0);
    load();
  };

  const handleAiScan = async () => {
    if (!aiImage) return;
    setAiScanning(true);
    try {
      const { data } = await Tesseract.recognize(
        `data:image/jpeg;base64,${aiImage}`,
        'ara+fra+eng',
        { logger: (m) => { if (m.status === 'recognizing text') {} } }
      );
      const text = data.text;
      const emailMatch = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/i);
      const phoneMatch = text.match(/(?:\+212|0)[5-7]\d{8}/);
      const lines = text.split('\n').filter(Boolean).map(l => l.trim());
      let name = '';
      let company = '';
      let title = '';
      if (lines.length > 0) name = lines[0];
      if (lines.length > 2) company = lines[lines.length - 1];
      const titleKeywords = ['manager', 'directeur', 'developer', 'engineer', 'consultant', 'CEO', 'CTO', 'president', 'chef', 'responsable', 'م director', 'مهندس', 'مدير'];
      for (const line of lines) {
        const lower = line.toLowerCase();
        if (titleKeywords.some(k => lower.includes(k))) { title = line; break; }
      }
      setAiData({
        name: name || '',
        email: emailMatch?.[0] || '',
        phone: phoneMatch?.[0] || '',
        company: company || '',
        title: title || '',
        address: '',
      });
    } catch {
      toast.error(t('error'));
    } finally {
      setAiScanning(false);
    }
  };

  const handleAiSave = async () => {
    if (!aiData?.email) { toast.error(t('required')); return; }
    try {
      await addDoc(collection(db, 'contacts'), {
        name: aiData.name || '', email: aiData.email, phone: aiData.phone || '',
        company: aiData.company || '', title: aiData.title || '', address: aiData.address || '',
        tags: [], listId: '', createdAt: new Date().toISOString(),
      });
      toast.success(t('success'));
      setAiModal(false);
      setAiImage(null);
      setAiData(null);
      load();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('confirm'))) return;
    try {
      await deleteDoc(doc(db, 'contacts', id));
      toast.success(t('success'));
      load();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      setAiImage(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleCreateList = async () => {
    if (!newListName) { toast.error(t('required')); return; }
    try {
      await addDoc(collection(db, 'contactLists'), { name: newListName, count: 0, createdAt: new Date().toISOString() });
      toast.success(t('success'));
      setListModal(false);
      setNewListName('');
      load();
    } catch (err: any) { toast.error(err.message); }
  };

  const filtered = contacts.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase());
    const matchesList = selectedList === 'all' || c.listId === selectedList;
    return matchesSearch && matchesList;
  });

  const handleDeleteContact = async (id: string) => {
    if (!confirm(t('confirm'))) return;
    await deleteDoc(doc(db, 'contacts', id));
    toast.success(t('success'));
    load();
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
        <h1 className="text-2xl font-bold text-white">{t('contactsPage')}</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setListModal(true)} className="btn-secondary flex items-center gap-2">
            <List className="w-4 h-4" /> {t('contactLists')}
          </button>
          <label className="btn-secondary flex items-center gap-2 cursor-pointer">
            <Upload className="w-4 h-4" /> {t('importExcel')}
            <input ref={fileInputRef} type="file" accept=".xlsx,.csv" onChange={handleFileUpload} hidden />
          </label>
          <button onClick={() => setAiModal(true)} className="btn-secondary flex items-center gap-2">
            <Camera className="w-4 h-4" /> {t('aiScanner')}
          </button>
          <button onClick={() => setAddModal(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> {t('addContact')}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            className="input-field pl-10 pr-10"
            placeholder={t('search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="input-field w-48" value={selectedList} onChange={(e) => setSelectedList(e.target.value)}>
          <option value="all">{t('all')}</option>
          {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>

      {contacts.length === 0 ? (
        <div className="card text-center py-12">
          <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500">{t('noContacts')}</p>
          <button onClick={() => setAddModal(true)} className="btn-primary mt-4">{t('addFirstContact')}</button>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-700 bg-dark-800">
                  <th className="table-header">{t('name')}</th>
                  <th className="table-header">{t('email')}</th>
                  <th className="table-header">{t('phone')}</th>
                  <th className="table-header">{t('company')}</th>
                  <th className="table-header">{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b border-dark-700 hover:bg-dark-700/50">
                    <td className="table-cell font-medium text-gray-100">{c.name}</td>
                    <td className="table-cell">{c.email}</td>
                    <td className="table-cell">{c.phone || '-'}</td>
                    <td className="table-cell">{c.company || '-'}</td>
                    <td className="table-cell">
                      <button onClick={() => handleDeleteContact(c.id)} className="text-red-400 hover:text-red-300 p-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={addModal} onClose={() => setAddModal(false)} title={t('addContact')}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">{t('name')}</label>
              <input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">{t('email')}</label>
              <input className="input-field" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">{t('phone')}</label>
              <input className="input-field" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">{t('company')}</label>
              <input className="input-field" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">{t('tags')}</label>
            <input className="input-field" placeholder="tag1, tag2, tag3" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">{t('contactList')}</label>
            <select className="input-field" value={form.listId} onChange={(e) => setForm({ ...form, listId: e.target.value })}>
              <option value="">{t('selectAll')}</option>
              {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => setAddModal(false)} className="btn-secondary">{t('cancel')}</button>
            <button onClick={handleAddContact} className="btn-primary">{t('save')}</button>
          </div>
        </div>
      </Modal>

      <Modal open={importModal} onClose={() => setImportModal(false)} title={t('importExcel')} size="lg">
        <div className="space-y-4">
          <p className="text-sm text-gray-400">{t('columnMapping')}</p>
          <div className="space-y-3">
            {importColumns.map((col) => (
              <div key={col} className="flex items-center gap-3">
                <span className="text-sm text-gray-300 w-40 truncate">{col}</span>
                <select
                  className="input-field"
                  value={columnMap[col] || ''}
                  onChange={(e) => setColumnMap({ ...columnMap, [col]: e.target.value })}
                >
                  <option value="">— {t('skip')} —</option>
                  <option value="name">{t('name')}</option>
                  <option value="email">{t('email')}</option>
                  <option value="phone">{t('phone')}</option>
                  <option value="company">{t('company')}</option>
                </select>
              </div>
            ))}
          </div>
          {importProgress > 0 && (
            <div className="w-full bg-dark-700 rounded-full h-2">
              <div className="bg-brand-600 h-2 rounded-full transition-all" style={{ width: `${importProgress}%` }} />
            </div>
          )}
          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => setImportModal(false)} className="btn-secondary">{t('cancel')}</button>
            <button onClick={handleImport} className="btn-primary">{t('import')}</button>
          </div>
        </div>
      </Modal>

      <Modal open={aiModal} onClose={() => setAiModal(false)} title={t('aiScanner')} size="lg">
        <div className="space-y-4">
          {!aiImage ? (
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">{t('uploadImage')}</label>
              <div className="border-2 border-dashed border-dark-500 rounded-xl p-8 text-center cursor-pointer hover:border-brand-500/50 transition-colors" onClick={() => document.getElementById('ai-file-input')?.click()}>
                <Camera className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-500">{t('dragDrop')}</p>
                <input id="ai-file-input" type="file" accept="image/*" onChange={handleImageUpload} hidden />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <img src={`data:image/jpeg;base64,${aiImage}`} alt="Card" className="max-h-48 rounded-lg mx-auto" />
              <button onClick={handleAiScan} disabled={aiScanning} className="btn-primary w-full">
                {aiScanning ? t('scanning') : t('aiScanner')}
              </button>
              {aiData && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-gray-100">{t('extractedData')}</h3>
                  {['name', 'email', 'phone', 'company', 'title', 'address'].map((field) => (
                    <div key={field}>
                      <label className="block text-sm font-medium text-gray-400 mb-1">{t(field)}</label>
                      <input className="input-field" value={aiData[field] || ''} onChange={(e) => setAiData({ ...aiData, [field]: e.target.value })} />
                    </div>
                  ))}
                  <div className="flex justify-end gap-3 pt-4">
                    <button onClick={() => { setAiImage(null); setAiData(null); }} className="btn-secondary">{t('scanAnother')}</button>
                    <button onClick={handleAiSave} className="btn-primary">{t('confirmSave')}</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      <Modal open={listModal} onClose={() => setListModal(false)} title={t('contactLists')}>
        <div className="space-y-4">
          <div className="flex gap-2">
            <input className="input-field flex-1" placeholder={t('name')} value={newListName} onChange={(e) => setNewListName(e.target.value)} />
            <button onClick={handleCreateList} className="btn-primary">{t('add')}</button>
          </div>
          {lists.map((l) => (
            <div key={l.id} className="flex items-center justify-between p-3 rounded-lg bg-dark-700/50">
              <span className="text-gray-200">{l.name}</span>
              <span className="text-sm text-gray-500">{l.count} contacts</span>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}

function Users(props: any) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
    </svg>
  );
}
