// Interno do módulo auth — NÃO deve ser importado por outros módulos.
// Outros módulos só podem falar com auth através de ./index.js.
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { poolFor } from '../../db/pool.js';

const pool = poolFor('auth');
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-troque-em-producao';

export async function registrar(email, password) {
  const hash = await bcrypt.hash(password, 10);
  const { rows } = await pool.query(
    'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at',
    [email, hash]
  );
  return rows[0];
}

export async function autenticar(email, password) {
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  const user = rows[0];
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return null;
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });
}

export function verificarToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}
