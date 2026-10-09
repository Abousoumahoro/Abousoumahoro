import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { adresseServeur, changerAdresseServeur, normaliserAdresse, requete, testerServeur } from '../api';
import { Bouton, EnTete } from '../components/ui';
import { ROLES } from '../constantes';
import { useAuth } from '../context/AuthContext';
import { couleurs } from '../theme';

// Connexion ou création de compte pour le profil choisi (client, livreur, commerçant).
export default function Authentification({ role, onRetour }) {
  const { connexion, inscription } = useAuth();
  const [mode, setMode] = useState('connexion');
  const [champs, setChamps] = useState({
    nom: '',
    telephone: '',
    motDePasse: '',
    quartier: null,
    adresse: '',
    nomBoutique: '',
    vehicule: '',
  });
  const [quartiers, setQuartiers] = useState([]);
  const [erreur, setErreur] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const couleur = couleurs[role];
  const maj = (cle) => (valeur) => setChamps((c) => ({ ...c, [cle]: valeur }));

  useEffect(() => {
    if (mode === 'inscription' && quartiers.length === 0) {
      requete('/quartiers').then(setQuartiers).catch((e) => setErreur(e.message));
    }
  }, [mode, quartiers.length]);

  const valider = async () => {
    setErreur(null);
    setEnvoi(true);
    try {
      if (mode === 'connexion') {
        await connexion(champs.telephone, champs.motDePasse, role);
      } else {
        await inscription({ ...champs, role });
      }
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <EnTete titre={`${ROLES[role].icone} ${ROLES[role].label}`} couleur={couleur} onRetour={onRetour} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
          <View style={styles.modes}>
            {[
              ['connexion', 'Se connecter'],
              ['inscription', 'Créer un compte'],
            ].map(([id, label]) => (
              <Pressable
                key={id}
                onPress={() => {
                  setMode(id);
                  setErreur(null);
                }}
                style={[styles.mode, mode === id && { backgroundColor: couleur }]}
              >
                <Text style={[styles.modeTexte, mode === id && { color: '#fff' }]}>{label}</Text>
              </Pressable>
            ))}
          </View>

          {mode === 'inscription' && (
            <Champ label="Nom complet" value={champs.nom} onChangeText={maj('nom')} placeholder="Ex : Fatou Bamba" />
          )}
          <Champ
            label="Numéro de téléphone"
            value={champs.telephone}
            onChangeText={maj('telephone')}
            keyboardType="phone-pad"
            placeholder="Ex : 07 00 00 00 00"
          />
          <Champ
            label="Mot de passe"
            value={champs.motDePasse}
            onChangeText={maj('motDePasse')}
            secureTextEntry
            placeholder={mode === 'inscription' ? '6 caractères minimum' : ''}
          />

          {mode === 'inscription' && role === 'commercant' && (
            <Champ label="Nom de la boutique" value={champs.nomBoutique} onChangeText={maj('nomBoutique')} placeholder="Ex : Chez Tantie Awa" />
          )}
          {mode === 'inscription' && role === 'livreur' && (
            <Champ label="Véhicule" value={champs.vehicule} onChangeText={maj('vehicule')} placeholder="Ex : Moto — AB 1234 CI" />
          )}

          {mode === 'inscription' && (
            <>
              <Text style={styles.label}>
                {role === 'livreur' ? 'Votre zone' : role === 'commercant' ? 'Quartier de la boutique' : 'Quartier de livraison'}
              </Text>
              <View style={styles.quartiers}>
                {quartiers.map((q) => (
                  <Pressable
                    key={q.id}
                    onPress={() => maj('quartier')(q.id)}
                    style={[styles.puce, champs.quartier === q.id && { backgroundColor: couleur, borderColor: couleur }]}
                  >
                    <Text style={champs.quartier === q.id && { color: '#fff', fontWeight: '700' }}>{q.nom}</Text>
                  </Pressable>
                ))}
              </View>
              {role !== 'livreur' && (
                <Champ
                  label="Adresse précise (facultatif)"
                  value={champs.adresse}
                  onChangeText={maj('adresse')}
                  placeholder="Rue, immeuble, repère…"
                />
              )}
            </>
          )}

          {erreur && <Text style={styles.erreur}>{erreur}</Text>}

          <Bouton
            titre={envoi ? 'Patientez…' : mode === 'connexion' ? 'Se connecter' : 'Créer mon compte'}
            couleur={couleur}
            desactive={envoi}
            onPress={valider}
            style={{ marginTop: 8 }}
          />
          <ReglageServeur couleur={couleur} />
          {mode === 'connexion' && (
            <Text style={styles.aide}>
              Comptes de démo (mot de passe demo1234) :{'\n'}
              Client 0500000010 · Livreur 0100000020{'\n'}Commerçant 0700000001
            </Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// Adresse du serveur modifiable : utile pour tester un APK avec le serveur lancé sur un ordinateur.
function ReglageServeur({ couleur }) {
  const [ouvert, setOuvert] = useState(false);
  const [adresse, setAdresse] = useState(adresseServeur());
  const [saisie, setSaisie] = useState(adresseServeur());
  const [message, setMessage] = useState(null);
  const [test, setTest] = useState(false);

  const enregistrer = async () => {
    setTest(true);
    setMessage(null);
    const candidate = normaliserAdresse(saisie);
    const ok = await testerServeur(candidate);
    setTest(false);
    if (!ok) {
      setMessage(`❌ Pas de réponse de ${candidate}. Vérifiez l'adresse, le Wi-Fi et que le serveur est démarré.`);
      return;
    }
    setAdresse(await changerAdresseServeur(saisie));
    setMessage('✅ Serveur trouvé et enregistré.');
    setOuvert(false);
  };

  return (
    <View style={styles.serveur}>
      <Pressable onPress={() => setOuvert((o) => !o)}>
        <Text style={styles.serveurTexte}>⚙️ Serveur : {adresse}</Text>
      </Pressable>
      {ouvert && (
        <>
          <TextInput
            style={[styles.champ, { marginTop: 8, marginBottom: 8 }]}
            value={saisie}
            onChangeText={setSaisie}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="Ex : 192.168.1.20 (adresse de l'ordinateur)"
          />
          <Bouton titre={test ? 'Test…' : 'Tester et enregistrer'} couleur={couleur} contour desactive={test} onPress={enregistrer} />
        </>
      )}
      {message && <Text style={[styles.serveurTexte, { marginTop: 6 }]}>{message}</Text>}
    </View>
  );
}

function Champ({ label, ...props }) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.champ} autoCapitalize="none" placeholderTextColor="#a8a29e" {...props} />
    </>
  );
}

const styles = StyleSheet.create({
  modes: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, padding: 4, marginBottom: 20 },
  mode: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  modeTexte: { fontWeight: '700', color: couleurs.texte },
  label: { fontWeight: '700', marginBottom: 6 },
  champ: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: couleurs.bordure,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    fontSize: 16,
    color: couleurs.texte,
  },
  quartiers: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  puce: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: couleurs.bordure,
    backgroundColor: '#fff',
  },
  erreur: { color: couleurs.danger, marginBottom: 8, textAlign: 'center' },
  serveur: { marginTop: 18, alignItems: 'stretch' },
  serveurTexte: { color: couleurs.texteDoux, textAlign: 'center', fontSize: 13 },
  aide: { color: couleurs.texteDoux, textAlign: 'center', marginTop: 18, fontSize: 13 },
});
