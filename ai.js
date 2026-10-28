// ===== خبير الذكاء الاصطناعي (Claude) =====
// المفتاح بيدخله المستخدم بنفسه ويتحفظ على جهازه بس — مفيش أي مفتاح جوه ملفات الموقع.
// مكتبة Anthropic بتتحمّل وقت الحاجة بس، فالبرنامج يفضل شغال من غير نت.
const SDK_URL = "https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.133.0/+esm";
const AI_SYSTEM = `أنت خبير تغذية علاجية ورياضية محترف داخل تطبيق "خبير التغذية".
- رد باللهجة المصرية، بإيجاز ووضوح (نقاط قصيرة)، إلا لو المستخدم طلب تفصيل.
- اعتمد على الأدلة العلمية الحديثة (WHO، الأكاديمية الأمريكية للتغذية، ISSN) وادي أرقام عملية بالجرام والسعرات.
- استخدم بيانات المستخدم اللي جاية مع كل سؤال (احتياجه، أكله النهارده، حرق الساعة) وخصّص ردك عليها.
- اقترح أكلات مصرية متاحة وبأسعار معقولة لما يكون مناسب.
- متشخّصش أمراض ومتوصفش أدوية. لو فيه سكر، ضغط، كلى، حمل، اضطرابات أكل، أو أعراض مقلقة: انصح بمتابعة دكتور.
- متقترحش أقل من 1200 سعر للستات أو 1500 للرجالة، ولا نزول أكتر من 1% من الوزن في الأسبوع.`;

let aiHistory = [];

function aiContext() {
  const p = S.profile, T = calcTargets(p), t = totals(), dd = getDay();
  if (!p) return "المستخدم لسه مدخلش بياناته.";
  const sex = p.sex === "m" ? "ذكر" : "أنثى";
  const items = Object.entries(dd.meals).flatMap(([m, list]) => list.map(e => `${MEALS[m]}: ${e.name} ${Math.round(e.grams)}جم (${Math.round(e.kcal)} سعر)`));
  return [
    `${sex}، ${p.age} سنة، ${p.height} سم، ${p.weight} كجم${p.targetW ? `، الوزن المستهدف ${p.targetW}` : ""}، الهدف: ${p.goal < 0 ? `نزول ${-p.goal} كجم/أسبوع` : p.goal > 0 ? `زيادة ${p.goal} كجم/أسبوع` : "ثبات"}.`,
    `الاحتياج: ${T.kcal} سعر، بروتين ${T.protein}، كارب ${T.carbs}، دهون ${T.fat} جم. الحرق ≈ ${T.tdee}${dd.active ? ` (منه ${dd.active} نشط من Apple Watch)` : ""}.`,
    `أكل اليوم (${day}): ${Math.round(t.kcal)} سعر، بروتين ${Math.round(t.p)}، كارب ${Math.round(t.c)}، دهون ${Math.round(t.f)}، ألياف ${Math.round(t.fib)} جم. مياه ${dd.water} كوب.`,
    items.length ? items.join(" | ") : "لسه مسجلش أكل النهارده."
  ].join("\n");
}

async function askAI(q, bubble) {
  let Anthropic;
  try { ({ default: Anthropic } = await import(SDK_URL)); }
  catch (e) { throw new Error("تعذّر تحميل الخبير الذكي. اتأكد من النت."); }
  const client = new Anthropic({ apiKey: S.settings.apiKey, dangerouslyAllowBrowser: true });
  const messages = [...aiHistory, { role: "user", content: `[بيانات المستخدم الحالية]\n${aiContext()}\n\n[السؤال]\n${q}` }];
  let text = "";
  try {
    const stream = client.beta.messages.stream({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      output_config: { effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: AI_SYSTEM,
      messages
    });
    for await (const ev of stream) {
      if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
        text += ev.delta.text; bubble.textContent = text; $("chat").scrollTop = 1e6;
      }
    }
    const msg = await stream.finalMessage();
    if (msg.stop_reason === "refusal") throw new Error("refusal");
    if (msg.stop_reason === "max_tokens") bubble.textContent = text + "\n…(الرد اتقطع)";
    // نحفظ السؤال من غير البيانات علشان المحادثة تفضل خفيفة
    aiHistory.push({ role: "user", content: q }, { role: "assistant", content: text });
    aiHistory = aiHistory.slice(-12);
  } catch (e) {
    let why = "حصلت مشكلة في الاتصال بالخبير الذكي.";
    if (e instanceof Anthropic.AuthenticationError) why = "مفتاح Claude API غلط أو اتلغى. راجعه في «ملفي».";
    else if (e instanceof Anthropic.PermissionDeniedError) why = "المفتاح ده مالوش صلاحية. راجع حسابك على console.anthropic.com.";
    else if (e instanceof Anthropic.RateLimitError) why = "طلبات كتير ورا بعض أو الرصيد خلص. استنى شوية أو اشحن رصيدك.";
    else if (e instanceof Anthropic.APIConnectionError) why = "مفيش اتصال بالنت.";
    else if (e.message === "refusal") why = "الخبير الذكي اعتذر عن السؤال ده.";
    console.error(e);
    throw new Error(why);
  }
}
