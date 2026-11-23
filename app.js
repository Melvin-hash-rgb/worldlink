"use strict";
/* ============================================================
   WorldLink — application (version publique, GitHub Pages + Supabase)
   « Faciliter la vie aux gens »

   Règles du produit (non négociables) :
   - Personne n'entre sans compte : porte d'entrée d'abord.
   - Accueil propre : on clique pour entrer dans une pièce.
   - Jamais de page morte, jamais de « 0 résultat », aucun compteur.
   - Logement : le budget tapé est un point de départ (à partir de
     la somme, en montant, bande plafonnée à 1,5×).
   - Toute publication appartient à son auteur (user_id).
   ============================================================ */

/* ---------------- Utilitaires ---------------- */
const $ = (sel) => document.querySelector(sel);

function esc(s) {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/* Comparaison sans accents et sans casse : « Pékin » = « pekin » */
function norm(s) {
  if (!s) return "";
  return String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().trim();
}

function fmtNum(n) {
  if (n === null || n === undefined || n === "") return "";
  const v = Number(n);
  if (Number.isNaN(v)) return esc(n);
  return v.toLocaleString("fr-FR");
}

function toast(text) {
  const t = $("#toast");
  t.textContent = text;
  t.classList.remove("hidden");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => t.classList.add("hidden"), 3200);
}

function validPhoto(url) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  if (/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(url) && url.length < 1400000) return url;
  return "";
}

/* Photo choisie dans le téléphone : redimensionnée, puis gardée en mémoire (data URL) */
const pickedPhotos = {};
function handlePhotoFile(input, key, previewId) {
  const file = input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const max = 900;
      let w = img.width, h = img.height;
      if (w > max || h > max) { const r = Math.min(max / w, max / h); w = Math.round(w * r); h = Math.round(h * r); }
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      pickedPhotos[key] = canvas.toDataURL("image/jpeg", 0.82);
      const prev = document.getElementById(previewId);
      if (prev) { prev.src = pickedPhotos[key]; prev.classList.remove("hidden"); }
      toast("Photo ajoutée 📷");
      const ownerForm = document.getElementById(PHOTO_FORM[key]);
      if (ownerForm) saveDraft(ownerForm);
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}
function wirePhotoPickers() {
  [["pro-photo-file", "pro", "pro-photo-preview"],
   ["house-photo-file", "house", "house-photo-preview"],
   ["post-photo-file", "post", "post-photo-preview"],
   ["status-photo-file", "status", "status-photo-preview"]].forEach(([id, key, prev]) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("change", () => handlePhotoFile(el, key, prev));
  });
}
function chosenPhoto(key, urlValue) {
  return pickedPhotos[key] || (urlValue && urlValue.trim()) || null;
}
function clearPicked(key, previewId) {
  delete pickedPhotos[key];
  const p = document.getElementById(previewId);
  if (p) { p.removeAttribute("src"); p.classList.add("hidden"); }
}

/* ---------------- Brouillons des formulaires ----------------
   Ce que l'utilisateur tape est gardé dans son téléphone : s'il sort du site
   et revient, il retrouve ses informations au lieu de tout recommencer. */
const DRAFT_FORMS = { "form-pro": "pro", "form-job": "job", "form-housing": "house", "form-post": "post", "form-status": "status" };
const PHOTO_FORM = { pro: "form-pro", house: "form-housing", post: "form-post", status: "form-status" };
function draftKey(formId) { return "wl_draft_" + formId + "_" + (currentUser ? currentUser.id : "anon"); }
function saveDraft(form) {
  if (!form || !DRAFT_FORMS[form.id]) return;
  const data = {};
  form.querySelectorAll("input, textarea, select").forEach((el) => {
    if (!el.id || el.type === "file") return;
    data[el.id] = el.value;
  });
  const photoKey = DRAFT_FORMS[form.id];
  if (photoKey !== "job" && pickedPhotos[photoKey]) data.__photo = pickedPhotos[photoKey];
  try { localStorage.setItem(draftKey(form.id), JSON.stringify(data)); }
  catch (e) {
    /* Photo trop lourde pour la mémoire du téléphone : on garde au moins le texte. */
    delete data.__photo;
    try { localStorage.setItem(draftKey(form.id), JSON.stringify(data)); } catch (e2) { /* mémoire pleine : on laisse tomber */ }
  }
}
function restoreDraft(formId) {
  const form = document.getElementById(formId);
  if (!form) return;
  let data = null;
  try { data = JSON.parse(localStorage.getItem(draftKey(formId)) || "null"); } catch (e) { data = null; }
  if (!data) return;
  Object.keys(data).forEach((id) => {
    if (id === "__photo") return;
    const el = document.getElementById(id);
    if (el) el.value = data[id];
  });
  const photoKey = DRAFT_FORMS[formId];
  if (data.__photo && photoKey !== "job") {
    pickedPhotos[photoKey] = data.__photo;
    const prev = document.getElementById(photoKey + "-photo-preview");
    if (prev) { prev.src = data.__photo; prev.classList.remove("hidden"); }
  }
}
function restoreAllDrafts() { Object.keys(DRAFT_FORMS).forEach(restoreDraft); }
function clearDraft(formId) { try { localStorage.removeItem(draftKey(formId)); } catch (e) { /* rien */ } }
function wireDrafts() {
  Object.keys(DRAFT_FORMS).forEach((formId) => {
    const form = document.getElementById(formId);
    if (!form) return;
    form.addEventListener("input", () => saveDraft(form));
    form.addEventListener("change", () => saveDraft(form));
  });
}

/* ---------------- Données statiques : Découverte ---------------- */
const COMMONS = "https://commons.wikimedia.org/wiki/Special:FilePath/";
const DISCO_IMAGES = [
  ["Yaounde,_Cameroon.jpg", "Yaoundé — Cameroun"],
  ["Mount_Cameroon.jpg", "Le mont Cameroun — Cameroun"],
  ["Pyramids_of_the_Giza_Necropolis.jpg", "Les pyramides de Gizeh — Égypte"],
  ["Victoria_Falls_2012.jpg", "Les chutes Victoria — Zambie / Zimbabwe"],
  ["Mount_Kilimanjaro.jpg", "Le Kilimandjaro — Tanzanie"],
  ["Great_Wall_of_China_July_2006.JPG", "La Grande Muraille — Chine"],
  ["Mount_Fuji.jpg", "Le mont Fuji — Japon"],
  ["Angkor_Wat.jpg", "Angkor Vat — Cambodge"],
  ["Taj_Mahal_in_March_2004.jpg", "Le Taj Mahal — Inde"],
  ["Marina_Bay_Sands,_Singapore.jpg", "Marina Bay — Singapour"],
  ["Tour_Eiffel_Wikimedia_Commons.jpg", "La tour Eiffel — Paris, France"],
  ["Louvre_Museum_Wikimedia_Commons.jpg", "Le musée du Louvre — Paris, France"],
  ["Colosseum_in_Rome,_Italy_-_April_2007.jpg", "Le Colisée — Rome, Italie"],
  ["Big_Ben_2007-1.jpg", "Big Ben — Londres, Royaume-Uni"],
  ["Oia,_Santorini,_Greece.jpg", "Santorin — Grèce"],
  ["Toronto_-_ON_-_Toronto_Skyline2.jpg", "Toronto — Canada"],
  ["Montreal_Skyline.jpg", "Montréal — Canada"],
  ["Moraine_Lake.jpg", "Le lac Moraine — Canada"],
  ["Niagara_Falls_from_the_Canadian_side.jpg", "Les chutes du Niagara — Canada"],
  ["Statue_of_Liberty_frontal_2.jpg", "La statue de la Liberté — New York, États-Unis"],
  ["Manhattan,_New_York_City.jpg", "Manhattan — New York, États-Unis"],
  ["Grand_Canyon,_Arizona.jpg", "Le Grand Canyon — États-Unis"],
  ["Sydney_Opera_House_-_Dec_2008.jpg", "L'Opéra de Sydney — Australie"],
  ["Machu_Picchu,_Peru.jpg", "Le Machu Picchu — Pérou"],
  ["Mount_Everest_as_seen_from_Drukair2_PLW_edit.jpg", "Le mont Everest — Himalaya"],
  ["Aurora_borealis_over_Eielson_Air_Force_Base,_Alaska.jpg", "Aurore boréale — Alaska"]
];

const DISCO_VIDEOS = [
  ["Videos_of_waterfalls", "Chutes d'eau du monde", "Les plus belles chutes, en vidéo", "Niagara_Falls_from_the_Canadian_side.jpg"],
  ["Videos_of_Africa", "L'Afrique en vidéo", "Villes, nature et vie quotidienne", "Yaounde,_Cameroon.jpg"],
  ["Videos_of_New_York_City", "New York en vidéo", "La ville qui ne dort jamais", "Manhattan,_New_York_City.jpg"],
  ["Videos_of_mountains", "Montagnes du monde", "Sommets et grands paysages", "Mount_Everest_as_seen_from_Drukair2_PLW_edit.jpg"],
  ["Videos_of_animals", "Animaux du monde", "La faune sauvage en images", "Mount_Cameroon.jpg"],
  ["Videos_of_beaches", "Plages du monde", "Le bord de mer, partout", "Oia,_Santorini,_Greece.jpg"],
  ["Videos_of_sunsets", "Couchers de soleil", "Les plus beaux ciels du soir", "Grand_Canyon,_Arizona.jpg"],
  ["Videos_of_trains", "Trains et voyages", "Voyager autrement", "Toronto_-_ON_-_Toronto_Skyline2.jpg"],
  ["Videos_of_lakes", "Lacs du monde", "Des eaux calmes et magnifiques", "Moraine_Lake.jpg"],
  ["Videos_of_rivers", "Fleuves et rivières", "Les grandes eaux du monde", "Victoria_Falls_2012.jpg"],
  ["Videos_of_clouds", "Nuages et ciel", "Le ciel en mouvement", "Aurora_borealis_over_Eielson_Air_Force_Base,_Alaska.jpg"],
  ["Videos_of_snow", "Neige et hiver", "Les paysages blancs", "Mount_Fuji.jpg"]
];

const DISCO_NEWS = [
  ["L'actualité africaine", "BBC Afrique", "https://www.bbc.com/afrique", "Yaounde,_Cameroon.jpg"],
  ["L'actualité du Cameroun", "Journal du Cameroun", "https://www.journalducameroun.com/", "Mount_Cameroon.jpg"],
  ["Infos du Cameroun", "Cameroon Tribune", "https://www.cameroon-tribune.cm/", "Mount_Kilimanjaro.jpg"],
  ["Le monde en français", "RFI", "https://www.rfi.fr/fr/", "Tour_Eiffel_Wikimedia_Commons.jpg"],
  ["Nouvelles internationales", "France 24", "https://www.france24.com/fr/", "Louvre_Museum_Wikimedia_Commons.jpg"],
  ["L'actualité du Canada", "Radio-Canada", "https://ici.radio-canada.ca/", "Montreal_Skyline.jpg"],
  ["L'actualité du monde", "Le Monde", "https://www.lemonde.fr/", "Big_Ben_2007-1.jpg"],
  ["Infos francophones", "TV5Monde", "https://www.tv5monde.com/", "Statue_of_Liberty_frontal_2.jpg"],
  ["L'actualité européenne", "Euronews", "https://fr.euronews.com/", "Colosseum_in_Rome,_Italy_-_April_2007.jpg"],
  ["Le monde vu d'Allemagne", "DW — Deutsche Welle", "https://www.dw.com/fr/", "Machu_Picchu,_Peru.jpg"]
];

/* ---------------- Données statiques : Transferts ---------------- */
/* Taux INDICATIFS pour 1 EUR (la monnaie de destination dépend du pays tapé) */
const DEST_CURRENCIES = [
  [["cameroun", "gabon", "tchad", "centrafrique", "guinee equatoriale", "brazzaville"], "XAF", 655.96],
  [["senegal", "mali", "cote d'ivoire", "burkina faso", "benin", "togo", "niger", "guinee-bissau"], "XOF", 655.96],
  [["congo", "rdc", "kinshasa"], "CDF", 3050], [["kenya"], "KES", 140],
  [["nigeria"], "NGN", 1650], [["ghana"], "GHS", 16.5], [["maroc"], "MAD", 10.9],
  [["canada"], "CAD", 1.47], [["etats-unis", "usa", "amerique", "new york", "houston"], "USD", 1.09],
  [["royaume-uni", "angleterre", "londres"], "GBP", 0.85], [["chine"], "CNY", 7.85],
  [["suisse"], "CHF", 0.94], [["france", "belgique", "allemagne", "espagne", "italie", "portugal", "europe"], "EUR", 1],
  [["madagascar"], "MGA", 4900], [["ethiopie"], "ETB", 160], [["angola"], "AOA", 950],
  [["haiti"], "HTG", 132], [["rwanda"], "RWF", 1450], [["ouganda"], "UGX", 3800],
  [["tanzanie"], "TZS", 2650], [["afrique du sud"], "ZAR", 19.5], [["egypte"], "EGP", 52],
  [["algerie"], "DZD", 135], [["tunisie"], "TND", 3.15], [["zambie"], "ZMW", 27],
  [["zimbabwe"], "USD", 1.09], [["mauritanie"], "MRU", 43], [["guinee"], "GNF", 9350],
  [["burundi"], "BIF", 2950], [["djibouti"], "DJF", 193], [["comores"], "KMF", 492]
];
/* Valeur de 1 unité de la devise d'envoi, en EUR (indicatif) */
const EUR_VALUE = { EUR: 1, CAD: 0.68, USD: 0.92, GBP: 1.17 };
const TRANSFER_SERVICES = [
  { name: "Wise",          url: "https://wise.com",          fixed: 0.5, pct: 0.6, margin: 0.0, delay: "Quelques heures" },
  { name: "Sendwave",      url: "https://www.sendwave.com",  fixed: 0.0, pct: 0.0, margin: 2.2, delay: "Quelques minutes" },
  { name: "Remitly",       url: "https://www.remitly.com",   fixed: 1.0, pct: 0.4, margin: 1.5, delay: "Quelques minutes à 1 jour" },
  { name: "WorldRemit",    url: "https://www.worldremit.com", fixed: 1.5, pct: 0.8, margin: 1.8, delay: "Quelques minutes à 1 jour" },
  { name: "MoneyGram",     url: "https://www.moneygram.com", fixed: 2.5, pct: 1.2, margin: 2.5, delay: "Quelques minutes" },
  { name: "Western Union", url: "https://www.westernunion.com", fixed: 3.0, pct: 1.5, margin: 3.0, delay: "Quelques minutes à 2 jours" }
];

function destCurrency(destinationText) {
  const d = norm(destinationText);
  for (const [names, code, rate] of DEST_CURRENCIES) {
    if (names.some((n) => d.includes(n))) return { code, rate };
  }
  return null; /* Pays pas encore dans la table : on ne devine jamais un taux. */
}

/* Villes et pays que l'assistant et la recherche reconnaissent (saisie libre) */
const WORLD_PLACES = [
  "douala", "yaounde", "bafoussam", "bamenda", "garoua", "maroua", "ngaoundere", "bertoua",
  "kribi", "limbe", "buea", "dschang", "nkongsamba", "edea", "cameroun",
  "montreal", "toronto", "ottawa", "vancouver", "calgary", "quebec", "canada",
  "paris", "lyon", "marseille", "lille", "nantes", "bordeaux", "france",
  "bruxelles", "belgique", "geneve", "suisse", "londres", "royaume-uni", "angleterre",
  "new york", "los angeles", "houston", "chicago", "miami", "etats-unis", "usa",
  "pekin", "shanghai", "chine", "dubai", "stockholm", "goteborg", "suede", "oslo", "norvege",
  "berlin", "allemagne", "madrid", "espagne", "lisbonne", "portugal",
  "dakar", "senegal", "abidjan", "cote d'ivoire", "accra", "ghana", "lagos", "nigeria",
  "nairobi", "kenya", "kinshasa", "brazzaville", "congo", "libreville", "gabon",
  "bamako", "mali", "ouagadougou", "burkina faso", "niamey", "niger", "cotonou", "benin",
  "lome", "togo", "conakry", "guinee", "rabat", "casablanca", "maroc", "alger", "algerie",
  "tunis", "tunisie", "le caire", "egypte", "addis abeba", "ethiopie",
  "johannesburg", "afrique du sud", "luanda", "angola", "maputo", "mozambique", "antananarivo", "madagascar",
  "port-au-prince", "haiti", "kigali", "rwanda", "kampala", "ouganda", "dar es salaam", "tanzanie",
  "lusaka", "zambie", "harare", "zimbabwe", "nouakchott", "mauritanie", "ndjamena", "tchad",
  "bangui", "centrafrique", "bujumbura", "burundi", "djibouti"
];

/* ---------------- État de l'application ---------------- */
let sb = null;              // client Supabase
let currentUser = null;     // utilisateur connecté
let DATA = { pros: [], jobs: [], housing: [], posts: [], likes: [], comments: [], statuses: [] };

function firstName() {
  const full = (currentUser && currentUser.user_metadata && currentUser.user_metadata.full_name) || "";
  if (full.trim()) return full.trim().split(/\s+/)[0];
  return currentUser ? currentUser.email.split("@")[0] : "";
}
function displayName() {
  const full = (currentUser && currentUser.user_metadata && currentUser.user_metadata.full_name) || "";
  return full.trim() || (currentUser ? currentUser.email : "");
}

/* ---------------- Navigation ---------------- */
const PAGES = ["home", "results", "travail", "logement", "marche", "transferts", "decouverte", "assistant", "mes-publications", "confidentialite", "conditions", "contact", "actus"];
function showPage(name) {
  for (const p of PAGES) {
    const el = $("#page-" + p);
    if (el) el.classList.toggle("hidden", p !== name);
  }
  window.scrollTo(0, 0);
}
function go(name) {
  if (name === "home") renderHomeLatest();
  if (name === "actus") renderActus();
  if (name === "travail") renderTravail();
  if (name === "logement") renderLogement();
  if (name === "marche") renderMarche();
  if (name === "mes-publications") renderMine();
  if (name === "transferts") renderTransfers();
  showPage(name);
  if (name !== "results") { try { localStorage.setItem("wl_last_page", name); } catch (e) { /* rien */ } }
}

/* ---------------- Écrans principaux ---------------- */
function showOnly(id) {
  for (const v of ["view-loading", "view-config", "view-auth", "view-app"]) {
    const el = document.getElementById(v);
    if (el) el.classList.toggle("hidden", v !== id);
  }
}

function enterApp() {
  $("#hello-user").textContent = "Bonjour, " + firstName();
  showOnly("view-app");
  showPage("home");
  restoreAllDrafts();
  loadData().then(() => {
    renderDiscovery();
    renderHomeLatest();
    seedAssistant();
    let last = null;
    try { last = localStorage.getItem("wl_last_page"); } catch (e) { last = null; }
    if (last && last !== "home" && last !== "results" && PAGES.includes(last)) go(last);
  });
}

/* ---------------- Authentification ---------------- */
function authErrorText(error) {
  if (!error) return "";
  const m = error.message || "";
  if (/Invalid login credentials/i.test(m)) return "Courriel ou mot de passe incorrect. Réessaie.";
  if (/already registered/i.test(m)) return "Ce courriel a déjà un compte. Connecte-toi plutôt.";
  if (/Password should be/i.test(m)) return "Mot de passe trop court : 6 caractères minimum.";
  if (/Email not confirmed/i.test(m)) return "Ton courriel n'est pas encore confirmé : ouvre le message de Supabase dans ta boîte et clique le lien, puis connecte-toi.";
  return m;
}

async function handleLogin(e) {
  e.preventDefault();
  const msg = $("#login-msg");
  msg.textContent = ""; msg.className = "form-msg";
  const email = $("#login-email").value.trim();
  const password = $("#login-password").value;
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) { msg.textContent = authErrorText(error); msg.classList.add("error"); }
  /* En cas de succès, onAuthStateChange prend le relais. */
}

async function handleSignup(e) {
  e.preventDefault();
  const msg = $("#signup-msg");
  msg.textContent = ""; msg.className = "form-msg";
  const name = $("#signup-name").value.trim();
  const email = $("#signup-email").value.trim();
  const p1 = $("#signup-password").value;
  const p2 = $("#signup-password2").value;
  if (p1 !== p2) { msg.textContent = "Les deux mots de passe ne sont pas identiques."; msg.classList.add("error"); return; }
  const { data, error } = await sb.auth.signUp({
    email, password: p1,
    options: { data: { full_name: name } }
  });
  if (error) { msg.textContent = authErrorText(error); msg.classList.add("error"); return; }
  if (!data.session) {
    msg.textContent = "Compte créé ! Supabase t'a envoyé un courriel de confirmation : clique le lien dedans, puis reviens te connecter.";
    msg.classList.add("ok");
  }
  /* Si une session est ouverte, onAuthStateChange prend le relais. */
}

async function handleLogout() {
  await sb.auth.signOut();
  currentUser = null;
  try { localStorage.removeItem("wl_last_page"); } catch (e) { /* rien */ }
  showOnly("view-auth");
}

/* ---------------- Chargement des données ---------------- */
async function loadData() {
  const [pros, jobs, housing, posts, likes, comments, statuses] = await Promise.all([
    sb.from("professionals").select("*").order("created_at", { ascending: false }),
    sb.from("job_offers").select("*").order("created_at", { ascending: false }),
    sb.from("housing").select("*").order("created_at", { ascending: false }),
    sb.from("market_posts").select("*").order("created_at", { ascending: false }),
    sb.from("market_likes").select("*"),
    sb.from("market_comments").select("*").order("created_at", { ascending: true }),
    sb.from("statuses").select("*").order("created_at", { ascending: false })
  ]);
  DATA.pros = pros.data || [];
  DATA.jobs = jobs.data || [];
  DATA.housing = housing.data || [];
  DATA.posts = posts.data || [];
  DATA.likes = likes.data || [];
  DATA.comments = comments.data || [];
  DATA.statuses = statuses.data || [];
}

/* ---------------- Partage ---------------- */
function shareText(title, city) {
  return "Regarde cette annonce sur WorldLink — Faciliter la vie aux gens : " +
    title + (city ? " (" + city + ")" : "") + " — " + window.location.href;
}
async function shareItem(title, city) {
  const text = shareText(title, city);
  if (navigator.share) {
    try { await navigator.share({ title: "WorldLink", text }); return; }
    catch (e) { /* l'utilisateur a annulé : on ne force rien */ return; }
  }
  try {
    await navigator.clipboard.writeText(text);
    toast("Texte copié — colle-le à tes contacts pour partager.");
  } catch (e) {
    window.prompt("Copie ce texte pour le partager :", text);
  }
}

/* ---------------- Panneau « jamais vide » ---------------- */
function arrivePanel(place, roomLabel, goTarget) {
  const where = place ? " à " + esc(place) : "";
  return '<div class="arrive-panel">' +
    '<div class="big-emoji">🌍</div>' +
    "<h3>WorldLink arrive ici" + where + "</h3>" +
    "<p>Les premières annonces" + where + " commencent à être publiées. " +
    "En attendant, regarde ce qui existe déjà ailleurs — et si tu as quelque chose à offrir, sois le premier" + where + " !</p>" +
    '<button type="button" class="btn-gold" data-go="' + goTarget + '">Publier dans ' + roomLabel + "</button>" +
    "</div>";
}

/* ---------------- Cartes d'annonces ---------------- */
/* Coordonnées approximatives des centres-villes (géographie publique) pour afficher la carte de la ville cherchée, comme Google. */
const CITY_COORDS = {
  douala: [4.0511, 9.7679], yaounde: [3.848, 11.5021], bafoussam: [5.4781, 10.4208],
  bamenda: [5.9597, 10.1459], garoua: [9.3076, 13.3939], maroua: [10.5916, 14.3158],
  ngaoundere: [7.3167, 13.5833], bertoua: [4.5833, 13.6833], buea: [4.156, 9.2632],
  limbe: [4.0, 9.2167], kribi: [2.94, 9.91], edea: [3.8, 10.1333],
  montreal: [45.5017, -73.5673], toronto: [43.6532, -79.3832], ottawa: [45.4215, -75.6972],
  vancouver: [49.2827, -123.1207], quebec: [46.8139, -71.208],
  paris: [48.8566, 2.3522], lyon: [45.764, 4.8357], marseille: [43.2965, 5.3698],
  bruxelles: [50.8503, 4.3517], geneve: [46.2044, 6.1432], londres: [51.5074, -0.1278],
  "new york": [40.7128, -74.006], dakar: [14.7167, -17.4677], abidjan: [5.36, -4.0083],
  kinshasa: [-4.4419, 15.2663], brazzaville: [-4.2634, 15.2429], libreville: [0.4162, 9.4673],
  ndjamena: [12.1348, 15.0557], bamako: [12.6392, -8.0029], ouagadougou: [12.3714, -1.5197],
  cotonou: [6.3703, 2.3912], lome: [6.1375, 1.2221], accra: [5.6037, -0.187],
  lagos: [6.5244, 3.3792], "pointe noire": [-4.7692, 11.8664], luanda: [-8.8383, 13.2344],
  antananarivo: [-18.9137, 47.5361], "port au prince": [18.5421, -72.3368],
};
function findCityCoords(text) {
  const t = norm(text || "");
  if (!t) return null;
  for (const name of Object.keys(CITY_COORDS)) {
    if (t.includes(name)) return { name, lat: CITY_COORDS[name][0], lon: CITY_COORDS[name][1] };
  }
  return null;
}
function mapHtml(placeText, label) {
  const c = findCityCoords(placeText);
  if (!c) return "";
  const bbox = (c.lon - 0.09) + "," + (c.lat - 0.055) + "," + (c.lon + 0.09) + "," + (c.lat + 0.055);
  return '<div class="map-wrap"><iframe title="Carte" loading="lazy" src="https://www.openstreetmap.org/export/embed.html?bbox=' +
    bbox + "&layer=mapnik&marker=" + c.lat + "," + c.lon + '"></iframe>' +
    '<p class="map-caption">📍 ' + esc(label || c.name) + ' — <a target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=' +
    encodeURIComponent(label || c.name) + '">Ouvrir dans Google Maps</a></p></div>';
}
function itineraireBtn(query) {
  return '<a class="btn-action" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=' +
    encodeURIComponent(query) + '">🧭 Itinéraire</a>';
}
function photoBig(url, emoji) {
  const u = validPhoto(url);
  if (u) return '<img class="card-photo-big" src="' + esc(u) + '" alt="" loading="lazy" onerror="this.outerHTML=\'<div class=&quot;card-photo-big placeholder&quot;>' + emoji + '</div>\'">';
  return '<div class="card-photo-big placeholder">' + emoji + "</div>";
}

function photoHtml(url, emoji) {
  const u = validPhoto(url);
  if (u) return '<img class="card-photo" src="' + esc(u) + '" alt="" loading="lazy" onerror="this.outerHTML=\'<div class=&quot;card-photo placeholder&quot;>' + emoji + '</div>\'">';
  return '<div class="card-photo placeholder">' + emoji + "</div>";
}

function proCard(p) {
  const tel = esc(String(p.phone).replace(/\s+/g, ""));
  return '<article class="card visual-card">' + photoBig(p.photo_url, "🧑‍🔧") +
    '<div class="card-body">' +
    '<p class="card-title">' + esc(p.name) + ' <span class="badge">' + esc(p.trade) + "</span></p>" +
    '<p class="card-meta">📍 ' + esc(p.city) + ", " + esc(p.country) +
    (p.age ? " · " + esc(p.age) + " ans" : "") + "</p>" +
    '<p class="card-meta">📞 ' + esc(p.phone) + "</p>" +
    '<div class="action-circles">' +
    '<a class="circle-btn" href="tel:' + tel + '"><span class="circle-ico">📞</span><span class="circle-label">Appeler</span></a>' +
    '<a class="circle-btn" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=' +
      encodeURIComponent(p.trade + " " + p.city + " " + p.country) + '"><span class="circle-ico">🧭</span><span class="circle-label">Itinéraire</span></a>' +
    '<button type="button" class="circle-btn" data-share="' + esc(p.trade + " — " + p.name) + "|" + esc(p.city) + '"><span class="circle-ico">↗️</span><span class="circle-label">Partager</span></button>' +
    "</div></div></article>";
}

function jobCard(j) {
  return '<article class="card"><div class="card-head">' + photoHtml("", "🏢") +
    '<div class="card-main">' +
    '<p class="card-title">' + esc(j.title) + ' <span class="badge gold">' + esc(j.job_type) + "</span></p>" +
    '<p class="card-meta">🏢 ' + esc(j.company) + " · 📍 " + esc(j.city) + ", " + esc(j.country) + "</p>" +
    (j.description ? '<p class="card-desc">' + esc(j.description) + "</p>" : "") +
    '<div class="card-actions">' +
    '<button type="button" class="btn-action" data-contact="' + esc(j.contact) + '">✉️ Postuler / Contacter</button>' +
    itineraireBtn(j.company + " " + j.city + " " + j.country) +
    '<button type="button" class="btn-action" data-share="' + esc(j.title + " chez " + j.company) + "|" + esc(j.city) + '">↗️ Partager</button>' +
    "</div>" +
    '<div class="card-contact hidden">📩 Pour postuler, envoie ton CV à : <strong>' + esc(j.contact) + "</strong></div>" +
    "</div></div></article>";
}

function housingCard(h) {
  return '<article class="card visual-card">' + photoBig(h.photo_url, "🏠") +
    '<div class="card-body">' +
    '<p class="card-title">' + esc(h.title) + "</p>" +
    '<p class="card-meta">📍 ' + esc(h.city) + ", " + esc(h.country) + "</p>" +
    '<p class="card-price">' + fmtNum(h.price) + "</p>" +
    (h.description ? '<p class="card-desc">' + esc(h.description) + "</p>" : "") +
    '<div class="card-actions">' +
    (h.contact ? '<button type="button" class="btn-action" data-contact="' + esc(h.contact) + '">📞 Contacter le propriétaire</button>' : "") +
    itineraireBtn(h.title + " " + h.city + " " + h.country) +
    '<button type="button" class="btn-action" data-share="' + esc(h.title) + "|" + esc(h.city) + '">↗️ Partager</button>' +
    "</div>" +
    (h.contact ? '<div class="card-contact hidden">📞 Contact du propriétaire : <strong>' + esc(h.contact) + "</strong></div>" : "") +
    "</div></article>";
}

function likesCount(postId) { return DATA.likes.filter((l) => l.post_id === postId).length; }
function userLiked(postId) {
  return currentUser && DATA.likes.some((l) => l.post_id === postId && l.user_id === currentUser.id);
}
function postComments(postId) { return DATA.comments.filter((c) => c.post_id === postId); }

function postCard(p) {
  /* Publication façon Instagram : en-tête du vendeur, grande photo, barre
     d'icônes (cœur, commentaire, partage), nombre de J'aime, légende. */
  const liked = userLiked(p.id);
  const comments = postComments(p.id);
  const nLikes = likesCount(p.id);
  const seller = p.seller_name || "Membre WorldLink";
  const initial = esc(seller.trim().charAt(0).toUpperCase() || "W");
  const commentsHtml = comments.map((c) =>
    '<div class="comment"><span class="c-author">' + esc(c.author_name || "Utilisateur") +
    " :</span> " + esc(c.body) + "</div>").join("");
  return '<article class="card ig-post">' +
    '<div class="ig-head"><span class="ig-avatar">' + initial + '</span>' +
    '<span class="ig-who"><strong>' + esc(seller) + "</strong>" +
    '<span class="ig-where">📍 ' + esc(p.city) + (p.country ? ", " + esc(p.country) : "") + "</span></span></div>" +
    photoBig(p.photo_url, "🛍️") +
    '<div class="card-body">' +
    '<div class="ig-actions">' +
    '<button type="button" class="ig-btn" data-like="' + p.id + '" aria-label="J\'aime">' + (liked ? "❤️" : "🤍") + "</button>" +
    '<button type="button" class="ig-btn" data-comments="' + p.id + '" aria-label="Commentaires">💬</button>' +
    '<button type="button" class="ig-btn" data-share="' + esc(p.title) + "|" + esc(p.city) + '" aria-label="Partager">↗️</button>' +
    '<a class="ig-btn ig-pin" target="_blank" rel="noopener" aria-label="Itinéraire" href="https://www.google.com/maps/search/?api=1&query=' +
      encodeURIComponent(p.title + " " + p.city + " " + (p.country || "")) + '">🧭</a>' +
    '<button type="button" class="ig-order" data-contact="' + esc(p.contact) + '">🛒 Commander</button>' +
    "</div>" +
    (nLikes ? '<p class="ig-likes">❤️ ' + nLikes + " J'aime</p>" : "") +
    '<p class="ig-caption"><strong>' + esc(seller) + "</strong> " + esc(p.title) +
    (p.price !== null && p.price !== "" && p.price !== undefined ? " — <strong>" + fmtNum(p.price) + "</strong>" : "") +
    (p.description ? " · " + esc(p.description) : "") + "</p>" +
    (comments.length ? '<button type="button" class="ig-view-comments" data-comments="' + p.id + '">Voir les ' + comments.length + " commentaire" + (comments.length > 1 ? "s" : "") + "</button>" : "") +
    '<p class="ig-time">' + timeAgo(p.created_at) + "</p>" +
    '<div class="card-contact hidden">🛒 Pour commander, contacte le vendeur : <strong>' + esc(p.contact) + "</strong></div>" +
    '<div class="comments hidden" id="comments-' + p.id + '">' + commentsHtml +
    '<form class="comment-form" data-comment-form="' + p.id + '">' +
    '<input type="text" placeholder="Ajoute un commentaire…" required maxlength="500">' +
    '<button type="submit" class="btn-outline">Publier</button></form></div>' +
    "</div></article>";
}

/* ---------------- Recherche d'accueil (toutes les pièces) ---------------- */
function matchesQuery(item, fields, q) {
  const hay = norm(fields.map((f) => item[f] || "").join(" "));
  return q.split(/\s+/).every((word) => !word || hay.includes(word));
}

function doHomeSearch(e) {
  e.preventDefault();
  const q = norm($("#home-search").value);
  const box = $("#results-content");
  $("#results-query").textContent = q ? "Tu as cherché : « " + $("#home-search").value.trim() + " »" : "";
  if (!q) { showPage("home"); return; }

  const pros = DATA.pros.filter((p) => matchesQuery(p, ["name", "trade", "city", "country"], q));
  const jobs = DATA.jobs.filter((j) => matchesQuery(j, ["title", "company", "city", "country"], q));
  const housing = DATA.housing.filter((h) => matchesQuery(h, ["title", "city", "country"], q));
  const posts = DATA.posts.filter((p) => matchesQuery(p, ["title", "city", "country", "description"], q));

  let html = mapHtml($("#home-search").value, $("#home-search").value.trim());
  if (!pros.length && !jobs.length && !housing.length && !posts.length) {
    html += arrivePanel($("#home-search").value.trim(), "les pièces", "home");
    html += "<h3 class='section-title'>En attendant, tout ce qui est déjà publié</h3>";
    html += DATA.pros.map(proCard).join("") + DATA.jobs.map(jobCard).join("") +
            DATA.housing.map(housingCard).join("") + DATA.posts.map(postCard).join("");
    if (!DATA.pros.length && !DATA.jobs.length && !DATA.housing.length && !DATA.posts.length) {
      html += '<p class="empty-note">WorldLink vient d\'ouvrir : sois le premier à publier dans la pièce de ton choix.</p>';
    }
  } else {
    if (pros.length) html += "<h3 class='section-title'>Professionnels</h3>" + pros.map(proCard).join("");
    if (jobs.length) html += "<h3 class='section-title'>Offres d'emploi</h3>" + jobs.map(jobCard).join("");
    if (housing.length) html += "<h3 class='section-title'>Logements</h3>" + housing.map(housingCard).join("");
    if (posts.length) html += "<h3 class='section-title'>Marché</h3>" + posts.map(postCard).join("");
  }
  box.innerHTML = html;
  showPage("results");
}

/* ---------------- Accueil : le fil, façon Facebook ----------------
   Une rangée de photos (comme les stories), puis toutes les annonces
   mélangées, de la plus récente à la plus ancienne, en grandes cartes. */
function storyCard(photo, label, sub) {
  const u = validPhoto(photo);
  const img = u ? '<img src="' + esc(u) + '" alt="" loading="lazy">' : '<div class="story-ph">🖼️</div>';
  return '<div class="story-card">' + img + '<span class="story-label">' + esc(label) +
    (sub ? "<small>" + esc(sub) + "</small>" : "") + "</span></div>";
}
function renderHomeLatest() {
  const box = $("#home-latest-content");
  if (!box) return;
  const stories = DATA.pros.slice(0, 6).map((p) => storyCard(p.photo_url, p.name, p.trade)).join("") +
    DATA.posts.slice(0, 6).map((p) => storyCard(p.photo_url, p.title, p.city)).join("");
  const feed = [
    ...DATA.pros.map((x) => ({ t: x.created_at, html: proCard(x) })),
    ...DATA.jobs.map((x) => ({ t: x.created_at, html: jobCard(x) })),
    ...DATA.housing.map((x) => ({ t: x.created_at, html: housingCard(x) })),
    ...DATA.posts.map((x) => ({ t: x.created_at, html: postCard(x) })),
  ].sort((a, b) => String(b.t || "").localeCompare(String(a.t || "")));
  if (!feed.length) {
    box.innerHTML = '<p class="empty-note">WorldLink vient d\'ouvrir : les premières annonces arrivent. Publie la tienne et sois parmi les premiers de ta ville.</p>';
    return;
  }
  box.innerHTML = (stories ? '<div class="stories-row">' + stories + "</div>" : "") +
    feed.map((f) => f.html).join("");
}

/* ---------------- Pièce Actus : les statuts, façon WhatsApp ----------------
   Un statut = une photo et/ou un petit message, visible pendant 24 h. */
function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (isNaN(s) || s < 60) return "à l'instant";
  const m = Math.floor(s / 60);
  if (m < 60) return "il y a " + m + " min";
  const h = Math.floor(m / 60);
  if (h < 24) return "il y a " + h + " h";
  return "il y a " + Math.floor(h / 24) + " j";
}
function statusItem(st) {
  const mine = currentUser && st.user_id === currentUser.id;
  const u = validPhoto(st.photo_url);
  return '<article class="card status-card"><div class="status-head">' +
    '<span class="status-avatar">' + (u ? '<img src="' + esc(u) + '" alt="">' : "👤") + "</span>" +
    '<div class="status-who"><p class="status-name">' + esc(st.author_name) + "</p>" +
    '<p class="status-time">' + timeAgo(st.created_at) + "</p></div>" +
    (mine ? '<button type="button" class="btn-danger" data-delete="statuses|' + st.id + '">Supprimer</button>' : "") +
    "</div>" +
    (st.body ? '<p class="card-desc">' + esc(st.body) + "</p>" : "") +
    (u ? '<img class="status-photo" src="' + esc(u) + '" alt="" loading="lazy">' : "") +
    "</article>";
}
function renderActus() {
  const box = $("#status-list");
  if (!box) return;
  const fresh = DATA.statuses.filter((st) => (Date.now() - new Date(st.created_at).getTime()) < 24 * 3600 * 1000);
  box.innerHTML = fresh.length ? fresh.map(statusItem).join("") :
    '<p class="empty-note">Aucun statut pour le moment. Publie le premier : une photo, un mot — il restera visible 24 h, comme sur WhatsApp.</p>';
}
async function handleStatusPublish(e) {
  e.preventDefault();
  const msg = $("#status-msg");
  const body = $("#status-text").value.trim();
  const photo = chosenPhoto("status", "");
  if (!body && !photo) {
    msg.textContent = "Écris un mot ou ajoute une photo.";
    msg.className = "form-msg error";
    return;
  }
  const { error } = await sb.from("statuses").insert({
    user_id: currentUser.id, author_name: displayName(), body: body || null, photo_url: photo,
  });
  if (error) {
    msg.textContent = "Publication impossible : " + error.message;
    msg.className = "form-msg error";
    return;
  }
  e.target.reset();
  clearPicked("status", "status-photo-preview");
  clearDraft("form-status");
  msg.textContent = ""; msg.className = "form-msg";
  await loadData(); renderActus();
  toast("Statut publié 🎉 Visible pendant 24 h.");
}

/* ---------------- Page Contact ---------------- */
const WL_EMAIL = "bamenmelvinjunior@gmail.com";
const WL_WHATSAPP = "14382217846";
function contactLinks() {
  const name = (($("#contact-name") || {}).value || "").trim();
  const email = (($("#contact-email") || {}).value || "").trim();
  const message = (($("#contact-message") || {}).value || "").trim();
  const text = "Bonjour WorldLink, je suis " + name + ". " + message + (email ? " (Mon courriel : " + email + ")" : "");
  return {
    wa: "https://wa.me/" + WL_WHATSAPP + "?text=" + encodeURIComponent(text),
    mail: "mailto:" + WL_EMAIL + "?subject=" + encodeURIComponent("Message depuis WorldLink — " + name) +
      "&body=" + encodeURIComponent(text),
  };
}
function handleContactWhats(e) { e.preventDefault(); window.open(contactLinks().wa, "_blank"); }
function handleContactMail() { window.location.href = contactLinks().mail; }

/* ---------------- Pièce Travail ---------------- */
let jobFilter = { trade: "", place: "" };
function renderTravail() {
  const t = norm(jobFilter.trade), pl = norm(jobFilter.place);
  let pros = DATA.pros.filter((p) =>
    (!t || norm(p.trade + " " + p.name).includes(t)) &&
    (!pl || norm(p.city + " " + p.country).includes(pl)));
  let jobs = DATA.jobs.filter((j) =>
    (!t || norm(j.title + " " + j.company).includes(t)) &&
    (!pl || norm(j.city + " " + j.country).includes(pl)));

  let prosHtml = "", jobsHtml = "";
  if ((jobFilter.trade || jobFilter.place) && !pros.length && !jobs.length) {
    prosHtml = arrivePanel(jobFilter.place || jobFilter.trade, "Travail", "travail");
    prosHtml += DATA.pros.map(proCard).join("");
    jobsHtml = DATA.jobs.map(jobCard).join("");
    if (!DATA.pros.length && !DATA.jobs.length) {
      jobsHtml = '<p class="empty-note">Aucune publication pour le moment — sois le premier à t\'inscrire ou à publier une offre ci-dessous.</p>';
    }
  } else {
    prosHtml = pros.length ? pros.map(proCard).join("")
      : '<p class="empty-note">Pas encore de professionnel ici — le premier peut s\'inscrire ci-dessous.</p>';
    jobsHtml = jobs.length ? jobs.map(jobCard).join("")
      : '<p class="empty-note">Pas encore d\'offre ici — les employeurs peuvent publier ci-dessous.</p>';
  }
  $("#pros-list").innerHTML = prosHtml;
  $("#jobs-list").innerHTML = jobsHtml;
  /* Carte de la ville cherchée en haut des résultats, comme Google Maps. */
  let mapPlace = "", mapLabel = "";
  if (jobFilter.place) { mapPlace = jobFilter.place; mapLabel = jobFilter.place; }
  else if (pros[0]) { mapPlace = pros[0].city; mapLabel = pros[0].city; }
  else if (jobs[0]) { mapPlace = jobs[0].city; mapLabel = jobs[0].city; }
  const mapBox = $("#travail-map");
  if (mapBox) mapBox.innerHTML = mapHtml(mapPlace, mapLabel);
}

function handleJobSearch(e) {
  e.preventDefault();
  jobFilter.trade = $("#search-trade").value.trim();
  jobFilter.place = $("#search-jobplace").value.trim();
  renderTravail();
}

/* ---------------- Pièce Logement ---------------- */
let housingFilter = { city: "", budget: "" };
function inBand(list, budget) {
  /* La règle du budget de départ : à partir de la somme tapée,
     en montant (ordre croissant), bande plafonnée à 1,5× la somme. */
  return list
    .filter((h) => Number(h.price) >= budget && Number(h.price) <= budget * 1.5)
    .sort((a, b) => Number(a.price) - Number(b.price));
}
function renderLogement() {
  const cityQ = norm(housingFilter.city);
  const budget = housingFilter.budget === "" ? null : Number(housingFilter.budget);
  let base = DATA.housing;
  if (cityQ) base = base.filter((h) => norm(h.city + " " + h.country).includes(cityQ));

  let html = "";
  if (budget !== null && !Number.isNaN(budget)) {
    const found = inBand(base, budget);
    if (found.length) {
      html = found.map(housingCard).join("");
    } else {
      html = arrivePanel(housingFilter.city, "Logement", "logement");
      const elsewhere = inBand(DATA.housing, budget);
      if (elsewhere.length) {
        html += "<h3 class='section-title'>Dans ta bande de prix, ailleurs</h3>" + elsewhere.map(housingCard).join("");
      } else if (DATA.housing.length) {
        html += "<h3 class='section-title'>Les logements déjà publiés</h3>" + DATA.housing.map(housingCard).join("");
      }
    }
  } else if (cityQ) {
    if (base.length) {
      html = base.map(housingCard).join("");
    } else {
      html = arrivePanel(housingFilter.city, "Logement", "logement") +
        (DATA.housing.length
          ? "<h3 class='section-title'>Les logements déjà publiés ailleurs</h3>" + DATA.housing.map(housingCard).join("")
          : '<p class="empty-note">Aucun logement publié pour le moment — sois le premier ci-dessous.</p>');
    }
  } else {
    html = DATA.housing.length ? DATA.housing.map(housingCard).join("")
      : arrivePanel("", "Logement", "logement");
  }
  $("#housing-list").innerHTML = html;
}
function handleHousingSearch(e) {
  e.preventDefault();
  housingFilter.city = $("#search-housecity").value.trim();
  housingFilter.budget = $("#search-budget").value;
  renderLogement();
}

/* ---------------- Pièce Marché ---------------- */
function renderMarche() {
  $("#market-list").innerHTML = DATA.posts.length
    ? DATA.posts.map(postCard).join("")
    : arrivePanel("", "Marché & Livraison", "marche") +
      '<p class="empty-note">Aucune annonce pour le moment — sois le premier vendeur ci-dessous.</p>';
}

async function toggleLike(postId) {
  if (userLiked(postId)) {
    await sb.from("market_likes").delete().eq("post_id", postId).eq("user_id", currentUser.id);
    DATA.likes = DATA.likes.filter((l) => !(l.post_id === postId && l.user_id === currentUser.id));
  } else {
    const { data, error } = await sb.from("market_likes")
      .insert({ post_id: postId, user_id: currentUser.id }).select().single();
    if (!error && data) DATA.likes.push(data);
  }
  refreshPostLists();
}

async function addComment(postId, body) {
  const { data, error } = await sb.from("market_comments")
    .insert({ post_id: postId, user_id: currentUser.id, author_name: displayName(), body })
    .select().single();
  if (!error && data) {
    DATA.comments.push(data);
    refreshPostLists();
    const box = document.getElementById("comments-" + postId);
    if (box) box.classList.remove("hidden");
  }
}

function refreshPostLists() {
  /* Réaffiche les listes qui contiennent des annonces du marché,
     en gardant la page et les filtres courants. */
  if (!$("#page-marche").classList.contains("hidden")) renderMarche();
  if (!$("#page-mes-publications").classList.contains("hidden")) renderMine();
}

/* ---------------- Publications (formulaires) ---------------- */
function formMsg(id, text, ok) {
  const el = document.getElementById(id);
  el.textContent = text;
  el.className = "form-msg " + (ok ? "ok" : "error");
}

async function publishPro(e) {
  e.preventDefault();
  const row = {
    user_id: currentUser.id,
    name: $("#pro-name").value.trim(),
    trade: $("#pro-trade").value.trim(),
    age: $("#pro-age").value ? Number($("#pro-age").value) : null,
    city: $("#pro-city").value.trim(),
    country: $("#pro-country").value.trim(),
    phone: $("#pro-phone").value.trim(),
    photo_url: chosenPhoto("pro", $("#pro-photo").value)
  };
  const { error } = await sb.from("professionals").insert(row);
  if (error) { formMsg("pro-msg", "Oups : " + error.message, false); return; }
  e.target.reset();
  clearPicked("pro", "pro-photo-preview");
  clearDraft("form-pro");
  formMsg("pro-msg", "Profil publié ! Les clients peuvent maintenant te trouver.", true);
  await loadData(); renderTravail(); toast("Profil professionnel publié 🎉");
}

async function publishJob(e) {
  e.preventDefault();
  const row = {
    user_id: currentUser.id,
    author_name: displayName(),
    title: $("#job-title").value.trim(),
    company: $("#job-company").value.trim(),
    city: $("#job-city").value.trim(),
    country: $("#job-country").value.trim(),
    job_type: $("#job-type").value,
    description: $("#job-desc").value.trim() || null,
    contact: $("#job-contact").value.trim()
  };
  const { error } = await sb.from("job_offers").insert(row);
  if (error) { formMsg("job-msg", "Oups : " + error.message, false); return; }
  e.target.reset();
  clearDraft("form-job");
  formMsg("job-msg", "Offre publiée ! Les chercheurs d'emploi peuvent postuler.", true);
  await loadData(); renderTravail(); toast("Offre d'emploi publiée 🎉");
}

async function publishHousing(e) {
  e.preventDefault();
  const row = {
    user_id: currentUser.id,
    author_name: displayName(),
    title: $("#house-title").value.trim(),
    city: $("#house-city").value.trim(),
    country: $("#house-country").value.trim(),
    price: Number($("#house-price").value),
    description: $("#house-desc").value.trim() || null,
    photo_url: chosenPhoto("house", $("#house-photo").value),
    contact: $("#house-contact").value.trim() || null
  };
  const { error } = await sb.from("housing").insert(row);
  if (error) { formMsg("house-msg", "Oups : " + error.message, false); return; }
  e.target.reset();
  clearPicked("house", "house-photo-preview");
  clearDraft("form-housing");
  formMsg("house-msg", "Logement publié ! Les gens qui cherchent dans ta ville le verront.", true);
  await loadData(); renderLogement(); toast("Logement publié 🎉");
}

async function publishPost(e) {
  e.preventDefault();
  const row = {
    user_id: currentUser.id,
    seller_name: displayName(),
    title: $("#post-title").value.trim(),
    price: $("#post-price").value === "" ? null : Number($("#post-price").value),
    city: $("#post-city").value.trim(),
    country: $("#post-country").value.trim() || null,
    description: $("#post-desc").value.trim() || null,
    photo_url: chosenPhoto("post", $("#post-photo").value),
    contact: $("#post-contact").value.trim()
  };
  const { error } = await sb.from("market_posts").insert(row);
  if (error) { formMsg("post-msg", "Oups : " + error.message, false); return; }
  e.target.reset();
  clearPicked("post", "post-photo-preview");
  clearDraft("form-post");
  formMsg("post-msg", "Annonce publiée ! Partage-la à tes contacts avec le bouton Partager.", true);
  await loadData(); renderMarche(); toast("Annonce publiée 🎉");
}

/* ---------------- Mes publications ---------------- */
const TABLE_LABELS = {
  professionals: ["Travail — mon profil professionnel", (r) => r.trade + " — " + r.city + ", " + r.country],
  job_offers: ["Travail — mes offres d'emploi", (r) => r.title + " chez " + r.company + " — " + r.city],
  housing: ["Mes logements", (r) => r.title + " — " + r.city + " · " + fmtNum(r.price)],
  market_posts: ["Mes annonces du marché", (r) => r.title + " — " + r.city],
  statuses: ["Mes statuts", (r) => (r.body || "Statut photo") + " — " + timeAgo(r.created_at)]
};
async function deleteMine(table, id) {
  if (!window.confirm("Supprimer cette publication ?")) return;
  const { error } = await sb.from(table).delete().eq("id", id).eq("user_id", currentUser.id);
  if (error) { toast("Suppression impossible : " + error.message); return; }
  await loadData(); renderMine(); refreshPostLists(); renderActus(); toast("Publication supprimée.");
}
function renderMine() {
  const box = $("#my-content");
  const mine = {
    professionals: DATA.pros.filter((r) => r.user_id === currentUser.id),
    job_offers: DATA.jobs.filter((r) => r.user_id === currentUser.id),
    housing: DATA.housing.filter((r) => r.user_id === currentUser.id),
    market_posts: DATA.posts.filter((r) => r.user_id === currentUser.id),
    statuses: DATA.statuses.filter((r) => r.user_id === currentUser.id)
  };
  const total = Object.values(mine).reduce((n, arr) => n + arr.length, 0);
  if (!total) {
    box.innerHTML = arrivePanel("", "les pièces", "home") +
      '<p class="empty-note">Tu n\'as encore rien publié. Choisis une pièce et publie ta première annonce !</p>';
    return;
  }
  let html = "";
  for (const [table, rows] of Object.entries(mine)) {
    if (!rows.length) continue;
    html += "<h3 class='section-title'>" + TABLE_LABELS[table][0] + "</h3>";
    html += rows.map((r) =>
      '<div class="card my-item"><div class="card-main"><p class="card-title">' +
      esc(TABLE_LABELS[table][1](r)) + "</p></div>" +
      '<button type="button" class="btn-danger" data-delete="' + table + "|" + r.id + '">Supprimer</button></div>'
    ).join("");
  }
  box.innerHTML = html;
}

/* ---------------- Pièce Transferts ---------------- */
function computeTransfers(amount, fromCurrency, destination) {
  const dest = destCurrency(destination);
  const eurAmount = amount * (EUR_VALUE[fromCurrency] || 1);
  const results = TRANSFER_SERVICES.map((s) => {
    const feeFrom = s.fixed / (EUR_VALUE[fromCurrency] || 1) + amount * (s.pct / 100);
    const received = dest
      ? Math.max(0, eurAmount - s.fixed) * (1 - s.pct / 100) * dest.rate * (1 - s.margin / 100)
      : null;
    const rate = dest ? (EUR_VALUE[fromCurrency] || 1) * dest.rate * (1 - s.margin / 100) : null;
    return { ...s, received, feeFrom, rate, destCode: dest ? dest.code : null };
  });
  if (dest) results.sort((a, b) => b.received - a.received);
  return results;
}

function renderTransfers() {
  const amount = Number($("#transfer-amount").value) || 100;
  const from = $("#transfer-currency").value;
  const destination = $("#transfer-destination").value.trim();
  const symbols = { CAD: "$ CAD", EUR: "€", USD: "$ USD", GBP: "£" };
  if (!destination) {
    /* Aucun pays imposé : c'est l'utilisateur qui dit le pays, pas l'application. */
    $("#transfer-results").innerHTML =
      '<p class="muted">Tape le montant et le pays de destination — <strong>n\'importe quel pays du monde</strong> — puis touche « Comparer ». La comparaison se fera pour <strong>ton</strong> pays, celui que tu as tapé.</p>';
    return;
  }
  const results = computeTransfers(amount, from, destination);
  const known = results.length > 0 && results[0].destCode !== null;
  $("#transfer-results").innerHTML =
    '<p class="muted">Pour <strong>' + fmtNum(amount) + " " + esc(symbols[from] || from) +
    "</strong> envoyés vers <strong>" + esc(destination) + "</strong>, " +
    (known
      ? "voici ce que ta famille reçoit selon le service (du meilleur au moins bon) :</p>"
      : "voici les services qui envoient vers ce pays. Je n'ai pas encore le taux indicatif pour <strong>" + esc(destination) + "</strong> : chaque service te donnera le montant exact sur son site officiel.</p>") +
    results.map((r, i) =>
      '<article class="card transfer-card' + (known && i === 0 ? " best" : "") + '">' +
      (known && i === 0 ? '<span class="best-badge">⭐ Meilleur reçu</span>' : "") +
      '<p class="card-title">' + esc(r.name) + "</p>" +
      (known ? '<p class="transfer-received">La famille reçoit ≈ ' + fmtNum(Math.round(r.received)) + " " + esc(r.destCode) + "</p>" : "") +
      '<div class="transfer-rows">' +
      '<div class="trow"><span>Tu envoies</span><strong>' + fmtNum(amount) + " " + esc(from) + "</strong></div>" +
      (known ? '<div class="trow"><span>Taux de change</span><strong>1 ' + esc(from) + " = " + fmtNum(Math.round(r.rate * 100) / 100) + " " + esc(r.destCode) + "</strong></div>" : "") +
      '<div class="trow"><span>Frais estimés</span><strong>≈ ' + fmtNum(Math.round(r.feeFrom * 10) / 10) + " " + esc(from) + "</strong></div>" +
      '<div class="trow"><span>Délai estimé</span><strong>' + esc(r.delay) + "</strong></div>" +
      '<div class="trow"><span>Réception</span><strong>Mobile Money, banque ou espèces</strong></div>' +
      "</div>" +
      '<div class="card-actions"><a class="btn-gold" style="text-decoration:none" target="_blank" rel="noopener" href="' + r.url + '">Envoyer avec ' + esc(r.name) + "</a></div>" +
      "</article>").join("");
}

function handleTransfer(e) { e.preventDefault(); renderTransfers(); }

/* ---------------- Pièce Découverte ---------------- */
function discoImageCard([file, caption]) {
  return '<div class="media-card"><img src="' + COMMONS + file + "?width=700\" alt=\"" + esc(caption) +
    '" loading="lazy" onerror="this.style.display=\'none\'">' +
    '<div class="media-caption">' + esc(caption) + "</div>" +
    '<div class="media-sub">Wikimedia Commons</div></div>';
}
function discoVideoCard([cat, title, sub, thumb]) {
  return '<a class="video-card" target="_blank" rel="noopener" href="https://commons.wikimedia.org/wiki/Category:' + cat + '">' +
    '<span class="video-thumb"><img src="' + COMMONS + thumb + "?width=600\" alt=\"" + esc(title) +
    '" loading="lazy" onerror="this.style.display=\'none\'"><span class="play-badge">▶</span></span>' +
    '<span class="video-meta"><span class="media-caption">' + esc(title) + "</span>" +
    '<span class="media-sub">' + esc(sub) + " · Wikimedia Commons</span></span></a>";
}
function discoNewsCard([title, source, url, thumb]) {
  return '<a class="news-card" target="_blank" rel="noopener" href="' + url + '">' +
    '<span class="news-meta"><span class="news-source"><span class="source-badge">' + esc(source.charAt(0)) + "</span>" + esc(source) + "</span>" +
    '<span class="news-title">' + esc(title) + "</span>" +
    '<span class="media-sub">Ouvrir le site de la source</span></span>' +
    '<img class="news-img" src="' + COMMONS + thumb + "?width=400\" alt=\"" + esc(source) +
    '" loading="lazy" onerror="this.style.display=\'none\'"></a>';
}

function discoExploreTile([file, caption]) {
  /* Tuile carrée de la grille Explorer façon Instagram ; le toucher ouvre la page du fichier. */
  return '<a class="explore-tile" target="_blank" rel="noopener" href="https://commons.wikimedia.org/wiki/File:' + file + '">' +
    '<img src="' + COMMONS + file + "?width=400\" alt=\"" + esc(caption) +
    '" loading="lazy" onerror="this.style.display=\'none\'"></a>';
}

function renderDiscovery() {
  /* Images : grille Explorer façon Instagram (tuiles carrées, bord à bord) */
  $("#discovery-images").innerHTML = DISCO_IMAGES.map(discoExploreTile).join("");

  /* Vidéos : cartes avec vraie vignette et bouton lecture, comme Google Vidéos */
  $("#discovery-videos").innerHTML = DISCO_VIDEOS.map(discoVideoCard).join("");

  /* Actualités : cartes avec source, titre et photo, comme Google Actualités */
  $("#discovery-news").innerHTML = DISCO_NEWS.map(discoNewsCard).join("");

  /* Pour vous : le fleuve mélangé façon Phoenix — images, actualités et vidéos
     défilent ensemble, en grandes cartes, sans fin. */
  const feed = [];
  const rounds = Math.max(DISCO_IMAGES.length / 2, DISCO_NEWS.length, DISCO_VIDEOS.length);
  for (let i = 0; i < rounds; i++) {
    if (DISCO_IMAGES[2 * i]) feed.push(discoImageCard(DISCO_IMAGES[2 * i]));
    if (DISCO_NEWS[i]) feed.push(discoNewsCard(DISCO_NEWS[i]));
    if (DISCO_IMAGES[2 * i + 1]) feed.push(discoImageCard(DISCO_IMAGES[2 * i + 1]));
    if (DISCO_VIDEOS[i]) feed.push(discoVideoCard(DISCO_VIDEOS[i]));
  }
  const feedBox = $("#discovery-feed");
  if (feedBox) feedBox.innerHTML = feed.join("");
}

function switchDtab(name) {
  document.querySelectorAll(".tab-btn").forEach((b) =>
    b.classList.toggle("active", b.dataset.dtab === name));
  for (const t of ["pourvous", "images", "videos", "actus"]) {
    $("#dtab-" + t).classList.toggle("hidden", t !== name);
  }
}

/* ---------------- Assistant ---------------- */
let assistantSeeded = false;
function addBubble(text, who, html) {
  const log = $("#chat-log");
  const div = document.createElement("div");
  div.className = "bubble " + who;
  div.innerHTML = text ? esc(text) : "";
  if (html) div.innerHTML += html;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
  return div;
}
function seedAssistant() {
  if (assistantSeeded) return;
  assistantSeeded = true;
  addBubble("Bonjour " + firstName() + " 👋 Je suis l'Assistant WorldLink. " +
    "Dis-moi ce que tu cherches avec tes mots — un métier, un logement avec ton budget, un emploi, quelque chose à acheter — et je cherche pour toi dans toute l'application.", "bot");
}

function detectPlace(q) {
  const places = new Set(WORLD_PLACES);
  for (const item of [...DATA.pros, ...DATA.jobs, ...DATA.housing, ...DATA.posts]) {
    if (item.city) places.add(norm(item.city));
    if (item.country) places.add(norm(item.country));
  }
  /* Du plus long au plus court pour préférer « new york » à « york » */
  const sorted = [...places].sort((a, b) => b.length - a.length);
  return sorted.find((p) => q.includes(p)) || "";
}
function detectAmount(q) {
  const compact = q.replace(/(\d)[\s.](?=\d)/g, "$1");
  const m = compact.match(/\d+/);
  return m ? Number(m[0]) : null;
}
const TRADE_WORDS = ["plombier", "mecanicien", "electricien", "infirmier", "infirmiere", "avocat",
  "soudeur", "coiffeur", "coiffeuse", "menuisier", "macon", "chauffeur", "peintre", "boulanger",
  "couturier", "couturiere", "informaticien", "developpeur", "enseignant", "agriculteur",
  "commercant", "vendeur", "vendeuse", "cuisinier", "cuisiniere", "photographe", "musicien"];

function assistantAnswer(raw) {
  const q = norm(raw);
  const place = detectPlace(q);
  const amount = detectAmount(q);
  const inPlace = (item) => !place || norm((item.city || "") + " " + (item.country || "")).includes(place);
  const placeLabel = place ? " (" + place + ")" : "";

  /* Transferts */
  if (/(transfert|envoyer|envoi)/.test(q) && /(argent|franc|euro|dollar|fcfa|\$|€)/.test(q) || /envoyer de l'argent/.test(q)) {
    const amt = amount || 100;
    if (!place) {
      addBubble("Vers quel pays veux-tu envoyer l'argent ? Dis-moi le pays et le montant, par exemple : « envoyer 200 dollars au Congo ». Ou ouvre la pièce Transferts et tape n'importe quel pays du monde — c'est toi qui dis le pays.",
        "bot", '<div class="card-actions"><button type="button" class="btn-gold" data-go="transferts">Ouvrir les Transferts</button></div>');
      return;
    }
    const best = computeTransfers(amt, "EUR", place)[0];
    if (best.received === null) {
      addBubble("Pour envoyer de l'argent vers " + place + ", ouvre la pièce Transferts : tu y compares les 6 services qui envoient vers ce pays. Je n'ai pas encore le taux indicatif pour ce pays — chaque service te donnera le montant exact sur son site officiel. WorldLink ne touche jamais à l'argent.",
        "bot", '<div class="card-actions"><button type="button" class="btn-gold" data-go="transferts">Ouvrir les Transferts</button></div>');
      return;
    }
    addBubble("Pour envoyer de l'argent vers " + place + ", le meilleur service en ce moment (taux indicatifs) est " +
      best.name + " : ta famille recevrait environ " + fmtNum(Math.round(best.received)) + " " + best.destCode +
      " pour " + fmtNum(amt) + " € envoyés. Ouvre la pièce Transferts pour comparer les 6 services et partir chez le service officiel — WorldLink ne touche jamais à l'argent.",
      "bot", '<div class="card-actions"><button type="button" class="btn-gold" data-go="transferts">Ouvrir les Transferts</button></div>');
    return;
  }

  /* Logement */
  if (/(appartement|logement|maison|studio|chambre|louer|location)/.test(q)) {
    let pool = DATA.housing.filter(inPlace);
    let html = "";
    if (amount) {
      let found = inBand(pool, amount);
      if (!found.length && place) {
        found = inBand(DATA.housing, amount);
        if (found.length) html = "<p>Pas encore dans ta bande de prix" + placeLabel + ", mais voici ce qui correspond à ta somme ailleurs :</p>";
      }
      if (found.length) {
        addBubble("Voici les logements à partir de " + fmtNum(amount) + ", en montant — comme tu l'as demandé" + placeLabel + " :", "bot",
          html + found.slice(0, 3).map(housingCard).join(""));
        return;
      }
      addBubble("Je n'ai pas encore de logement dans cette bande de prix" + placeLabel +
        ". Les propriétaires commencent à publier — sois le premier, ou regarde tous les logements dans la pièce Logement.", "bot",
        '<div class="card-actions"><button type="button" class="btn-gold" data-go="logement">Ouvrir la pièce Logement</button></div>');
      return;
    }
    if (pool.length) {
      addBubble("Voici les logements publiés" + placeLabel + " :", "bot", pool.slice(0, 3).map(housingCard).join(""));
    } else {
      addBubble("Pas encore de logement publié" + placeLabel + " — WorldLink arrive ici : les propriétaires commencent à publier. Regarde la pièce Logement pour voir ce qui existe ailleurs.", "bot",
        '<div class="card-actions"><button type="button" class="btn-gold" data-go="logement">Ouvrir la pièce Logement</button></div>');
    }
    return;
  }

  /* Emplois */
  if (/(emploi|travail|poste|boulot|job|embauche|recrute)/.test(q)) {
    const found = DATA.jobs.filter((j) => inPlace(j) &&
      (!place || true) && (place || q.split(/\s+/).some((w) => w.length > 3 && norm(j.title + " " + j.company).includes(w)) || !place));
    const list = (place ? DATA.jobs.filter(inPlace) : found);
    if (list.length) {
      addBubble("Voici les offres d'emploi" + placeLabel + " :", "bot", list.slice(0, 3).map(jobCard).join(""));
    } else {
      addBubble("Pas encore d'offre d'emploi publiée" + placeLabel + " — les employeurs commencent à publier. Ouvre la pièce Travail pour tout voir, ou pour publier une offre.", "bot",
        '<div class="card-actions"><button type="button" class="btn-gold" data-go="travail">Ouvrir la pièce Travail</button></div>');
    }
    return;
  }

  /* Professionnels */
  const trade = TRADE_WORDS.find((t) => q.includes(t));
  if (trade || /(professionnel|artisan|quelqu'un pour|cherche un|cherche une)/.test(q)) {
    const found = DATA.pros.filter((p) => inPlace(p) && (!trade || norm(p.trade).includes(trade)));
    if (found.length) {
      addBubble("Voici les professionnels trouvés" + placeLabel + " :", "bot", found.slice(0, 3).map(proCard).join(""));
    } else {
      addBubble("Pas encore de professionnel" + (trade ? " (" + trade + ")" : "") + " inscrit" + placeLabel +
        " — WorldLink arrive ici : les professionnels commencent à s'inscrire. Tu peux voir tous les inscrits dans la pièce Travail.", "bot",
        '<div class="card-actions"><button type="button" class="btn-gold" data-go="travail">Ouvrir la pièce Travail</button></div>');
    }
    return;
  }

  /* Marché */
  if (/(acheter|commander|vendre|prix de|babouche|ndole|pagne|marché|marche)/.test(q)) {
    const words = q.split(/\s+/).filter((w) => w.length > 3);
    const found = DATA.posts.filter((p) => inPlace(p) &&
      words.some((w) => norm(p.title + " " + (p.description || "")).includes(w)));
    const list = found.length ? found : DATA.posts.filter(inPlace);
    if (list.length) {
      addBubble("Voici ce qui se vend" + placeLabel + " :", "bot", list.slice(0, 3).map(postCard).join(""));
    } else {
      addBubble("Pas encore d'annonce" + placeLabel + " — les vendeurs commencent à publier dans la pièce Marché & Livraison.", "bot",
        '<div class="card-actions"><button type="button" class="btn-gold" data-go="marche">Ouvrir le Marché</button></div>');
    }
    return;
  }

  /* Salutation */
  if (/(bonjour|salut|bonsoir|hello)/.test(q)) {
    addBubble("Bonjour " + firstName() + " 👋 Dis-moi ce que tu cherches : un métier (ex. « plombier à Douala »), un logement avec ton budget, un emploi, ou de l'aide pour envoyer de l'argent.", "bot");
    return;
  }

  /* Réponse générale : recherche dans tout */
  const pros = DATA.pros.filter((p) => matchesQuery(p, ["name", "trade", "city", "country"], q));
  const jobs = DATA.jobs.filter((j) => matchesQuery(j, ["title", "company", "city", "country"], q));
  const housing = DATA.housing.filter((h) => matchesQuery(h, ["title", "city", "country"], q));
  const posts = DATA.posts.filter((p) => matchesQuery(p, ["title", "city", "country", "description"], q));
  const html = pros.slice(0, 2).map(proCard).join("") + jobs.slice(0, 2).map(jobCard).join("") +
    housing.slice(0, 2).map(housingCard).join("") + posts.slice(0, 2).map(postCard).join("");
  if (html) {
    addBubble("Voici ce que j'ai trouvé pour toi :", "bot", html);
  } else {
    addBubble("Je n'ai rien trouvé pour « " + raw + " » pour le moment — WorldLink grandit chaque jour. " +
      "Essaie par exemple : « plombier à Douala », « appartement à 50 000 », « emplois à Toronto » ou « envoyer de l'argent au Cameroun ».", "bot");
  }
}

function handleChat(e) {
  e.preventDefault();
  const input = $("#chat-input");
  const text = input.value.trim();
  if (!text) return;
  addBubble(text, "me");
  input.value = "";
  setTimeout(() => assistantAnswer(text), 250);
}

/* ---------------- Événements ---------------- */
function wireEvents() {
  /* Porte d'entrée */
  $("#tab-login").addEventListener("click", () => {
    $("#tab-login").classList.add("active"); $("#tab-signup").classList.remove("active");
    $("#form-login").classList.remove("hidden"); $("#form-signup").classList.add("hidden");
  });
  $("#tab-signup").addEventListener("click", () => {
    $("#tab-signup").classList.add("active"); $("#tab-login").classList.remove("active");
    $("#form-signup").classList.remove("hidden"); $("#form-login").classList.add("hidden");
  });
  $("#form-login").addEventListener("submit", handleLogin);
  $("#form-signup").addEventListener("submit", handleSignup);
  $("#btn-logout").addEventListener("click", handleLogout);

  /* Formulaires des pièces */
  $("#form-home-search").addEventListener("submit", doHomeSearch);
  const fc = $("#form-contact");
  if (fc) fc.addEventListener("submit", handleContactWhats);
  const fs2 = $("#form-status");
  if (fs2) fs2.addEventListener("submit", handleStatusPublish);
  const bcm = $("#btn-contact-mail");
  if (bcm) bcm.addEventListener("click", handleContactMail);
  $("#form-job-search").addEventListener("submit", handleJobSearch);
  $("#form-housing-search").addEventListener("submit", handleHousingSearch);
  $("#form-transfer").addEventListener("submit", handleTransfer);
  $("#form-pro").addEventListener("submit", publishPro);
  $("#form-job").addEventListener("submit", publishJob);
  $("#form-housing").addEventListener("submit", publishHousing);
  $("#form-post").addEventListener("submit", publishPost);
  wirePhotoPickers();
  wireDrafts();
  $("#form-chat").addEventListener("submit", handleChat);

  /* Onglets Découverte */
  document.querySelectorAll(".tab-btn").forEach((b) =>
    b.addEventListener("click", () => switchDtab(b.dataset.dtab)));

  /* Questions d'exemple de l'assistant */
  document.querySelectorAll(".chip").forEach((c) =>
    c.addEventListener("click", () => {
      addBubble(c.dataset.q, "me");
      setTimeout(() => assistantAnswer(c.dataset.q), 250);
    }));

  /* Délégation : navigation, partage, contact, j'aime, commentaires, suppression */
  document.addEventListener("click", (e) => {
    const goBtn = e.target.closest("[data-go]");
    if (goBtn) { go(goBtn.dataset.go); return; }

    const shareBtn = e.target.closest("[data-share]");
    if (shareBtn) {
      const [title, city] = shareBtn.dataset.share.split("|");
      shareItem(title, city); return;
    }

    const contactBtn = e.target.closest("[data-contact]");
    if (contactBtn) {
      const card = contactBtn.closest(".card");
      const box = card && card.querySelector(".card-contact");
      if (box) box.classList.toggle("hidden");
      return;
    }

    const likeBtn = e.target.closest("[data-like]");
    if (likeBtn) { toggleLike(likeBtn.dataset.like); return; }

    const comBtn = e.target.closest("[data-comments]");
    if (comBtn) {
      const box = document.getElementById("comments-" + comBtn.dataset.comments);
      if (box) box.classList.toggle("hidden");
      return;
    }

    const delBtn = e.target.closest("[data-delete]");
    if (delBtn) {
      const [table, id] = delBtn.dataset.delete.split("|");
      deleteMine(table, id); return;
    }
  });

  /* Envoi d'un commentaire (délégation sur les formulaires) */
  document.addEventListener("submit", (e) => {
    const form = e.target.closest("[data-comment-form]");
    if (!form) return;
    e.preventDefault();
    const input = form.querySelector("input");
    const body = input.value.trim();
    if (body) addComment(form.dataset.commentForm, body);
  });
}

/* ---------------- Démarrage ---------------- */
function init() {
  wireEvents();
  const cfg = window.WORLDLINK_CONFIG || {};
  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
    showOnly("view-config");
    return;
  }
  if (!window.supabase || !window.supabase.createClient) {
    showOnly("view-config");
    return;
  }
  sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

  sb.auth.getSession().then(({ data }) => {
    if (data && data.session) {
      currentUser = data.session.user;
      enterApp();
    } else {
      showOnly("view-auth");
    }
  });

  sb.auth.onAuthStateChange((_event, session) => {
    if (session) {
      currentUser = session.user;
      enterApp();
    } else if (currentUser) {
      currentUser = null;
      showOnly("view-auth");
    }
  });
}

document.addEventListener("DOMContentLoaded", init);
