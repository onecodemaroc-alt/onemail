import { useState, useEffect } from 'react';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy,
} from 'firebase/firestore';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Plus, FileText, Eye, Copy, Trash2, Edit3, Bold, Italic, List, ListOrdered, Heading } from 'lucide-react';
import { db } from '../lib/firebase';
import { useI18n } from '../i18n/I18nContext';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';

interface Template {
  id: string;
  name: string;
  subject: string;
  htmlBody: string;
  createdAt: string;
}

const VARIABLES = ['{{name}}', '{{email}}', '{{company}}', '{{title}}'];

function EditorBar({ editor }: { editor: any }) {
  if (!editor) return null;
  const btn = (on: boolean, fn: () => void, icon: React.ReactNode) => (
    <button
      type="button"
      onClick={fn}
      className={`p-2 rounded-lg transition-colors ${on ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-gray-200 hover:bg-dark-600'}`}
    >
      {icon}
    </button>
  );
  return (
    <div className="flex items-center gap-1 p-2 border-b border-dark-600 bg-dark-800 rounded-t-lg">
      {btn(editor.isActive('bold'), () => editor.chain().focus().toggleBold().run(), <Bold className="w-4 h-4" />)}
      {btn(editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run(), <Italic className="w-4 h-4" />)}
      {btn(editor.isActive('heading'), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), <Heading className="w-4 h-4" />)}
      {btn(editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run(), <List className="w-4 h-4" />)}
      {btn(editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run(), <ListOrdered className="w-4 h-4" />)}
    </div>
  );
}

export default function Templates() {
  const { t } = useI18n();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState('');
  const [form, setForm] = useState({ name: '', subject: '' });

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: t('body') + '...' }),
    ],
    editorProps: {
      attributes: { class: 'prose prose-invert max-w-none focus:outline-none min-h-[200px] p-4' },
    },
  });

  const load = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'templates'), orderBy('createdAt', 'desc')));
      setTemplates(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Template)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditId(null);
    setForm({ name: '', subject: '' });
    editor?.commands.setContent('');
    setModalOpen(true);
  };

  const openEdit = (tpl: Template) => {
    setEditId(tpl.id);
    setForm({ name: tpl.name, subject: tpl.subject });
    editor?.commands.setContent(tpl.htmlBody);
    setModalOpen(true);
  };

  const insertVariable = (v: string) => {
    editor?.chain().focus().insertContent(v).run();
  };

  const handleSave = async () => {
    if (!form.name || !form.subject) { toast.error(t('required')); return; }
    const htmlBody = editor?.getHTML() || '';
    try {
      if (editId) {
        await updateDoc(doc(db, 'templates', editId), { name: form.name, subject: form.subject, htmlBody });
      } else {
        await addDoc(collection(db, 'templates'), { name: form.name, subject: form.subject, htmlBody, createdAt: new Date().toISOString() });
      }
      toast.success(t('success'));
      setModalOpen(false);
      load();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('confirm'))) return;
    try {
      await deleteDoc(doc(db, 'templates', id));
      toast.success(t('success'));
      load();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleDuplicate = async (tpl: Template) => {
    try {
      await addDoc(collection(db, 'templates'), {
        name: `${tpl.name} (copy)`, subject: tpl.subject, htmlBody: tpl.htmlBody, createdAt: new Date().toISOString(),
      });
      toast.success(t('success'));
      load();
    } catch (err: any) { toast.error(err.message); }
  };

  const handlePreview = (tpl: Template) => {
    const html = tpl.htmlBody
      .replace(/{{name}}/g, 'Ahmed Benali')
      .replace(/{{email}}/g, 'ahmed@example.com')
      .replace(/{{company}}/g, 'OneCode')
      .replace(/{{title}}/g, 'Developer');
    setPreviewHtml(html);
    setPreviewOpen(true);
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
        <h1 className="text-2xl font-bold text-white">{t('emailTemplate')}</h1>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> {t('add')}
        </button>
      </div>

      {templates.length === 0 ? (
        <div className="card text-center py-12">
          <FileText className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500">{t('noTemplates')}</p>
          <button onClick={openAdd} className="btn-primary mt-4">{t('addFirstTemplate')}</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((tpl) => (
            <div key={tpl.id} className="card hover:border-dark-500 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-gray-100">{tpl.name}</h3>
                <span className="badge badge-info text-xs">{new Date(tpl.createdAt).toLocaleDateString()}</span>
              </div>
              <p className="text-sm text-gray-500 truncate mb-4">{tpl.subject}</p>
              <div className="flex items-center gap-2">
                <button onClick={() => handlePreview(tpl)} className="btn-secondary p-2" title={t('preview')}>
                  <Eye className="w-4 h-4" />
                </button>
                <button onClick={() => handleDuplicate(tpl)} className="btn-secondary p-2" title={t('duplicate')}>
                  <Copy className="w-4 h-4" />
                </button>
                <button onClick={() => openEdit(tpl)} className="btn-secondary p-2" title={t('edit')}>
                  <Edit3 className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(tpl.id)} className="btn-danger p-2" title={t('delete')}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? t('edit') : t('add')} size="xl">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">{t('templateName')}</label>
            <input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">{t('subject')}</label>
            <input className="input-field" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">{t('variables')}</label>
            <div className="flex gap-2 flex-wrap">
              {VARIABLES.map((v) => (
                <button key={v} type="button" onClick={() => insertVariable(v)} className="btn-secondary text-xs py-1 px-2">
                  {v}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">{t('body')}</label>
            <div className="border border-dark-600 rounded-lg overflow-hidden bg-dark-700">
              <EditorBar editor={editor} />
              <EditorContent editor={editor} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => setModalOpen(false)} className="btn-secondary">{t('cancel')}</button>
            <button onClick={handleSave} className="btn-primary">{t('save')}</button>
          </div>
        </div>
      </Modal>

      <Modal open={previewOpen} onClose={() => setPreviewOpen(false)} title={t('preview')} size="lg">
        <div className="bg-white rounded-lg p-6" dangerouslySetInnerHTML={{ __html: previewHtml }} />
      </Modal>
    </div>
  );
}
