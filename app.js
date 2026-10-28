// ===== الحالة والتخزين =====
const KEY = "nutri.v1";
const MEALS = { breakfast: "🌅 فطار", lunch: "🍛 غدا", dinner: "🌙 عشا", snacks: "🍎 سناكس" };
let S = load();
let day = today();
let picked = null;
let cat = "الكل";

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s) return { profile: null, days: {}, weights: [], custom: [], ...s };
  } catch (e) {}
  return { profile: null, days: {}, weights: [], custom: [] };
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast("تعذّر الحفظ"); } }
function today(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function getDay(d = day) {
  if (!S.days[d]) S.days[d] = { meals: { breakfast: [], lunch: [], dinner: [], snacks: [] }, water: 0 };
  return S.days[d];
}
function allFoods() { return [...S.custom, ...FOODS]; }
const r = (n, d = 0) => Number(n.toFixed(d));
const $ = id => document.getElementById(id);
function toast(msg) { const t = $("toast"); t.textContent = msg; t.classList.add("show"); setTimeout(() => t.classList.remove("show"), 1800); }

// ===== الحسابات (معادلة Mifflin-St Jeor) =====
function calcTargets(p) {
  if (!p) return null;
  const hM = p.height / 100;
  const bmr = 10 * p.weight + 6.25 * p.height - 5 * p.age + (p.sex === "m" ? 5 : -161);
  const tdee = bmr * p.activity;
  const delta = (p.goal * 7700) / 7;               // 1 كجم دهون ≈ 7700 سعر
  const floor = p.sex === "m" ? 1500 : 1200;        // حد أدنى آمن
  const kcal = Math.round(Math.max(tdee + delta, floor) / 10) * 10;
  const bmi = p.weight / (hM * hM);
  const refW = bmi > 30 ? 25 * hM * hM : p.weight;  // وزن معدّل لحساب البروتين عند السمنة
  const ppk = p.goal < 0 ? 2.0 : p.goal > 0 ? 1.8 : 1.6;
  const protein = Math.round(refW * ppk);
  const fat = Math.round(Math.max((kcal * 0.27) / 9, 0.6 * p.weight));
  const carbs = Math.max(Math.round((kcal - protein * 4 - fat * 9) / 4), 50);
  return {
    bmr: Math.round(bmr), tdee: Math.round(tdee), kcal, protein, fat, carbs,
    fiber: Math.round((kcal / 1000) * 14), water: Math.round(p.weight * 35),
    sugar: Math.round((kcal * 0.1) / 4), bmi, floorHit: tdee + delta < floor,
    idealMin: r(18.5 * hM * hM, 1), idealMax: r(24.9 * hM * hM, 1)
  };
}
function bmiLabel(b) {
  if (b < 18.5) return ["نحافة", "warn"];
  if (b < 25) return ["وزن طبيعي", ""];
  if (b < 30) return ["زيادة وزن", "warn"];
  return ["سمنة", "bad"];
}
function totals(d = day) {
  const t = { kcal: 0, p: 0, c: 0, f: 0, fib: 0, sugarItems: [], fried: [] };
  const dd = getDay(d);
  for (const m in dd.meals) for (const e of dd.meals[m]) {
    t.kcal += e.kcal; t.p += e.p; t.c += e.c; t.f += e.f; t.fib += e.fib || 0;
    if (["حلويات", "مشروبات"].includes(e.cat) && e.c > 10) t.sugarItems.push(e.name);
    if (/مقلي|محمرة|بانيه|طعمية|شيبسي|فطير/.test(e.name)) t.fried.push(e.name);
  }
  return t;
}

// ===== التنقل =====
function go(v) {
  document.querySelectorAll(".view").forEach(x => x.classList.toggle("active", x.id === "v-" + v));
  document.querySelectorAll("nav button").forEach(b => b.classList.toggle("active", b.dataset.v === v));
  window.scrollTo(0, 0);
  if (v === "home") renderHome();
  if (v === "expert") renderExpert();
  if (v === "stats") renderStats();
  if (v === "add") { renderResults(); setTimeout(() => $("search").focus(), 50); }
}
document.querySelectorAll("nav button").forEach(b => b.onclick = () => go(b.dataset.v));
function shiftDay(n) {
  const d = new Date(day + "T12:00:00"); d.setDate(d.getDate() + n);
  if (today(d) > today()) return;
  day = today(d); renderHome();
}

// ===== الرئيسية =====
function renderHome() {
  const T = calcTargets(S.profile), t = totals();
  $("noProfile").style.display = S.profile ? "none" : "block";
  $("dayLabel").textContent = day === today() ? "النهارده" : new Date(day + "T12:00:00").toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long" });
  const goal = T ? T.kcal : 2000;
  const left = goal - t.kcal;
  $("kcalGoal").textContent = T ? goal + " سعر" : "—";
  $("kcalEaten").textContent = Math.round(t.kcal) + " سعر";
  $("kcalLeft").textContent = Math.abs(Math.round(left));
  $("kcalLeftLbl").textContent = left >= 0 ? "سعر متبقي" : "سعر زيادة";
  const pct = Math.min(t.kcal / goal, 1);
  const arc = $("ringArc");
  arc.style.strokeDashoffset = 351.86 * (1 - pct);
  arc.style.stroke = left < -goal * 0.1 ? "var(--bad)" : "var(--primary)";
  $("kcalNote").textContent = T ? `الحرق اليومي ≈ ${T.tdee} سعر` : "ادخل بياناتك لحساب هدفك";

  const macros = [
    ["بروتين", t.p, T?.protein, "var(--p)"], ["كارب", t.c, T?.carbs, "var(--c)"],
    ["دهون", t.f, T?.fat, "var(--f)"], ["ألياف", t.fib, T?.fiber, "var(--fib)"]
  ];
  $("macroBars").innerHTML = macros.map(([n, v, g, col]) => `
    <div class="macro-head"><span>${n}</span><span>${Math.round(v)}${g ? " / " + g : ""} جم</span></div>
    <div class="bar"><span style="width:${g ? Math.min(v / g * 100, 100) : 0}%;background:${col}"></span></div>`).join("");

  const dd = getDay();
  const cups = T ? Math.ceil(T.water / 250) : 8;
  $("water").innerHTML = Array.from({ length: Math.max(cups, dd.water) }, (_, i) =>
    `<button class="cup ${i < dd.water ? "full" : ""}" aria-label="كوب ${i + 1}" onclick="setWater(${i + 1})"></button>`).join("");
  $("waterTxt").textContent = `${dd.water} / ${cups} كوب (${(dd.water * 0.25).toFixed(2)} لتر)`;

  $("meals").innerHTML = Object.entries(MEALS).map(([k, label]) => {
    const items = dd.meals[k];
    const sum = items.reduce((a, e) => a + e.kcal, 0);
    return `<div class="card">
      <div class="meal-title"><h2>${label}</h2><span class="muted">${Math.round(sum)} سعر</span></div>
      ${items.map((e, i) => `<div class="meal-item">
        <div><b>${e.name}</b><div class="muted">${Math.round(e.grams)} جم • ب ${r(e.p)} • ك ${r(e.c)} • د ${r(e.f)}</div></div>
        <div class="row"><span>${Math.round(e.kcal)}</span><button class="danger" aria-label="حذف" onclick="removeEntry('${k}',${i})">✕</button></div>
      </div>`).join("") || '<p class="muted">لسه مفيش أكل</p>'}
      <button class="ghost small" style="margin-top:8px" onclick="$('mealSel').value='${k}';go('add')">➕ إضافة</button>
    </div>`;
  }).join("");
}
function setWater(n) { const dd = getDay(); dd.water = dd.water === n ? n - 1 : n; save(); renderHome(); }
function removeEntry(m, i) { getDay().meals[m].splice(i, 1); save(); renderHome(); }

// ===== إضافة أكل =====
function norm(s) {
  return s.replace(/[ً-ْ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").toLowerCase().trim();
}
function renderCats() {
  const cats = ["الكل", ...new Set(allFoods().map(f => f.cat))];
  $("cats").innerHTML = cats.map(c => `<button class="chip ${c === cat ? "on" : ""}" onclick="cat='${c}';renderCats();renderResults()">${c}</button>`).join("");
}
function renderResults() {
  const q = norm($("search").value);
  const list = allFoods().filter(f => (cat === "الكل" || f.cat === cat) && (!q || norm(f.name).includes(q))).slice(0, 60);
  $("results").innerHTML = list.map(f => `<div class="result" onclick="pick('${f.id}')">
      <div><b>${f.name}</b><div class="muted">${f.portionName} (${f.portion} جم)</div></div>
      <div style="text-align:left;white-space:nowrap"><b>${Math.round(f.kcal * f.portion / 100)}</b><div class="muted">سعر</div></div>
    </div>`).join("") || '<p class="muted" style="padding:10px">مش لاقيين الأكلة دي — ضيفها تحت 👇</p>';
}
function pick(id) {
  picked = allFoods().find(f => f.id === id);
  $("pickCard").style.display = "block";
  $("pickName").textContent = picked.name;
  $("pickPer100").textContent = `لكل 100 جم: ${picked.kcal} سعر • بروتين ${picked.p} • كارب ${picked.c} • دهون ${picked.f}`;
  $("pickQty").value = 1; $("pickGrams").value = picked.portion;
  updatePick();
  $("pickCard").scrollIntoView({ behavior: "smooth", block: "center" });
}
function pickGrams() { return parseFloat($("pickGrams").value) || 0; }
function updatePick() {
  if (!picked) return;
  const g = pickGrams(), k = g / 100;
  $("pickCalc").textContent = `${Math.round(picked.kcal * k)} سعر • بروتين ${r(picked.p * k, 1)} جم • كارب ${r(picked.c * k, 1)} جم • دهون ${r(picked.f * k, 1)} جم`;
}
$("pickQty").oninput = () => { $("pickGrams").value = r((parseFloat($("pickQty").value) || 0) * picked.portion, 1); updatePick(); };
$("pickGrams").oninput = () => { $("pickQty").value = r(pickGrams() / picked.portion, 2); updatePick(); };
$("search").oninput = renderResults;
function addPicked() {
  const g = pickGrams();
  if (!picked || g <= 0) return toast("ادخل الكمية");
  const k = g / 100, f = picked;
  getDay().meals[$("mealSel").value].push({
    name: f.name, cat: f.cat, grams: g, kcal: f.kcal * k, p: f.p * k, c: f.c * k, f: f.f * k, fib: (f.fib || 0) * k
  });
  save(); toast(`✅ اتضاف ${f.name}`);
  $("pickCard").style.display = "none"; $("search").value = ""; picked = null; renderResults();
}
function saveCustom() {
  const v = id => parseFloat($(id).value) || 0;
  const name = $("cName").value.trim();
  if (!name || !v("cKcal")) return toast("اكتب الاسم والسعرات");
  S.custom.unshift({ id: "c" + Date.now(), name, kcal: v("cKcal"), p: v("cP"), c: v("cC"), f: v("cF"), fib: v("cFib"), cat: "أكلاتي", portion: v("cPortion") || 100, portionName: "حصة" });
  save(); toast("✅ اتحفظت"); ["cName", "cKcal", "cP", "cC", "cF", "cFib"].forEach(i => $(i).value = "");
  renderCats(); renderResults();
}

// ===== الملف الشخصي =====
function fillProfile() {
  const p = S.profile; if (!p) return;
  for (const k of ["sex", "age", "height", "weight", "activity", "goal"]) $(k).value = p[k];
  $("targetW").value = p.targetW || "";
}
function saveProfile() {
  const p = {
    sex: $("sex").value, age: +$("age").value, height: +$("height").value, weight: +$("weight").value,
    activity: +$("activity").value, goal: +$("goal").value, targetW: +$("targetW").value || null
  };
  if (!(p.age >= 12 && p.age <= 100) || !(p.height >= 100 && p.height <= 230) || !(p.weight >= 30 && p.weight <= 300))
    return toast("راجع السن والطول والوزن");
  S.profile = p; save(); renderProfileResults(); toast("✅ اتحسب احتياجك");
}
function renderProfileResults() {
  const p = S.profile, T = calcTargets(p); if (!T) return;
  const [bl, bc] = bmiLabel(T.bmi);
  let eta = "";
  if (p.targetW && p.goal !== 0 && Math.sign(p.targetW - p.weight) === Math.sign(p.goal)) {
    const weeks = Math.ceil(Math.abs(p.targetW - p.weight) / Math.abs(p.goal));
    eta = `<div class="tip">📅 هتوصل لـ ${p.targetW} كجم في حوالي <b>${weeks} أسبوع</b> (≈ ${r(weeks / 4.3, 1)} شهر) لو التزمت.</div>`;
  }
  $("results2").style.display = "block";
  $("results2").innerHTML = `<h2>📋 نتيجتك</h2>
    <div class="kpis" style="margin-bottom:10px">
      <div class="kpi"><b>${T.kcal}</b><span class="muted">سعر/يوم</span></div>
      <div class="kpi"><b>${T.tdee}</b><span class="muted">الحرق اليومي</span></div>
      <div class="kpi"><b>${T.bmr}</b><span class="muted">الحرق وانت مرتاح</span></div>
    </div>
    <div class="kpis" style="margin-bottom:10px">
      <div class="kpi"><b style="color:var(--p)">${T.protein}</b><span class="muted">بروتين جم</span></div>
      <div class="kpi"><b style="color:var(--c)">${T.carbs}</b><span class="muted">كارب جم</span></div>
      <div class="kpi"><b style="color:var(--f)">${T.fat}</b><span class="muted">دهون جم</span></div>
    </div>
    <div class="tip ${bc}">مؤشر كتلة الجسم: <b>${r(T.bmi, 1)}</b> (${bl}) — الوزن الصحي لطولك: ${T.idealMin} - ${T.idealMax} كجم</div>
    <div class="tip">💧 مياه: ${r(T.water / 1000, 1)} لتر/يوم • 🌾 ألياف: ${T.fiber} جم • 🍬 سكر مضاف أقل من ${T.sugar} جم</div>
    ${T.floorHit ? `<div class="tip warn">⚠️ العجز المطلوب كان هينزّلك تحت الحد الآمن، فثبّتنا السعرات على ${T.kcal}. الأفضل تختار نزول أهدى أو تزود نشاطك.</div>` : ""}
    ${eta}`;
}

// ===== الخبير: تحليل اليوم =====
function renderExpert() {
  const T = calcTargets(S.profile), t = totals(), dd = getDay();
  const out = [];
  const add = (cls, txt) => out.push(`<div class="tip ${cls}">${txt}</div>`);
  if (!T) add("warn", "ادخل بياناتك في صفحة «ملفي» علشان التحليل يبقى مخصوص ليك.");
  if (t.kcal === 0) add("", "لسه مسجلتش أكل النهارده. سجّل أول وجبة وأنا هحللها لك فوراً.");
  else if (T) {
    const pct = t.kcal / T.kcal, hour = new Date().getHours();
    if (pct > 1.1) add("bad", `تعديت هدفك بـ ${Math.round(t.kcal - T.kcal)} سعر. مش مشكلة يوم واحد — بكره قلل النشويات والزيوت شوية وخليك على بروتين وخضار.`);
    else if (pct >= 0.9) add("", `ممتاز 👌 أنت في نطاق هدفك (${Math.round(pct * 100)}%).`);
    else if (pct < 0.6 && hour >= 20 && day === today()) add("warn", `أكلت ${Math.round(pct * 100)}% بس من احتياجك. الحرمان الشديد بيبطّأ الحرق ويخسرك عضل — كُل وجبة خفيفة فيها بروتين.`);
    else add("", `فاضلك ${Math.round(T.kcal - t.kcal)} سعر النهارده.`);

    const pp = t.p / T.protein;
    if (pp < 0.7) add("warn", `البروتين قليل (${Math.round(t.p)} من ${T.protein} جم). البروتين بيحافظ على العضل ويشبّعك — زوّد فراخ، تونة، بيض، زبادي يوناني أو جبنة قريش.`);
    else if (pp >= 0.9) add("", `💪 البروتين ممتاز (${Math.round(t.p)} جم).`);

    if (t.kcal > 600 && t.fib < T.fiber * 0.5) add("warn", `الألياف قليلة (${Math.round(t.fib)} جم). زوّد خضار، فاكهة بقشرها، شوفان، عدس أو عيش أسمر — بتحسن الهضم والشبع والسكر في الدم.`);
    const fatPct = (t.f * 9) / t.kcal;
    if (t.kcal > 500 && fatPct > 0.4) add("warn", `${Math.round(fatPct * 100)}% من سعراتك من الدهون — أعلى من الطبيعي (20-35%). قلل الزيت والسمنة والمقليات.`);
    const water = dd.water * 250;
    if (water < T.water * 0.5 && day === today() && new Date().getHours() >= 15) add("warn", `شربت ${r(water / 1000, 2)} لتر بس. هدفك ${r(T.water / 1000, 1)} لتر — العطش ساعات بيتفهم غلط إنه جوع.`);
  }
  if (t.sugarItems.length) add("warn", `🍬 فيه سكريات: ${[...new Set(t.sugarItems)].join("، ")}. حاول تخليها بعد الأكل مش على معدة فاضية، ومش أكتر من مرة في اليوم.`);
  if (t.fried.length >= 2) add("warn", `🍟 فيه أكتر من صنف مقلي (${[...new Set(t.fried)].join("، ")}). جرب المشوي أو الإير فراير — هتوفر 100-200 سعر بسهولة.`);
  for (const [k, label] of Object.entries(MEALS)) {
    const m = dd.meals[k], kc = m.reduce((a, e) => a + e.kcal, 0), p = m.reduce((a, e) => a + e.p, 0);
    if (k !== "snacks" && kc > 250 && p < 15) add("", `${label}: البروتين فيها قليل (${Math.round(p)} جم). توزيع 20-40 جم بروتين على كل وجبة أفضل لبناء العضل والشبع.`);
  }
  $("analysis").innerHTML = out.join("");
  renderSuggest(T, t);
  if (!$("chat").children.length) {
    botSay("أهلاً! أنا خبير التغذية بتاعك 🥗\nاسألني عن التخسيس، البروتين، الصيام المتقطع، الأكل قبل التمرين... أو اكتب اسم أكلة وأقولك سعراتها.");
    const qs = ["كام سعر محتاج؟", "إزاي أخس بطني؟", "الصيام المتقطع", "وزني ثابت ليه؟", "آكل إيه قبل التمرين؟", "كام سعر في الكشري؟"];
    $("quickQ").innerHTML = qs.map(q => `<button class="chip" onclick="$('q').value=this.textContent;ask()">${q}</button>`).join("");
  }
}
function renderSuggest(T, t) {
  if (!T) { $("suggest").innerHTML = '<p class="muted">ادخل بياناتك الأول.</p>'; return; }
  const kLeft = T.kcal - t.kcal, pLeft = T.protein - t.p;
  if (kLeft < 80) { $("suggest").innerHTML = '<div class="tip">خلصت سعرات النهارده. لو جعت: خيار، خس، شاي/قهوة من غير سكر، أو مية.</div>'; return; }
  const fit = allFoods().map(f => ({ f, kc: f.kcal * f.portion / 100, pr: f.p * f.portion / 100, fib: (f.fib || 0) * f.portion / 100 }))
    .filter(x => x.kc <= kLeft && x.kc > 15 && !["حلويات", "مشروبات", "سناكس", "دهون"].includes(x.f.cat));
  let list, why;
  if (pLeft > 20) { list = fit.sort((a, b) => b.pr / b.kc - a.pr / a.kc); why = `محتاج ${Math.round(pLeft)} جم بروتين كمان`; }
  else if (t.fib < T.fiber * 0.6) { list = fit.sort((a, b) => b.fib / b.kc - a.fib / a.kc); why = "محتاج ألياف أكتر"; }
  else { list = fit.sort((a, b) => b.kc - a.kc).filter(x => x.kc <= kLeft * 0.8); why = "اختيارات متوازنة"; }
  $("suggest").innerHTML = `<p class="muted" style="margin-bottom:6px">فاضلك ${Math.round(kLeft)} سعر — ${why}:</p>` +
    list.slice(0, 5).map(x => `<div class="result" onclick="go('add');pick('${x.f.id}')">
      <div><b>${x.f.name}</b><div class="muted">${x.f.portionName} • بروتين ${r(x.pr, 1)} جم</div></div><b>${Math.round(x.kc)} سعر</b></div>`).join("");
}

// ===== الخبير: قاعدة المعرفة =====
const KB = [
  { k: ["كام سعر", "احتياجي", "محتاج كام", "سعراتي", "احسب"], a: () => {
    const T = calcTargets(S.profile);
    if (!T) return "ادخل بياناتك في «ملفي» وهحسبلك بدقة بمعادلة Mifflin-St Jeor (الأدق علمياً).";
    return `احتياجك اليومي:\n• الحرق الكلي ≈ ${T.tdee} سعر\n• هدفك: ${T.kcal} سعر\n• بروتين ${T.protein} جم • كارب ${T.carbs} جم • دهون ${T.fat} جم\n• مياه ${r(T.water / 1000, 1)} لتر • ألياف ${T.fiber} جم`;
  } },
  { k: ["تخسيس", "اخس", "انزل وزن", "رجيم", "دايت", "تنحيف", "نزول"], a: () => `أساس التخسيس = عجز في السعرات (300-750 سعر يومياً) مع الحفاظ على العضل:\n1. التزم بهدف السعرات اللي في التطبيق.\n2. بروتين عالي (1.6-2.2 جم/كجم) — بيشبّع ويحمي العضل.\n3. تمارين مقاومة 3 مرات أسبوعياً.\n4. نوم 7-8 ساعات.\n5. قلل السكر والمشروبات المحلاة والمقليات.\n6. وزن نفسك الصبح وتابع المتوسط الأسبوعي، مش يوم بيوم.\nالمعدل الصحي: 0.5-1% من وزنك أسبوعياً.` },
  { k: ["عضل", "تضخيم", "زياده وزن", "بالك", "اتخن", "زيادة وزن"], a: () => `لبناء العضل:\n• فائض بسيط 200-300 سعر (أكتر من كده = دهون).\n• بروتين 1.6-2.2 جم/كجم موزع على 4 وجبات (20-40 جم كل وجبة).\n• تمرين مقاومة مع زيادة الأوزان تدريجياً (Progressive Overload).\n• كارب كويس حوالين التمرين للطاقة.\n• الكرياتين مونوهيدرات 3-5 جم يومياً من أكتر المكملات المثبتة علمياً.\nالزيادة المثالية: 0.25-0.5 كجم أسبوعياً.` },
  { k: ["بروتين"], a: () => {
    const T = calcTargets(S.profile);
    return `${T ? `احتياجك: ${T.protein} جم يومياً.\n` : ""}أفضل مصادر البروتين (لكل 100 سعر تقريباً):\n• صدر فراخ، تونة بالماء، جمبري، بياض بيض، سمك بلطي — الأعلى بروتين وأقل سعرات.\n• جبنة قريش وزبادي يوناني — ممتازين للسناكس.\n• عدس وفول وحمص — نباتي ومعاه ألياف.\nوزّعه على اليوم أفضل من إنك تاكله كله في وجبة واحدة.`;
  } },
  { k: ["كارب", "نشويات", "عيش", "رز", "ارز", "مكرونه"], a: () => `النشويات مش عدو! هي مصدر الطاقة الأساسي.\n• اختار المعقدة: شوفان، عيش بلدي/أسمر، رز بني، بطاطا، بقوليات.\n• قلل البسيطة: سكر، عيش أبيض فينو، حلويات، مشروبات غازية.\n• كُلها مع بروتين وخضار علشان تقلل ارتفاع السكر في الدم.\n• أحسن وقت ليها حوالين التمرين.\nالمهم مجموع السعرات، مش إنك تقطع النشويات.` },
  { k: ["دهون", "زيت", "سمنه", "زبده"], a: () => `الدهون ضرورية للهرمونات وامتصاص فيتامينات A,D,E,K — خليها 20-35% من سعراتك.\n• صحية: زيت زيتون، مكسرات، أفوكادو، سمك دهني (سلمون، سردين).\n• قللها: سمنة وزبدة ودهون اللحوم.\n• ابعد عن: الدهون المتحولة (المقليات المتكررة، السمن الصناعي).\n⚠️ معلقة زيت واحدة = 120 سعر، فقيس الزيت في الطبخ.` },
  { k: ["مياه", "ميه", "ماء", "اشرب"], a: () => {
    const T = calcTargets(S.profile);
    return `${T ? `احتياجك ≈ ${r(T.water / 1000, 1)} لتر يومياً` : "المعدل ≈ 35 مل لكل كجم من وزنك"} وزود في الحر والتمرين.\n• اشرب كوبين قبل الأكل بنص ساعة — بيقلل الكمية اللي بتاكلها.\n• لون البول الفاتح = ترطيب كويس.\n• الشاي والقهوة بيحسبوا جزئياً، بس المية الأفضل.`;
  } },
  { k: ["صيام", "متقطع", "16"], a: () => `الصيام المتقطع (زي 16:8) هو طريقة لتنظيم المواعيد، مش سحر:\n• الدراسات بتقول نتايجه في التخسيس زي تقليل السعرات العادي بالظبط.\n• مفيد لو بيسهّل عليك تلتزم بسعراتك.\n• خلي البروتين عالي في فترة الأكل.\n⚠️ مش مناسب لمرضى السكر على علاج، الحوامل، أو اللي عندهم تاريخ مع اضطرابات الأكل إلا باستشارة طبيب.` },
  { k: ["سكر", "سكري", "حلويات", "حلو"], a: () => `• منظمة الصحة العالمية: السكر المضاف أقل من 10% من السعرات (ويفضّل 5%).\n• كانز المشروب الغازي فيه ≈ 35 جم سكر = 9 معالق!\n• لو نفسك في حاجة حلوة: كُلها بعد الأكل، أو اختار فاكهة/تمر/شيكولاتة داكنة.\n⚠️ لو عندك سكري: تابع مع طبيبك، ووزع النشويات على الوجبات وركز على الألياف.` },
  { k: ["ثابت", "ثبات", "وقف", "مش بينزل", "مبينزلش"], a: () => `ثبات الوزن له أسباب:\n1. احتباس مياه (ملح، كارب، دورة شهرية، ضغط نفسي) — بيخفي نزول الدهون لأسابيع.\n2. السعرات زادت من غير ما تاخد بالك: الزيت، الصوصات، اللقمة هنا وهناك. سجّل كل حاجة بالوزن.\n3. وزنك قل فاحتياجك قل — حدّث وزنك في «ملفي».\n4. الحركة اليومية قلت (عدد الخطوات).\nالحل: التزم أسبوعين بدقة، زوّد المشي 2000-3000 خطوة، وقيس محيط الوسط مش الوزن بس.` },
  { k: ["عشا", "بالليل", "متاخر", "قبل النوم"], a: () => `الأكل بالليل مش بيتخن لوحده — اللي بيفرق إجمالي السعرات في اليوم.\nبس الأفضل:\n• عشا خفيف قبل النوم بساعتين-تلاتة.\n• اختار بروتين: زبادي، جبنة قريش، بيض، تونة + خضار.\n• ابعد عن الأكل التقيل والسكريات علشان النوم والارتجاع.` },
  { k: ["فطار", "الصبح"], a: () => `فطار متوازن = بروتين + نشويات معقدة + ألياف:\n• فول بزيت قليل + بيضة + عيش بلدي + خيار وطماطم.\n• شوفان باللبن + موز + معلقة زبدة فول سوداني.\n• زبادي يوناني + فاكهة + مكسرات.\n• بيض أومليت بالخضار + توست أسمر.\nالفطار مش إجباري — لو مش جعان الصبح عادي، المهم إجمالي اليوم.` },
  { k: ["تمرين", "جيم", "رياضه", "قبل التمرين", "بعد التمرين"], a: () => `• قبل التمرين (1-2 ساعة): كارب + بروتين خفيف — موزة وزبادي، أو توست وبيض، أو شوفان.\n• بعد التمرين (خلال ساعتين): بروتين 25-40 جم + كارب — فراخ ورز، تونة وعيش، أو سكوب واي وموزة.\n• اشرب مية قبل وأثناء وبعد.\nالأهم من التوقيت: إجمالي البروتين والسعرات في اليوم.` },
  { k: ["الياف", "امساك", "هضم", "انتفاخ"], a: () => `الألياف: 25-38 جم يومياً.\nمصادرها: خضار، فاكهة بقشرها (جوافة، تفاح)، شوفان، عدس، فول، حمص، عيش أسمر، لب ومكسرات.\n• زودها تدريجياً مع مية كتير علشان تتجنب الانتفاخ.\n• بتحسن الشبع والكوليسترول والسكر في الدم.` },
  { k: ["فيتامين", "مكملات", "حديد", "انيميا", "كالسيوم"], a: () => `أكتر نواقص منتشرة في مصر:\n• فيتامين D: شمس 15-20 دقيقة + سمك دهني وبيض. اعمل تحليل قبل المكملات.\n• الحديد: كبدة، لحمة، عدس، سبانخ — وكُلهم مع فيتامين C (ليمون/برتقال)، وابعد الشاي عن الأكل بساعة.\n• الكالسيوم: لبن، زبادي، جبن، سردين.\n• B12: للنباتيين لازم مكمل.\nالمكملات المفيدة فعلاً بعد التحليل: D، B12، حديد، وأوميجا 3 لو مش بتاكل سمك.` },
  { k: ["نوم", "سهر"], a: () => `قلة النوم (أقل من 6 ساعات):\n• بتزود هرمون الجوع (جريلين) وتقلل الشبع (ليبتين).\n• بتزود الرغبة في السكريات.\n• بتخسرك عضل أكتر وانت بتخس.\nهدفك 7-9 ساعات، وابعد عن الكافيين بعد العصر.` },
  { k: ["كيتو", "لو كارب"], a: () => `الكيتو = كارب أقل من 50 جم يومياً.\n• بينزل الوزن بسرعة في الأول (أغلبه مية).\n• على المدى الطويل نتايجه زي أي نظام فيه نفس السعرات.\n• صعب الالتزام بيه، وممكن يرفع الكوليسترول عند ناس.\n⚠️ مش مناسب لمرضى الكلى أو السكري على أنسولين من غير إشراف طبي.` },
  { k: ["بطن", "بطني", "كرش", "دهون البطن", "وسط"], a: () => `مفيش حاجة اسمها "تخسيس موضعي" — تمارين البطن لوحدها مش بتحرق دهون البطن.\nاللي بيشتغل فعلاً:\n1. عجز سعرات منتظم.\n2. بروتين عالي وألياف.\n3. تمارين مقاومة + مشي يومي.\n4. نوم كويس وتقليل التوتر (الكورتيزول).\n5. تقليل السكر والمشروبات المحلاة.\nقيس محيط وسطك: الصحي أقل من 94 سم للرجال و80 سم للستات.` },
  { k: ["ملح", "ضغط", "صوديوم"], a: () => `• الملح: أقل من 5 جم يومياً (معلقة صغيرة) شاملة اللي في الأكل الجاهز.\n• أكتر مصادر الملح: الجبن المملحة، المخللات، اللانشون، الشيبسي، الشوربة الجاهزة.\n• البوتاسيوم بيساعد في الضغط: موز، بطاطس، خضار ورقية، طماطم.\n⚠️ لو عندك ضغط عالي تابع مع دكتورك.` },
  { k: ["حامل", "حمل", "رضاعه"], a: () => `⚠️ الحمل والرضاعة محتاجين متابعة طبية.\nبشكل عام:\n• الحمل: +340 سعر في التلت التاني و+450 في التالت.\n• الرضاعة: +450-500 سعر.\n• حمض الفوليك والحديد والكالسيوم مهمين جداً.\nمتعمليش رجيم قاسي في الفترة دي.` },
  { k: ["برا", "مطعم", "فاست فود", "وجبات سريعه", "جاهز"], a: () => `لو هتاكل برا:\n• اختار مشوي بدل مقلي (كفتة/فراخ مشوية بدل بانيه).\n• اطلب السلطة والطحينة على جنب.\n• بدل البطاطس المحمرة بسلطة.\n• ابعد عن المشروب الغازي — خده دايت أو مية.\n• كُل البروتين والسلطة الأول.` },
  { k: ["فاكهه", "فواكه"], a: () => `الفاكهة صحية ومليانة ألياف وفيتامينات — 2-3 حصص يومياً.\n• أقلها سعرات: بطيخ، فراولة، برتقال، تفاح.\n• أعلاها: مانجا، عنب، موز، والبلح (تمرة = 28 سعر).\n• كُلها كاملة بدل العصير — العصير بيفقد الألياف وبيرفع السكر بسرعة.` },
  { k: ["قهوه", "شاي", "كافيين", "نسكافيه"], a: () => `• القهوة والشاي السادة تقريباً صفر سعرات.\n• كل معلقة سكر = 20 سعر. 4 أكواب بمعلقتين = 160 سعر يومياً = حوالي 2 كجم في السنة!\n• حد الكافيين الآمن: 400 مجم يومياً (≈ 4 فناجين قهوة).\n• ابعد الشاي عن الأكل بساعة علشان امتصاص الحديد.` },
  { k: ["كوليسترول", "دهون ثلاثيه"], a: () => `لتحسين الكوليسترول:\n• قلل الدهون المشبعة (سمنة، زبدة، دهن اللحمة، جبن كاملة الدسم).\n• زود الألياف الذائبة: شوفان، بقوليات، تفاح.\n• سمك دهني مرتين أسبوعياً.\n• زيت زيتون ومكسرات باعتدال.\n• الرياضة ونزول الوزن بيفرقوا كتير.\nالدهون الثلاثية بتتحسن جداً بتقليل السكر والنشويات البيضاء.` },
  { k: ["جوع", "جعان", "شبع", "شهيه"], a: () => `علشان تفضل شبعان وانت بتخس:\n1. بروتين في كل وجبة (أكتر حاجة بتشبّع).\n2. خضار كتير — حجم كبير وسعرات قليلة.\n3. مية قبل الأكل.\n4. كُل ببطء (20 دقيقة علشان المخ يحس بالشبع).\n5. نوم كفاية.\n6. قلل المشروبات المحلاة — سعراتها مش بتشبّع.` }
];
function foodAnswer(q) {
  const nq = norm(q);
  const hit = allFoods().filter(f => nq.includes(norm(f.name).split(" ")[0]) && norm(f.name).split(" ")[0].length > 2)
    .sort((a, b) => (nq.includes(norm(b.name)) - nq.includes(norm(a.name))) || b.name.length - a.name.length).slice(0, 3);
  if (!hit.length) return null;
  return hit.map(f => {
    const k = f.portion / 100;
    return `🍽️ ${f.name} — ${f.portionName} (${f.portion} جم):\n${Math.round(f.kcal * k)} سعر • بروتين ${r(f.p * k, 1)} • كارب ${r(f.c * k, 1)} • دهون ${r(f.f * k, 1)} جم\n(لكل 100 جم: ${f.kcal} سعر)`;
  }).join("\n\n");
}
function answer(q) {
  const nq = norm(q);
  let best = null, score = 0;
  for (const item of KB) {
    const s = item.k.reduce((a, k) => a + (nq.includes(norm(k)) ? norm(k).length : 0), 0);
    if (s > score) { score = s; best = item; }
  }
  const isFoodQ = /كام سعر (في|فى)|سعرات (ال)?|قيمه/.test(nq) && !/محتاج|احتياج/.test(nq);
  const fa = foodAnswer(q);
  if (fa && (isFoodQ || !best)) return fa;
  if (best) return best.a();
  return "مش متأكد إني فهمت السؤال 🤔\nجرب تسأل عن: التخسيس، العضل، البروتين، النشويات، الصيام المتقطع، ثبات الوزن، المياه، الفيتامينات… أو اكتب اسم أكلة.";
}
function botSay(t) { const d = document.createElement("div"); d.className = "msg bot"; d.textContent = t; $("chat").appendChild(d); $("chat").scrollTop = 1e6; }
function ask() {
  const q = $("q").value.trim(); if (!q) return;
  const d = document.createElement("div"); d.className = "msg me"; d.textContent = q; $("chat").appendChild(d);
  $("q").value = ""; setTimeout(() => botSay(answer(q)), 250);
}
$("q").addEventListener("keydown", e => { if (e.key === "Enter") ask(); });

// ===== التقدم =====
function renderStats() {
  const T = calcTargets(S.profile), goal = T ? T.kcal : 2000;
  const days = [];
  for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push(today(d)); }
  const vals = days.map(d => S.days[d] ? totals(d).kcal : 0);
  const max = Math.max(goal * 1.2, ...vals);
  $("week").innerHTML = days.map((d, i) => `<div class="col"><b style="color:var(--text)">${Math.round(vals[i]) || ""}</b>
    <span class="${vals[i] > goal * 1.1 ? "over" : ""}" style="height:${vals[i] / max * 100}%"></span>
    ${new Date(d + "T12:00:00").toLocaleDateString("ar-EG", { weekday: "short" })}</div>`).join("");
  const ws = [...S.weights].sort((a, b) => b.date.localeCompare(a.date));
  $("wList").innerHTML = ws.slice(0, 10).map((w, i) => {
    const prev = ws[i + 1], diff = prev ? r(w.w - prev.w, 1) : null;
    return `<div class="meal-item"><span>${w.date}</span><span><b>${w.w}</b> كجم ${diff !== null ? `<span class="muted">(${diff > 0 ? "+" : ""}${diff})</span>` : ""}</span></div>`;
  }).join("") || '<p class="muted">سجّل وزنك مرة في الأسبوع على الأقل، الصبح قبل الأكل.</p>';
}
function logWeight() {
  const w = parseFloat($("wIn").value);
  if (!(w >= 30 && w <= 300)) return toast("ادخل وزن صحيح");
  S.weights = S.weights.filter(x => x.date !== today()); S.weights.push({ date: today(), w });
  if (S.profile) S.profile.weight = w;   // تحديث الاحتياج تلقائياً
  save(); $("wIn").value = ""; renderStats(); fillProfile(); toast("✅ اتسجل الوزن وتحدّث احتياجك");
}
function exportData() {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(S)], { type: "application/json" }));
  a.download = `nutrition-backup-${today()}.json`; a.click();
}
function importData(e) {
  const f = e.target.files[0]; if (!f) return;
  f.text().then(t => { const d = JSON.parse(t); if (!d.days) throw 0; S = { ...load(), ...d }; save(); fillProfile(); renderHome(); toast("✅ اتستوردت البيانات"); })
    .catch(() => toast("الملف مش صالح"));
}

// ===== PWA =====
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
let deferredPrompt;
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferredPrompt = e; $("installBtn").style.display = "inline-block"; });
$("installBtn").onclick = async () => { if (!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; $("installBtn").style.display = "none"; };

// ===== البداية =====
fillProfile(); if (S.profile) renderProfileResults();
renderCats(); renderHome();
if (!S.profile) go("profile");
