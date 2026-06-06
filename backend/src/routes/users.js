import { Router } from 'express';
import { auth, db } from '../config/firebase.js';

const router = Router();

router.post('/users', async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password required' });
    }

    const userRecord = await auth.createUser({
      email,
      password,
      emailVerified: false,
    });

    await db.collection('users').doc(userRecord.uid).set({
      email,
      role: role || 'sender',
      createdAt: new Date().toISOString(),
    });

    res.json({ success: true, uid: userRecord.uid });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/users', async (req, res) => {
  try {
    const snap = await db.collection('users').get();
    const users = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
