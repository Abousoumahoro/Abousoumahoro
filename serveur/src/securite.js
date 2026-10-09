import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import jwt from 'jsonwebtoken';

// Mot de passe : hachage scrypt avec sel aléatoire (jamais stocké en clair).
export function hacherMotDePasse(motDePasse) {
  const sel = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(motDePasse, sel, 64).toString('hex');
  return `${sel}:${hash}`;
}

export function verifierMotDePasse(motDePasse, stocke) {
  const [sel, hash] = stocke.split(':');
  const calcule = crypto.scryptSync(motDePasse, sel, 64);
  return crypto.timingSafeEqual(calcule, Buffer.from(hash, 'hex'));
}

// Secret des jetons : variable JWT_SECRET, sinon généré une fois et gardé dans donnees/.
function chargerSecret(dossier) {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  const fichier = path.join(dossier, '.secret');
  if (fs.existsSync(fichier)) return fs.readFileSync(fichier, 'utf8');
  const secret = crypto.randomBytes(48).toString('hex');
  fs.mkdirSync(dossier, { recursive: true });
  fs.writeFileSync(fichier, secret, { mode: 0o600 });
  return secret;
}

export function creerJetons(dossierDonnees) {
  const secret = chargerSecret(dossierDonnees);
  return {
    signer: (utilisateur) =>
      jwt.sign({ id: utilisateur.id, role: utilisateur.role }, secret, { expiresIn: '30d' }),
    verifier: (jeton) => jwt.verify(jeton, secret),
  };
}

export const normaliserTelephone = (tel) => String(tel || '').replace(/[^\d+]/g, '');
