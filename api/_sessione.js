// api/_sessione.js
// Token di sessione firmato (HMAC), per non dover più inviare al browser
// nessun segreto vero (prima veniva inviata la Master Key di JSONBin).
// Il token contiene solo username + scadenza + firma: chi non conosce
// AUTH_SECRET non può fabbricarne uno valido.
//
// Variabili d'ambiente richieste su Vercel:
//   AUTH_SECRET -> stringa lunga e casuale, es. generata con:
//                  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

import { createHmac, timingSafeEqual } from 'crypto';

const DURATA_MS = 4 * 60 * 60 * 1000; // 4 ore di sessione

function segreto() {
    const s = process.env.AUTH_SECRET;
    if (!s) throw new Error('AUTH_SECRET non configurato sul server.');
    return s;
}

// ambito (facoltativo): i token creati con un ambito (es. 'unitext', dal login con QR) valgono SOLO per quel sistema.
// Senza ambito il token è "classico" (login con password) e funziona come sempre.
export function creaToken(username, ambito) {
    const scadenza = Date.now() + DURATA_MS;
    // il nome è codificato: un nome con "." (es. "mario.rossi") non deve rompere il token
    const nome = Buffer.from(String(username), 'utf-8').toString('base64url');
    const payload = ambito ? `${nome}.${scadenza}.${ambito}` : `${nome}.${scadenza}`;
    const firma = createHmac('sha256', segreto()).update(payload).digest('hex');
    return Buffer.from(`${payload}.${firma}`).toString('base64url');
}

// Restituisce { username } se il token è valido e non scaduto, altrimenti null.
export function verificaToken(token) {
    try {
        const testo = Buffer.from(token, 'base64url').toString('utf-8');
        const parti = testo.split('.');
        if (parti.length !== 3 && parti.length !== 4) return null;
        const firma = parti[parti.length - 1];
        const [nomeCodificato, scadenzaStr] = parti;
        const ambito = parti.length === 4 ? parti[2] : null;
        const payload = parti.slice(0, -1).join('.');
        const firmaAttesa = createHmac('sha256', segreto()).update(payload).digest('hex');
        const a = Buffer.from(firma), b = Buffer.from(firmaAttesa);
        if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
        if (Date.now() > Number(scadenzaStr)) return null;
        return { username: Buffer.from(nomeCodificato, 'base64url').toString('utf-8'), ambito };
    } catch (e) {
        return null;
    }
}

// Estrae il token dall'header "Authorization: Bearer <token>" e lo verifica.
// Restituisce { username } oppure null.
// Senza 'ambito' accetta solo i token classici: un token limitato a un sistema (login con QR) non apre gli altri.
export function sessioneDaRichiesta(req, ambito) {
    const intestazione = req.headers.authorization || '';
    const token = intestazione.startsWith('Bearer ') ? intestazione.slice(7) : null;
    const s = token ? verificaToken(token) : null;
    if (!s) return null;
    return (!s.ambito || s.ambito === ambito) ? s : null;
}