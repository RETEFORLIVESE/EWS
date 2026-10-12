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

export function creaToken(username) {
    const scadenza = Date.now() + DURATA_MS;
    // il nome è codificato: un nome con "." (es. "mario.rossi") non deve rompere il token
    const payload = `${Buffer.from(String(username), 'utf-8').toString('base64url')}.${scadenza}`;
    const firma = createHmac('sha256', segreto()).update(payload).digest('hex');
    return Buffer.from(`${payload}.${firma}`).toString('base64url');
}

// Restituisce { username } se il token è valido e non scaduto, altrimenti null.
export function verificaToken(token) {
    try {
        const testo = Buffer.from(token, 'base64url').toString('utf-8');
        const parti = testo.split('.');
        if (parti.length !== 3) return null;
        const [nomeCodificato, scadenzaStr, firma] = parti;
        const payload = `${nomeCodificato}.${scadenzaStr}`;
        const firmaAttesa = createHmac('sha256', segreto()).update(payload).digest('hex');
        const a = Buffer.from(firma), b = Buffer.from(firmaAttesa);
        if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
        if (Date.now() > Number(scadenzaStr)) return null;
        return { username: Buffer.from(nomeCodificato, 'base64url').toString('utf-8') };
    } catch (e) {
        return null;
    }
}

// Estrae il token dall'header "Authorization: Bearer <token>" e lo verifica.
// Restituisce { username } oppure null.
export function sessioneDaRichiesta(req) {
    const intestazione = req.headers.authorization || '';
    const token = intestazione.startsWith('Bearer ') ? intestazione.slice(7) : null;
    return token ? verificaToken(token) : null;
}