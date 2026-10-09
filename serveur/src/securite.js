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

// Limite les essais de mot de passe : après `max` échecs, le numéro est bloqué
// pendant `dureeMs` (protège contre ceux qui essaient de deviner les mots de passe).
export function creerLimiteur({ max = 8, dureeMs = 15 * 60 * 1000 } = {}) {
  const essais = new Map(); // cle → { echecs, debut }
  const lire = (cle) => {
    const e = essais.get(cle);
    if (e && Date.now() - e.debut > dureeMs) {
      essais.delete(cle);
      return null;
    }
    return e;
  };
  return {
    // Minutes restantes si bloqué, sinon 0.
    bloque(cle) {
      const e = lire(cle);
      return e && e.echecs >= max ? Math.ceil((dureeMs - (Date.now() - e.debut)) / 60000) : 0;
    },
    echec(cle) {
      const e = lire(cle) || { echecs: 0, debut: Date.now() };
      e.echecs += 1;
      essais.set(cle, e);
    },
    reussite(cle) {
      essais.delete(cle);
    },
  };
}
