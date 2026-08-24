// Cloudflare Pages Function: POST /api/submit-rfq
//
// Receives the Request-a-Quote form and writes a new record into the
// company CRM (Vika datasheet dstJTyJEv2LfkFJF7M). The Vika API token is
// read from an environment secret (VIKA_API_TOKEN) configured in the
// Cloudflare Pages project settings — it is never present in this repo or
// shipped to the browser. Until that secret is configured and this project
// is actually deployed to Cloudflare Pages, this endpoint does not exist
// anywhere and the form will show a "something went wrong" error — that is
// expected for a local file:// preview.

const DATASHEET_ID = "dstJTyJEv2LfkFJF7M";
const GENERAL_MANAGER = { id: "1363681079320715265", name: "General Manager" };

// request-quote.html's <select> lists every country in the world (A–Z), but
// the Vika "国家名称" field only has ~180 legacy options and does NOT
// auto-create new ones for SingleSelect fields — an unmatched value would
// make the whole record write fail. So: map every dropdown name that DOES
// have a real match to that option's exact existing text (a few of Vika's
// own entries are inconsistently cased/spaced, e.g. " Austria", "kenya" —
// kept as-is on purpose since that's the literal existing option); anything
// not in this map falls back to being recorded as free text in notes
// instead of failing the whole submission. Hong Kong, Macau and Taiwan are
// shown to visitors with a "(China)" suffix per company policy, mapped to
// the exact (inconsistently formatted, but real) options added in Vika's
// UI — "HongKong(China)", "Macao（China）" (full-width parens), "Taiwan(China)".
// Mainland China intentionally stays mapped to the existing plain "China".
const COUNTRY_TO_VIKA_VALUE = {
  "Albania": "Albania", "Algeria": "Algeria", "Angola": "Angola",
  "Argentina": "Argentina", "Armenia": "Armenia", "Australia": "Australia",
  "Austria": " Austria", "Azerbaijan": "Azerbaijan", "Bahrain": "Bahrain",
  "Bangladesh": "Bangladesh", "Belarus": "Belarus", "Belgium": "Belgium",
  "Bolivia": "Bolivia", "Botswana": "Botswana", "Brazil": "Brazil",
  "Bulgaria": "Bulgaria", "Cambodia": "Cambodia", "Cameroon": "Cameroon",
  "Canada": "Canada", "Chile": "Chile", "China": "China",
  "Colombia": "Colombia", "Costa Rica": "Costa Rica", "Croatia": "Croatia",
  "Cuba": "Cuba", "Cyprus": "Cyprus", "Czech Republic": "Czech Republic",
  "Denmark": "Denmark", "Dominica": "Dominica",
  "Dominican Republic": "Dominican Republic", "Ecuador": "Ecuador",
  "Egypt": "Egypt", "El Salvador": "El Salvador", "Estonia": "Estonia",
  "Ethiopia": "Ethiopia", "Fiji": "Fiji", "France": "France",
  "Georgia": "Georgia", "Germany": "Germany", "Ghana": "Ghana",
  "Greece": "Greece", "Guatemala": "Guatemala", "Guinea": "Guinea",
  "Guyana": "Guyana", "Haiti": "Haiti", "Honduras": "Honduras",
  "Hong Kong (China)": "HongKong(China)", "Hungary": "Hungary", "India": "India",
  "Indonesia": "Indonesia", "Iraq": "Iraq", "Ireland": "Ireland",
  "Israel": "Israel", "Italy": "Italy", "Jamaica": "Jamaica",
  "Japan": "Japan", "Jordan": "Jordan", "Kazakhstan": "Kazakhstan",
  "Kenya": "kenya", "Kuwait": "Kuwait", "Lebanon": "Lebanon",
  "Libya": "Libya", "Lithuania": "Lithuania", "Malaysia": "Malaysia",
  "Maldives": "Maldives", "Mali": "Mali", "Mauritius": "Mauritius",
  "Macau (China)": "Macao（China）",
  "Mexico": "Mexico", "Morocco": "Morocco", "Mozambique": "Mozambique",
  "Myanmar": "Myanmar", "Nepal": "Nepal", "Netherlands": "Netherlands",
  "New Zealand": "New Zealand", "Nicaragua": "Nicaragua",
  "Nigeria": "Nigeria", "Norway": "Norway", "Pakistan": "Pakistan",
  "Panama": "Panama", "Paraguay": "Paraguay", "Peru": "Peru",
  "Philippines": "Philippines", "Poland": "Poland", "Portugal": "Portugal",
  "Puerto Rico": "Puerto Rico", "Qatar": "Qatar", "Romania": "Romania",
  "Russia": "Russia", "Saudi Arabia": "Saudi Arabia", "Senegal": "Senegal",
  "Sierra Leone": "Sierra Leone", "Singapore": "Singapore",
  "Slovakia": "Slovakia", "Slovenia": "Slovenia", "Somalia": "Somalia",
  "South Africa": "South Africa", "South Korea": "South Korea",
  "South Sudan": "South Sudan", "Spain": "Spain", "Sri Lanka": "Sri Lanka",
  "Sweden": "Sweden", "Switzerland": "Switzerland",
  "Taiwan (China)": "Taiwan(China)", "Tanzania": "Tanzania", "Thailand": "Thailand",
  "Togo": "Togo", "Turkey": "Turkey", "UAE": "UAE", "Ukraine": "Ukraine",
  "United Kingdom": "United Kingdom", "United States": "United States",
  "Uruguay": "Uruguay", "Uzbekistan": "Uzbekistan", "Venezuela": "Venezuela",
  "Vietnam": "Vietnam", "Zambia": "Zambia", "Zimbabwe": "Zimbabwe"
};

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { "content-type": "application/json" }
  });
}

function digitsOnly(value) {
  return (value || "").replace(/[^\d]/g, "");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.VIKA_API_TOKEN) {
    return jsonResponse({ error: "CRM not configured" }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: "Invalid request body" }, 400);
  }

  const firstName = (body.firstName || "").trim();
  const lastName = (body.lastName || "").trim();
  const company = (body.company || "").trim();
  const email = (body.email || "").trim();
  const phone = (body.phone || "").trim();
  const country = (body.country || "").trim();
  const notes = (body.notes || "").trim();

  if (!firstName || !lastName || !company || !email || !notes) {
    return jsonResponse({ error: "Missing required fields" }, 400);
  }
  if (!EMAIL_RE.test(email)) {
    return jsonResponse({ error: "Invalid email" }, 400);
  }

  const submittedAt = new Date().toISOString().slice(0, 10);
  let otherInfoLines = [
    notes,
    "",
    `Source: website RFQ form, submitted ${submittedAt}`
  ];

  const fields = {
    "客户名字": firstName,
    "客户姓氏": lastName,
    "客户公司名称": company,
    "客户主邮箱": email,
    "客户管理归属": [GENERAL_MANAGER],
    "渠道来源": "公司官网询盘",
    "业务销售漏斗": "意向客户：表明了合作意向/兴趣"
  };

  if (phone) {
    const phoneDigits = digitsOnly(phone);
    if (phoneDigits) fields["客户的电话号码（无00/+号）"] = Number(phoneDigits);
    fields["客户手机号码（暂时文本，供查找信息）"] = phone;
  }

  if (country) {
    const vikaCountryValue = COUNTRY_TO_VIKA_VALUE[country];
    if (vikaCountryValue) {
      fields["国家名称"] = vikaCountryValue;
    } else {
      otherInfoLines.push(`Country (no matching CRM option yet, not written to 国家名称): ${country}`);
    }
  }

  fields["其他信息（比如客户在销产品数据分析）"] = otherInfoLines.join("\n");

  const vikaUrl = `https://api.vika.cn/fusion/v1/datasheets/${DATASHEET_ID}/records?fieldKey=name`;

  let vikaResp;
  try {
    vikaResp = await fetch(vikaUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.VIKA_API_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ records: [{ fields }] })
    });
  } catch (e) {
    return jsonResponse({ error: "CRM request failed" }, 502);
  }

  const vikaData = await vikaResp.json().catch(() => null);
  if (!vikaResp.ok || !vikaData || vikaData.success === false) {
    return jsonResponse({ error: "CRM rejected the record", detail: vikaData }, 502);
  }

  return jsonResponse({ ok: true });
}
