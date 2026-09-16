/* ============================================================
   BASE DATI DEGLI ATTI NORMATIVI
   Ogni oggetto è un "atto" (legge, editto, regolamento...).
   Per aggiungere un nuovo atto, copia un blocco { ... } e
   modificalo. L'id deve essere unico e senza spazi.
   ============================================================ */

const ATTI = [
  {
    id: "statuto-fondamentale",
    categoria: "Statuto Costituzionale",
    numero: "1",
    anno: "2024",
    titolo: "Statuto Fondamentale della Fazione",
    dataEmanazione: "03 marzo 2024",
    promulgatoDa: "Assemblea dei Fondatori",
    stato: "vigente",
    sommario:
      "Istituisce la Fazione, ne definisce i confini di competenza, gli organi di governo e i diritti fondamentali dei membri.",
    articoli: [
      {
        numero: 1,
        rubrica: "Costituzione della Fazione",
        testo:
          "È costituita la Fazione, comunità organizzata di giocatori operante sul server, con potere di autogoverno sui territori rivendicati secondo le procedure del Regolamento Territoriale.",
      },
      {
        numero: 2,
        rubrica: "Organi di governo",
        testo:
          "Sono organi della Fazione: il Consiglio dei Fondatori, con funzione di indirizzo generale e modifica dello Statuto; il Comandante di Fazione, con funzione esecutiva e di rappresentanza; il Consiglio degli Ufficiali, con funzione consultiva e di gestione operativa.",
      },
      {
        numero: 3,
        rubrica: "Diritti dei membri",
        testo:
          "Ogni membro regolarmente affiliato ha diritto di accesso ai territori comuni, di partecipazione alle attività di fazione e di tutela secondo le norme del Codice di Giustizia. Ha altresì diritto di recedere dall'affiliazione in qualsiasi momento, salvo obblighi assunti.",
      },
      {
        numero: 4,
        rubrica: "Doveri dei membri",
        testo:
          "Ogni membro è tenuto al rispetto del presente Statuto, dei regolamenti derivati e delle decisioni legittimamente assunte dagli organi di governo. È tenuto altresì a contribuire alla difesa e al sostentamento comune secondo le proprie possibilità.",
      },
      {
        numero: 5,
        rubrica: "Gerarchia delle fonti",
        testo:
          "I regolamenti, gli editti e i decreti emanati dagli organi di governo non possono contraddire il presente Statuto. In caso di contrasto, prevale la norma di rango superiore.",
      },
      {
        numero: 6,
        rubrica: "Revisione dello Statuto",
        testo:
          "Il presente Statuto può essere modificato solo con delibera del Consiglio dei Fondatori adottata a maggioranza qualificata dei due terzi.",
      },
    ],
  },
  {
    id: "regolamento-territoriale",
    categoria: "Regolamento",
    numero: "2",
    anno: "2024",
    titolo: "Regolamento Territoriale e delle Rivendicazioni",
    dataEmanazione: "17 marzo 2024",
    promulgatoDa: "Consiglio degli Ufficiali",
    stato: "vigente",
    sommario:
      "Disciplina le modalità di rivendicazione, espansione e cessione dei territori di fazione (claim) e i relativi obblighi di protezione.",
    articoli: [
      {
        numero: 1,
        rubrica: "Rivendicazione dei territori",
        testo:
          "La rivendicazione di nuovo territorio è consentita esclusivamente ai membri di grado Ufficiale o superiore, previa comunicazione al Consiglio degli Ufficiali entro ventiquattro ore dall'operazione.",
      },
      {
        numero: 2,
        rubrica: "Distanza minima dai confini altrui",
        testo:
          "Nessuna rivendicazione può essere effettuata a una distanza inferiore a cento blocchi dal confine di un territorio già rivendicato da altra fazione, salvo accordo scritto tra le parti.",
      },
      {
        numero: 3,
        rubrica: "Obblighi di protezione",
        testo:
          "I territori rivendicati devono essere dotati di adeguate strutture difensive entro trenta giorni dalla rivendicazione. In difetto, il Consiglio può disporne la revoca.",
      },
      {
        numero: 4,
        rubrica: "Cessione e permuta",
        testo:
          "I territori possono essere ceduti o permutati tra membri previa approvazione del Comandante di Fazione, che ne verifica la compatibilità con gli interessi comuni.",
      },
      {
        numero: 5,
        rubrica: "Decadenza per inattività",
        testo:
          "Il territorio il cui titolare risulti inattivo per oltre sessanta giorni consecutivi decade automaticamente e rientra nella disponibilità comune, salvo proroga concessa dal Consiglio.",
      },
    ],
  },
  {
    id: "codice-condotta-pvp",
    categoria: "Codice",
    numero: "3",
    anno: "2024",
    titolo: "Codice di Condotta in Combattimento (PvP)",
    dataEmanazione: "02 aprile 2024",
    promulgatoDa: "Comandante di Fazione",
    stato: "vigente",
    sommario:
      "Stabilisce le regole di ingaggio, le zone protette e i divieti applicabili agli scontri tra giocatori.",
    articoli: [
      {
        numero: 1,
        rubrica: "Zone protette",
        testo:
          "È vietato ogni atto ostile all'interno del territorio centrale di fazione e nel raggio di protezione dei membri di grado inferiore al Soldato, salvo stato di guerra dichiarato ai sensi dell'articolo 3 del Codice Diplomatico.",
      },
      {
        numero: 2,
        rubrica: "Divieto di imboscate su nuovi membri",
        testo:
          "È vietato attaccare membri affiliati da meno di sette giorni, salvo che questi abbiano compiuto atti ostili nei confronti della Fazione.",
      },
      {
        numero: 3,
        rubrica: "Divieto di sfruttamento di bug",
        testo:
          "È vietato l'utilizzo di malfunzionamenti tecnici, duplicazioni o meccaniche non previste per ottenere vantaggio in combattimento. La violazione comporta sanzione immediata ai sensi del Codice di Giustizia.",
      },
      {
        numero: 4,
        rubrica: "Restituzione del bottino",
        testo:
          "In caso di conflitto concluso con accordo di pace, gli oggetti sottratti durante le ostilità restano acquisiti al vincitore, salvo diversa pattuizione tra le parti.",
      },
    ],
  },
  {
    id: "regolamento-economico",
    categoria: "Regolamento",
    numero: "4",
    anno: "2024",
    titolo: "Regolamento Economico e Tributario",
    dataEmanazione: "20 aprile 2024",
    promulgatoDa: "Consiglio degli Ufficiali",
    stato: "vigente",
    sommario:
      "Disciplina il contributo comune, la gestione del tesoro di fazione e le attività commerciali tra membri.",
    articoli: [
      {
        numero: 1,
        rubrica: "Contributo comune",
        testo:
          "Ogni membro è tenuto a versare al tesoro di fazione un contributo periodico stabilito dal Consiglio degli Ufficiali, commisurato alle risorse disponibili e alle esigenze comuni.",
      },
      {
        numero: 2,
        rubrica: "Gestione del tesoro",
        testo:
          "Il tesoro di fazione è amministrato dal Tesoriere, nominato dal Comandante, che ne rende conto al Consiglio con cadenza mensile.",
      },
      {
        numero: 3,
        rubrica: "Libertà di commercio",
        testo:
          "È libero lo scambio di beni tra membri, salvo il divieto di cessione di equipaggiamento strategico a soggetti esterni senza autorizzazione del Consiglio.",
      },
      {
        numero: 4,
        rubrica: "Sanzioni per inadempimento",
        testo:
          "Il mancato versamento del contributo per tre periodi consecutivi comporta la sospensione dai benefici comuni fino a regolarizzazione.",
      },
    ],
  },
  {
    id: "codice-diplomatico",
    categoria: "Codice",
    numero: "5",
    anno: "2024",
    titolo: "Codice Diplomatico e degli Stati di Guerra",
    dataEmanazione: "11 maggio 2024",
    promulgatoDa: "Comandante di Fazione",
    stato: "vigente",
    sommario:
      "Regola le relazioni con le altre fazioni, le procedure di alleanza, tregua e dichiarazione di guerra.",
    articoli: [
      {
        numero: 1,
        rubrica: "Competenza in materia diplomatica",
        testo:
          "Ogni trattativa con fazioni esterne è di competenza esclusiva del Comandante di Fazione o di un suo delegato espressamente autorizzato.",
      },
      {
        numero: 2,
        rubrica: "Alleanze",
        testo:
          "Le alleanze sono formalizzate per iscritto e ratificate dal Consiglio degli Ufficiali. Esse comportano il reciproco divieto di atti ostili e il dovere di assistenza in caso di aggressione da terzi.",
      },
      {
        numero: 3,
        rubrica: "Dichiarazione di guerra",
        testo:
          "Lo stato di guerra è dichiarato dal Comandante, previa comunicazione motivata al Consiglio, e deve essere reso pubblico alla fazione avversaria prima dell'inizio delle ostilità.",
      },
      {
        numero: 4,
        rubrica: "Tregua e trattati di pace",
        testo:
          "Ogni cessazione delle ostilità è formalizzata in un trattato scritto che indichi condizioni, eventuali riparazioni e durata dell'impegno di non belligeranza.",
      },
    ],
  },
  {
    id: "codice-giustizia",
    categoria: "Codice",
    numero: "6",
    anno: "2024",
    titolo: "Codice di Giustizia Interna",
    dataEmanazione: "09 giugno 2024",
    promulgatoDa: "Assemblea dei Fondatori",
    stato: "vigente",
    sommario:
      "Disciplina le infrazioni interne, il procedimento disciplinare e il catalogo delle sanzioni applicabili ai membri.",
    articoli: [
      {
        numero: 1,
        rubrica: "Principio del contraddittorio",
        testo:
          "Nessuna sanzione può essere irrogata senza che al membro accusato sia stata data possibilità di esporre le proprie ragioni dinanzi al Consiglio degli Ufficiali.",
      },
      {
        numero: 2,
        rubrica: "Catalogo delle sanzioni",
        testo:
          "Le sanzioni applicabili sono, in ordine crescente di gravità: richiamo formale, sospensione temporanea dai privilegi, retrocessione di grado, espulsione dalla Fazione.",
      },
      {
        numero: 3,
        rubrica: "Furto tra membri",
        testo:
          "Il furto di beni comuni o appartenenti ad altro membro è punito con la restituzione integrale del maltolto e, nei casi più gravi, con la sospensione temporanea dai privilegi.",
      },
      {
        numero: 4,
        rubrica: "Tradimento",
        testo:
          "La collaborazione con fazioni ostili durante uno stato di guerra dichiarato, o la divulgazione di informazioni riservate a terzi, è punita con l'espulsione immediata e definitiva.",
      },
      {
        numero: 5,
        rubrica: "Diritto di appello",
        testo:
          "Avverso le decisioni del Consiglio degli Ufficiali è ammesso appello al Comandante di Fazione, da proporsi entro tre giorni dalla comunicazione della sanzione.",
      },
    ],
  },
  {
    id: "regolamento-gradi",
    categoria: "Regolamento",
    numero: "7",
    anno: "2024",
    titolo: "Regolamento dei Gradi e delle Nomine",
    dataEmanazione: "01 luglio 2024",
    promulgatoDa: "Comandante di Fazione",
    stato: "vigente",
    sommario:
      "Definisce la scala gerarchica interna, i requisiti di avanzamento e le modalità di nomina alle cariche di fazione.",
    articoli: [
      {
        numero: 1,
        rubrica: "Scala gerarchica",
        testo:
          "I gradi della Fazione, in ordine crescente, sono: Recluta, Membro, Soldato, Ufficiale, Comandante. A ciascun grado corrispondono diritti e responsabilità specifiche.",
      },
      {
        numero: 2,
        rubrica: "Requisiti di avanzamento",
        testo:
          "L'avanzamento di grado è deliberato dal Consiglio degli Ufficiali sulla base di anzianità, contributo alla vita comune e condotta conforme al presente Statuto.",
      },
      {
        numero: 3,
        rubrica: "Nomina degli Ufficiali",
        testo:
          "Gli Ufficiali sono nominati dal Comandante tra i membri di grado Soldato con almeno trenta giorni di anzianità, sentito il parere del Consiglio.",
      },
      {
        numero: 4,
        rubrica: "Successione del Comandante",
        testo:
          "In caso di cessazione dell'incarico, il nuovo Comandante è eletto dal Consiglio dei Fondatori tra gli Ufficiali in carica, a maggioranza semplice.",
      },
    ],
  },
];
