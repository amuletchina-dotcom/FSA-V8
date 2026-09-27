
const $ = id => document.getElementById(id);
let latest = {outer:null, inner:null};
let selected = "outer";
let evidenceMode = "nfl";
let plotMeta = {};

function options(arr, suffix=" mm") {
  return arr.map(v => `<option value="${v}">${v}${suffix}</option>`).join("");
}

function liteFields(p) {
  return `
    <div class="grid2">
      <label>Construction
        <select id="${p}kind">
          <option value="mono">Monolithic</option>
          <option value="lam">Laminated PVB</option>
        </select>
      </label>
      <label id="${p}monoTypeBox">Glass type
        <select id="${p}type">
          <option value="AN">AN — Annealed</option>
          <option value="HS">HS — Heat Strengthened</option>
          <option value="FT" selected>FT — Fully Tempered</option>
        </select>
      </label>
      <label id="${p}monoBox">Nominal thickness
        <select id="${p}th">${options([2,2.5,2.7,3,4,5,6,8,10,12,16,19,22,25])}</select>
      </label>
    </div>

    <div id="${p}lamBox" class="hidden">
      <div class="grid3 lamPlyGrid">
        <label>Ply 1 thickness
          <select id="${p}p1">${options([2.5,3,4,5,6,8,10,12])}</select>
        </label>
        <label>Ply 1 type
          <select id="${p}p1type">
            <option value="AN">AN</option>
            <option value="HS">HS</option>
            <option value="FT" selected>FT</option>
          </select>
        </label>
        <label>PVB
          <select id="${p}pvb">${options([.38,.76,1.14,1.52,2.28])}</select>
        </label>
        <label>Ply 2 thickness
          <select id="${p}p2">${options([2.5,3,4,5,6,8,10,12])}</select>
        </label>
        <label>Ply 2 type
          <select id="${p}p2type">
            <option value="AN">AN</option>
            <option value="HS">HS</option>
            <option value="FT" selected>FT</option>
          </select>
        </label>
      </div>
      <div class="derived">ASTM designation: <b id="${p}des">—</b></div>

      <label class="gtfClassBox">ASTM GTF Classification
        <select id="${p}gtfClass">
          <option value="auto">Auto — weakest ply governs</option>
          <option value="AN">AN</option>
          <option value="HS">HS</option>
          <option value="FT">FT</option>
        </select>
      </label>

      <div id="${p}typeNote" class="typeNote"></div>
    </div>`;
}

async function init() {
  $("outerFields").innerHTML = liteFields("o");
  $("innerFields").innerHTML = liteFields("i");

  for (const p of ["o","i"]) {
    $(`${p}th`).value = 6;
    $(`${p}p1`).value = 6;
    $(`${p}p2`).value = 6;
    $(`${p}pvb`).value = .76;
    $(`${p}type`).value = "FT";
    $(`${p}p1type`).value = "FT";
    $(`${p}p2type`).value = "FT";
    $(`${p}gtfClass`).value = "auto";

    [`${p}kind`,`${p}type`,`${p}th`,`${p}p1`,`${p}p1type`,`${p}p2`,`${p}p2type`,`${p}pvb`,`${p}gtfClass`]
      .forEach(id => $(id).addEventListener("change", () => {
        liteUI(p);
        if (!$("results").classList.contains("hidden")) calculateAll();
      }));
    liteUI(p);
  }

  ["assembly","support","duration"].forEach(id => $(id).addEventListener("change", () => {
    if (id === "assembly") assemblyUI();
    if (id === "support") supportUI();
    if (!$("results").classList.contains("hidden")) calculateAll();
  }));

  ["supportedEdges","oneSupportedEdge","width","height"].forEach(id => $(id).addEventListener("change", () => {
    if (!$("results").classList.contains("hidden")) calculateAll();
  }));

  $("calc").addEventListener("click", calculateAll);
  $("showOuter").addEventListener("click", () => selectLite("outer"));
  $("showInner").addEventListener("click", () => selectLite("inner"));
  $("evNFL").addEventListener("click", () => setEvidence("nfl"));
  $("evGTF").addEventListener("click", () => setEvidence("gtf"));
  $("evLSF").addEventListener("click", () => setEvidence("lsf"));

  $("example1").addEventListener("click", () => {
    $("assembly").value = "single";
    $("duration").value = "short";
    $("width").value = 1200;
    $("height").value = 1500;
    $("support").value = "4";
    $("ikind").value = "mono";
    $("itype").value = "AN";
    $("ith").value = 6;
    assemblyUI(); supportUI(); liteUI("i");
    calculateAll(); selectLite("inner");
  });

  $("example2").addEventListener("click", () => {
    $("assembly").value = "igu";
    $("duration").value = "short";
    $("width").value = 2000;
    $("height").value = 2800;
    $("support").value = "4";
    for (const p of ["o","i"]) {
      $(`${p}kind`).value = "mono";
      $(`${p}type`).value = "FT";
      $(`${p}p1type`).value = "FT";
      $(`${p}p2type`).value = "FT";
      $(`${p}th`).value = 6;
      liteUI(p);
    }
    assemblyUI(); supportUI();
    calculateAll(); selectLite("outer");
  });

  try {
    plotMeta = await fetch("plot-meta.json").then(r => r.json());
  } catch (e) {
    console.warn("plot-meta.json not loaded", e);
  }

  DPTWind.init();
  assemblyUI();
  supportUI();
}

function lamDesignationDetail(p) {
  const p1 = Number($(`${p}p1`).value);
  const p2 = Number($(`${p}p2`).value);
  const pvb = Number($(`${p}pvb`).value);
  const t1 = ASTM.min[p1] || p1;
  const t2 = ASTM.min[p2] || p2;
  const interlayer = Math.min(pvb, 1.52);
  const total = t1 + interlayer + t2;
  return {p1,p2,pvb,t1,t2,interlayer,total};
}

function liteUI(p) {
  const lam = $(`${p}kind`).value === "lam";
  $(`${p}monoBox`).classList.toggle("hidden", lam);
  $(`${p}monoTypeBox`).classList.toggle("hidden", lam);
  $(`${p}lamBox`).classList.toggle("hidden", !lam);

  if (lam) {
    const d = NFLEngine.lamDesignation($(`${p}p1`).value,$(`${p}pvb`).value,$(`${p}p2`).value);
    const info = lamDesignationDetail(p);
    $(`${p}des`).textContent = d ? `${d} mm` : "Not covered";

    const calcId = `${p}desCalc`;
    let calc = $(calcId);
    if (!calc) {
      calc = document.createElement("div");
      calc.id = calcId;
      calc.className = "designationCalc";
      $(`${p}des`).parentElement.appendChild(calc);
    }
    calc.innerHTML =
      `<span>ASTM minimum-thickness calculation:</span><br>` +
      `${info.p1} mm nominal → <b>${info.t1.toFixed(2)} mm min</b>` +
      ` &nbsp;+&nbsp; PVB <b>${info.interlayer.toFixed(2)} mm</b>` +
      ` &nbsp;+&nbsp; ${info.p2} mm nominal → <b>${info.t2.toFixed(2)} mm min</b>` +
      `<br>Total used for designation = <b>${info.total.toFixed(2)} mm</b>`;

    const t1 = $(`${p}p1type`).value;
    const t2 = $(`${p}p2type`).value;
    const cls = $(`${p}gtfClass`).value;
    const note = $(`${p}typeNote`);

    const rank = {AN:0, HS:1, FT:2};
    const weakest = rank[t1] <= rank[t2] ? t1 : t2;

    if (cls !== "auto") {
      note.innerHTML =
        `<b>User-selected ASTM GTF classification: ${cls}</b>. ` +
        `Actual laminated plies are ${t1} + PVB + ${t2}. ` +
        `The software will use ${cls} as the lite category for ASTM Table 1 / 2 / 3 GTF lookup.`;
      note.classList.toggle("warnType", cls !== weakest);
    } else if (t1 === t2) {
      note.innerHTML =
        `Auto ASTM GTF classification: <b>${t1}</b> (${t1} + PVB + ${t2}).`;
      note.classList.remove("warnType");
    } else {
      note.innerHTML =
        `<b>Auto conservative mixed-ply classification: ${weakest}</b>. ` +
        `Actual laminated plies are ${t1} + PVB + ${t2}. ` +
        `The software applies a project conservative rule: weakest ply governs for GTF classification. ` +
        `This is not an explicit ASTM E1300-16 mixed-ply rule.`;
      note.classList.add("warnType");
    }
  }
}

function supportUI() {
  const s = $("support").value;
  $("edgeBox").classList.toggle("hidden", s !== "2");
  $("oneEdgeBox").classList.toggle("hidden", s !== "1");
}

function assemblyUI() {
  const single = $("assembly").value === "single";
  $("outerCard").classList.toggle("hidden", single);
  $("showOuter").classList.toggle("hidden", single);
  $("evLSF").disabled = single;
  if (single) selected = "inner";
}

function liteInput(p) {
  const kind = $(`${p}kind`).value;
  const designation = kind === "mono"
    ? Number($(`${p}th`).value)
    : NFLEngine.lamDesignation($(`${p}p1`).value,$(`${p}pvb`).value,$(`${p}p2`).value);

  const p1type = $(`${p}p1type`).value;
  const p2type = $(`${p}p2type`).value;
  const monoType = $(`${p}type`).value;
  const gtfClass = kind === "lam" ? $(`${p}gtfClass`).value : monoType;

  let effectiveType = monoType;
  let gtfClassSource = "monolithic";

  if (kind === "lam") {
    if (gtfClass !== "auto") {
      effectiveType = gtfClass;
      gtfClassSource = "user";
    } else {
      const rank = {AN:0, HS:1, FT:2};
      effectiveType = rank[p1type] <= rank[p2type] ? p1type : p2type;
      gtfClassSource = (p1type === p2type) ? "auto" : "auto-weakest";
    }
  }

  return {
    kind,
    designation,
    type:effectiveType,
    monoType,
    p1type,
    p2type,
    gtfClass,
    gtfClassSource,
    mixedPlyTypes:kind === "lam" && p1type !== p2type,
    thickness:Number($(`${p}th`).value),
    p1:Number($(`${p}p1`).value),
    p2:Number($(`${p}p2`).value),
    pvb:Number($(`${p}pvb`).value)
  };
}

function calculateOne(p, name) {
  const x = liteInput(p);
  const r = NFLEngine.calculate({
    kind:x.kind,
    support:$("support").value,
    designation:x.designation,
    width:Number($("width").value),
    height:Number($("height").value),
    supportedEdges:$("supportedEdges").value,
    oneSupportedEdge:$("oneSupportedEdge").value
  });

  r.name = name;
  r.input = x;
  r.type = x.type;
  r.desc = x.kind === "mono"
    ? `${x.designation} mm ${x.monoType} monolithic`
    : `${x.p1} mm ${x.p1type} + ${x.pvb} PVB + ${x.p2} mm ${x.p2type} · ASTM designation ${x.designation} mm`;
  return r;
}

function addFactors() {
  const duration = $("duration").value;
  const single = $("assembly").value === "single";

  if (single) {
    if (latest.inner.type) {
      latest.inner.gtf = ASTMFactors.gtfSingle(latest.inner.type,duration);
      latest.inner.gtfTable = 1;
      latest.inner.gtfReview = false;
    } else {
      latest.inner.gtf = null;
      latest.inner.gtfTable = 1;
      latest.inner.gtfReview = true;
    }
    latest.inner.lsf = null;
    return;
  }

  const canAutoGTF = !!latest.outer.type && !!latest.inner.type;
  if (canAutoGTF) {
    const g = ASTMFactors.gtfIGU(latest.outer.type,latest.inner.type,duration);
    latest.outer.gtf = g.gtf1;
    latest.inner.gtf = g.gtf2;
    latest.outer.gtfTable = latest.inner.gtfTable = g.table;
    latest.outer.gtfReview = latest.inner.gtfReview = false;
  } else {
    latest.outer.gtf = latest.inner.gtf = null;
    latest.outer.gtfTable = latest.inner.gtfTable = (duration === "long" ? 3 : 2);
    latest.outer.gtfReview = latest.inner.gtfReview = true;
  }

  const ls = ASTMFactors.lsfIGU(latest.outer.input,latest.inner.input,duration);
  latest.outer.lsf = ls.lsf1;
  latest.inner.lsf = ls.lsf2;
  latest.outer.lsfInfo = latest.inner.lsfInfo = ls;
}

function resultKPI(r) {
  if (r.ok) return r.nfl.toFixed(2) + " kPa";
  if (r.outsideRange) return r.direction==="below" ? `< ${r.qmin.toFixed(2)} kPa` : `> ${r.qmax.toFixed(2)} kPa`;
  if (r.chartUnsupported) return "NOT COVERED";
  if (r.outsideDimension) return "OUTSIDE RANGE";
  return "MANUAL";
}

function calculateAll() {
  latest.inner = calculateOne("i","Inner");
  latest.outer = $("assembly").value === "single" ? null : calculateOne("o","Outer");
  addFactors();

  const arr = [latest.outer,latest.inner].filter(Boolean);
  const iguInvalid = $("assembly").value === "igu" && $("support").value !== "4";

  $("resultCards").innerHTML = arr.map(r => `
    <div class="resultCard" data-name="${r.name.toLowerCase()}">
      <b>${r.name} Lite</b>
      <div class="metrics">
        <div><span>NFL</span><strong>${resultKPI(r)}</strong></div>
        <div><span>GTF</span><strong>${r.gtfReview ? "REVIEW" : Number(r.gtf).toFixed(2)}</strong></div>
        <div><span>LSF</span><strong>${r.lsf == null ? "N/A" : r.lsf.toFixed(3)}</strong></div>
      </div>
      <div class="row"><span>Glass</span><b>${r.desc}</b></div>
      ${r.input.kind === "lam" ? `<div class="row"><span>ASTM GTF classification</span><b>${
        `${r.type} (${
          r.input.gtfClassSource === "user" ? "user selected" :
          r.input.gtfClassSource === "auto-weakest" ? "auto · weakest ply" :
          "auto"
        })`
      }</b></div>` : ""}
      <div class="row"><span>NFL source</span><b>Fig. A1.${r.figure}</b></div>
      <div class="row"><span>GTF source</span><b>${r.gtfReview ? `ASTM Table ${r.gtfTable} — mixed ply type not explicitly assigned` : `ASTM Table ${r.gtfTable}`}</b></div>
      <div class="row"><span>LSF source</span><b>${r.lsf == null ? "Single lite — N/A" : r.lsfInfo.source}</b></div>
      <div class="row"><span>Long × Short</span><b>${Math.round(r.geom.long)} × ${Math.round(r.geom.short)} mm</b></div>
      <div class="row"><span>AR</span><b>${r.geom.ar.toFixed(2)}</b></div>
      ${(r.twoSide || r.oneEdge) ? `<div class="row"><span>Unsupported edge</span><b>${Math.round(r.unsupported)} mm</b></div>` : ""}
      ${r.oneEdge ? `<div class="row"><span>Supported edge</span><b>${({left:"Left",right:"Right",top:"Top",bottom:"Bottom"})[r.oneSupportedEdge]}</b></div>` : ""}
      ${iguInvalid ? `<div class="warn">ASTM IGU basic procedure: four-side continuous support required. NFL shown per individual lite chart; IGU use is outside the basic procedure.</div>` : ""}
    </div>`).join("");

  $("results").classList.remove("hidden");
  $("viewer").classList.remove("hidden");
  if ($("assembly").value === "single") selected = "inner";
  showEvidence();
}

function selectLite(v) {
  selected = v;
  showEvidence();
}

function setEvidence(mode) {
  if (mode === "lsf" && $("assembly").value === "single") return;
  evidenceMode = mode;
  ["NFL","GTF","LSF"].forEach(x => $(`ev${x}`).classList.toggle("evidenceActive", mode === x.toLowerCase()));
  showEvidence();
}

function showEvidence() {
  const r = latest[selected];
  if (!r) return;

  document.querySelectorAll(".resultCard").forEach(x =>
    x.classList.toggle("active",x.dataset.name === selected));

  if (evidenceMode === "nfl") showNFL(r);
  else if (evidenceMode === "gtf") showGTF(r);
  else showLSF(r);
}

function showNFL(r) {
  $("nflEvidence").classList.remove("hidden");
  $("tableEvidence").classList.add("hidden");
  $("chartSubtitle").textContent = `${r.name} · ${r.desc} · ASTM Fig. A1.${r.figure}`;

  const img = $("chartImg");
  img.onload = () => drawOverlay(r,img);
  img.src = `A1_${String(r.figure).padStart(2,"0")}.png`;

  if (r.chartUnsupported) {
    $("chartNote").innerHTML = `<b>NOT COVERED BY ASTM FIG. A1.${r.figure}</b>. ${r.designation} mm does not have a line on this chart.`;
  } else if (r.outsideDimension) {
    $("chartNote").innerHTML = `<b>OUTSIDE ASTM FIG. A1.${r.figure} DIMENSION RANGE</b>. Unsupported-edge length = ${Math.round(r.unsupported)} mm.`;
  } else if (r.outsideRange) {
    const limitText = r.direction === "below" ? `NFL < ${r.qmin.toFixed(2)} kPa` : `NFL > ${r.qmax.toFixed(2)} kPa`;
    $("chartNote").innerHTML = `<b>${limitText}</b>. The selected ASTM line is highlighted, but the intersection lies outside the printed chart range.`;
  } else if (!r.ok) {
    $("chartNote").innerHTML = `<b>${r.error}</b> Original ASTM figure shown for manual review.`;
  } else {
    $("chartNote").innerHTML = `<b>NFL = ${r.nfl.toFixed(2)} kPa</b>. Green = selected ASTM line/contour; blue = geometry guide; red = selected result point.`;
  }
}

function showGTF(r) {
  $("nflEvidence").classList.add("hidden");
  $("tableEvidence").classList.remove("hidden");
  const duration = $("duration").value;
  const single = $("assembly").value === "single";
  $("chartSubtitle").textContent = `${r.name} · GTF evidence · ASTM Table ${r.gtfTable}`;

  if (single) {
    const rows = ["AN","HS","FT"].map(t => `
      <tr class="${t===r.type ? "hlrow":""}">
        <td>${t}</td>
        <td class="${t===r.type && duration==="short" ? "hlcell":""}">${ASTMFactors.singleGTF.short[t]}</td>
        <td class="${t===r.type && duration==="long" ? "hlcell":""}">${ASTMFactors.singleGTF.long[t]}</td>
      </tr>`).join("");
    $("tableEvidence").innerHTML = `
      <div class="tableTitle">ASTM Table 1 — Glass Type Factors for Single Monolithic / Laminated Lite</div>
      <table class="astmTable"><thead><tr><th>Glass type</th><th>Short 3 s</th><th>Long 30 days</th></tr></thead><tbody>${rows}</tbody></table>`;

    if (r.gtfReview) {
      $("chartNote").innerHTML =
        `<b>GTF = REVIEW</b>. Classification is unavailable.`;
    } else {
      let clsNote = "";
      if (r.input.kind === "lam" && r.input.gtfClassSource === "user") {
        clsNote = ` User-selected laminated-lite ASTM GTF classification = ${r.type}.`;
      } else if (r.input.kind === "lam" && r.input.gtfClassSource === "auto-weakest") {
        clsNote = ` Auto conservative classification = ${r.type} because the weakest ply governs. This is a project rule, not an explicit ASTM E1300-16 mixed-ply rule.`;
      }
      $("chartNote").innerHTML = `<b>GTF = ${r.gtf.toFixed(2)}</b>. Highlighted cell = ${r.type}, ${duration==="short" ? "Short Duration" : "Long Duration"}.${clsNote}`;
    }
    return;
  }

  const types = ["AN","HS","FT"];
  const data = ASTMFactors.gtfTableData(duration);
  const canHighlight = !latest.outer.gtfReview && !latest.inner.gtfReview;
  const rows = types.map(t1 => `
    <tr>
      <th>${t1}</th>
      ${types.map(t2 => {
        const v=data[t1][t2];
        const hit=canHighlight && t1===latest.outer.type && t2===latest.inner.type;
        return `<td class="${hit?"hlcell":""}">${v[0].toFixed(2)} / ${v[1].toFixed(2)}</td>`;
      }).join("")}
    </tr>`).join("");

  $("tableEvidence").innerHTML = `
    <div class="tableTitle">ASTM Table ${r.gtfTable} — Double IGU GTF (${duration==="short" ? "Short Duration" : "Long Duration"})</div>
    <div class="axisNote">Rows = Outer / Lite 1 type; Columns = Inner / Lite 2 type. Cell = GTF1 / GTF2.</div>
    <table class="astmTable"><thead><tr><th>Lite 1 \\ Lite 2</th>${types.map(t=>`<th>${t}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table>`;

  if (!canHighlight) {
    const mixed = [latest.outer,latest.inner]
      .filter(x => x.input.mixedPlyTypes)
      .map(x => `${x.name}: ${x.input.p1type} + PVB + ${x.input.p2type}`)
      .join("; ");
    $("chartNote").innerHTML =
      `<b>GTF = REVIEW</b>. ${mixed}. ASTM E1300-16 Tables 2–3 classify each lite as AN / HS / FT, but the supplied standard does not explicitly define the table category for a laminated lite with mixed ply heat treatments. No GTF has been guessed.`;
  } else {
    const notes = [latest.outer, latest.inner]
      .filter(x => x.input.kind === "lam")
      .map(x => {
        if (x.input.gtfClassSource === "user") return `${x.name}=${x.type} (user selected)`;
        if (x.input.gtfClassSource === "auto-weakest") return `${x.name}=${x.type} (auto weakest-ply rule)`;
        return "";
      })
      .filter(Boolean)
      .join("; ");
    $("chartNote").innerHTML =
      `<b>${latest.outer.type} / ${latest.inner.type}</b> highlighted → ` +
      `Outer GTF = <b>${latest.outer.gtf.toFixed(2)}</b>, Inner GTF = <b>${latest.inner.gtf.toFixed(2)}</b>.` +
      (notes ? ` ${notes}.` : "");
  }
}

function showLSF(r) {
  $("nflEvidence").classList.add("hidden");
  $("tableEvidence").classList.remove("hidden");

  if ($("assembly").value === "single") {
    $("tableEvidence").innerHTML = `<div class="notice">LSF is not applicable to a single lite.</div>`;
    $("chartNote").innerHTML = `<b>LSF = N/A</b> for single glazing because there is no IGU load sharing.`;
    return;
  }

  const ls = r.lsfInfo;
  $("chartSubtitle").textContent = `IGU · LSF evidence · ${ls.source}`;

  $("tableEvidence").innerHTML = `
    <div class="tableTitle">${ls.source}</div>
    <table class="astmTable">
      <thead><tr><th></th><th>Outer / Lite 1</th><th>Inner / Lite 2</th></tr></thead>
      <tbody>
        <tr><th>Construction</th><td>${latest.outer.desc}</td><td>${latest.inner.desc}</td></tr>
        <tr><th>Stiffness basis</th><td class="${selected==="outer"?"hlcell":""}">${ls.s1.basis}</td><td class="${selected==="inner"?"hlcell":""}">${ls.s2.basis}</td></tr>
        <tr><th>LSF</th><td class="${selected==="outer"?"hlcell":""}">${ls.lsf1.toFixed(3)}</td><td class="${selected==="inner"?"hlcell":""}">${ls.lsf2.toFixed(3)}</td></tr>
      </tbody>
    </table>
    <div class="formulaBox">
      LSF₁ = K₁ / (K₁ + K₂) &nbsp;&nbsp; | &nbsp;&nbsp; LSF₂ = K₂ / (K₁ + K₂)<br>
      <span>${ls.s1.detail}</span><br><span>${ls.s2.detail}</span>
    </div>`;

  $("chartNote").innerHTML =
    `<b>Outer LSF = ${ls.lsf1.toFixed(3)}</b> · <b>Inner LSF = ${ls.lsf2.toFixed(3)}</b>. ` +
    `Highlighted column = ${r.name} lite.`;
}

function drawOverlay(r, img) {
  const c = $("overlay");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;

  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, c.width, c.height);

  if (!r.ok && !r.outsideRange && !r.outsideDimension) return;

  if (r.oneEdge) {
    // Fig. A1.28 / A1.44 are log-log charts: x = load (kPa),
    // y = unsupported-edge length (mm), selected thickness line q = C/L^2.
    const isMono = r.figure === 28;
    const b = isMono ? [81,656,61,464] : [99,655,70,460];
    const qmin = isMono ? 0.25 : 0.20;
    const qmax = 10.0;
    const Lmin = isMono ? 260 : 200;
    const Lmax = 3000;
    const [x0,x1,y0,y1] = b;

    const X = q => x0 +
      (Math.log10(q)-Math.log10(qmin)) /
      (Math.log10(qmax)-Math.log10(qmin)) * (x1-x0);

    const Y = L => y1 -
      (Math.log10(L)-Math.log10(Lmin)) /
      (Math.log10(Lmax)-Math.log10(Lmin)) * (y1-y0);

    // Green: selected ASTM thickness/designation line.
    ctx.save();
    ctx.strokeStyle = "#067647";
    ctx.lineWidth = 7;
    ctx.shadowColor = "rgba(6,118,71,.25)";
    ctx.shadowBlur = 5;
    ctx.beginPath();
    let started = false;

    for (let L=Lmin; L<=Lmax; L*=1.008) {
      const q = r.C / Math.pow(L,2);
      if (q >= qmin && q <= qmax) {
        if (!started) {
          ctx.moveTo(X(q),Y(L));
          started = true;
        } else {
          ctx.lineTo(X(q),Y(L));
        }
      }
    }
    if (started) ctx.stroke();
    ctx.restore();

    // If unsupported length itself is outside printed y-range, do not fake a point.
    if (r.outsideDimension) return;

    // If load intersection lies outside printed x-range, show only the dimension guide.
    if (r.outsideRange) {
      ctx.save();
      ctx.strokeStyle = "#175cd3";
      ctx.lineWidth = 3;
      ctx.setLineDash([10,7]);
      ctx.beginPath();
      ctx.moveTo(x0,Y(r.unsupported));
      ctx.lineTo(x1,Y(r.unsupported));
      ctx.stroke();
      ctx.restore();

      const label = r.direction === "below"
        ? `< ${r.qmin.toFixed(2)} kPa`
        : `> ${r.qmax.toFixed(2)} kPa`;

      ctx.font = "bold 22px system-ui";
      const tw = ctx.measureText(label).width;
      const xx = 12;
      const yy = Math.max(32,Y(r.unsupported)-12);

      ctx.fillStyle = "rgba(255,255,255,.95)";
      ctx.fillRect(xx-7,yy-23,tw+14,31);
      ctx.strokeStyle = "#d92d20";
      ctx.lineWidth = 2;
      ctx.strokeRect(xx-7,yy-23,tw+14,31);
      ctx.fillStyle = "#d92d20";
      ctx.fillText(label,xx,yy);
      return;
    }

    // Blue guides to intersection.
    ctx.save();
    ctx.strokeStyle = "#175cd3";
    ctx.lineWidth = 3;
    ctx.setLineDash([10,7]);
    ctx.beginPath();
    ctx.moveTo(x0,Y(r.unsupported));
    ctx.lineTo(X(r.raw),Y(r.unsupported));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(X(r.raw),y1);
    ctx.lineTo(X(r.raw),Y(r.unsupported));
    ctx.stroke();
    ctx.restore();

    // Red intersection.
    ctx.beginPath();
    ctx.arc(X(r.raw),Y(r.unsupported),10,0,Math.PI*2);
    ctx.fillStyle = "#d92d20";
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#fff";
    ctx.stroke();

    const label = `${r.nfl.toFixed(2)} kPa`;
    ctx.font = "bold 22px system-ui";
    const tw = ctx.measureText(label).width;
    const xx = Math.min(c.width-tw-24,X(r.raw)+12);
    const yy = Math.max(30,Y(r.unsupported)-12);

    ctx.fillStyle = "rgba(255,255,255,.95)";
    ctx.fillRect(xx-7,yy-23,tw+14,31);
    ctx.strokeStyle = "#d92d20";
    ctx.lineWidth = 2;
    ctx.strokeRect(xx-7,yy-23,tw+14,31);
    ctx.fillStyle = "#d92d20";
    ctx.fillText(label,xx,yy);
    return;
  }

  if (r.twoSide) {
    const b = r.figure === 27 ? [78,654,61,463] : [87,657,69,469];
    const qmin = r.figure === 27 ? .25 : .20;
    const qmax = r.figure === 27 ? 10 : 8;
    const Lmin = r.figure === 27 ? 260 : 200;
    const Lmax = r.figure === 27 ? 3500 : 3000;

    const [x0,x1,y0,y1] = b;

    const X = q => x0 +
      (Math.log10(q)-Math.log10(qmin)) /
      (Math.log10(qmax)-Math.log10(qmin)) * (x1-x0);

    const Y = L => y1 -
      (Math.log10(L)-Math.log10(Lmin)) /
      (Math.log10(Lmax)-Math.log10(Lmin)) * (y1-y0);

    // Green: selected thickness line
    ctx.save();
    ctx.strokeStyle = "#067647";
    ctx.lineWidth = 7;
    ctx.shadowColor = "rgba(6,118,71,.25)";
    ctx.shadowBlur = 5;
    ctx.beginPath();

    let started = false;
    for (let L=Lmin; L<=Lmax; L*=1.01) {
      const q = r.C / Math.pow(L,4);
      if (q >= qmin && q <= qmax) {
        if (!started) {
          ctx.moveTo(X(q),Y(L));
          started = true;
        } else {
          ctx.lineTo(X(q),Y(L));
        }
      }
    }
    if (started) ctx.stroke();
    ctx.restore();

    // For an out-of-range point, keep the selected thickness line highlighted,
    // but do not draw a fake ASTM intersection beyond the printed chart.
    if (r.outsideRange) {
      ctx.save();
      ctx.strokeStyle = "#175cd3";
      ctx.lineWidth = 3;
      ctx.setLineDash([10,7]);
      ctx.beginPath();
      ctx.moveTo(x0, Y(r.unsupported));
      ctx.lineTo(x1, Y(r.unsupported));
      ctx.stroke();
      ctx.restore();

      const label = r.direction === "below"
        ? `< ${r.qmin.toFixed(2)} kPa`
        : `> ${r.qmax.toFixed(2)} kPa`;

      ctx.font = "bold 22px system-ui";
      const tw = ctx.measureText(label).width;
      const xx = 12;
      const yy = Math.max(32, Y(r.unsupported) - 12);

      ctx.fillStyle = "rgba(255,255,255,.95)";
      ctx.fillRect(xx-7,yy-23,tw+14,31);
      ctx.strokeStyle = "#d92d20";
      ctx.lineWidth = 2;
      ctx.strokeRect(xx-7,yy-23,tw+14,31);
      ctx.fillStyle = "#d92d20";
      ctx.fillText(label,xx,yy);
      return;
    }

    // Blue guides
    ctx.save();
    ctx.strokeStyle = "#175cd3";
    ctx.lineWidth = 3;
    ctx.setLineDash([10,7]);

    ctx.beginPath();
    ctx.moveTo(x0,Y(r.unsupported));
    ctx.lineTo(X(r.raw),Y(r.unsupported));
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(X(r.raw),y1);
    ctx.lineTo(X(r.raw),Y(r.unsupported));
    ctx.stroke();
    ctx.restore();

    // Red intersection
    ctx.beginPath();
    ctx.arc(X(r.raw),Y(r.unsupported),10,0,Math.PI*2);
    ctx.fillStyle = "#d92d20";
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#fff";
    ctx.stroke();

    // Label
    const label = `${r.nfl.toFixed(2)} kPa`;
    ctx.font = "bold 22px system-ui";
    const tw = ctx.measureText(label).width;

    const xx = Math.min(c.width - tw - 24, X(r.raw) + 12);
    const yy = Math.max(30, Y(r.unsupported) - 12);

    ctx.fillStyle = "rgba(255,255,255,.95)";
    ctx.fillRect(xx-7,yy-23,tw+14,31);
    ctx.strokeStyle = "#d92d20";
    ctx.lineWidth = 2;
    ctx.strokeRect(xx-7,yy-23,tw+14,31);
    ctx.fillStyle = "#d92d20";
    ctx.fillText(label,xx,yy);
    return;
  }

  const meta = plotMeta[`A1.${r.figure}`];
  if (!meta || !meta.bounds || !meta.xmax || !meta.ymax) return;

  const [x0,x1,y0,y1] = meta.bounds;
  const W=x1-x0, H=y1-y0;
  const sx=x=>x0+x/meta.xmax*W;
  const sy=y=>y1-y/meta.ymax*H;

  const long=r.geom.long, short=r.geom.short;

  ctx.save();
  ctx.strokeStyle="#175cd3";
  ctx.lineWidth=4;
  ctx.setLineDash([12,8]);
  ctx.beginPath();
  const maxx=Math.min(meta.xmax,r.geom.ar*meta.ymax);
  ctx.moveTo(sx(0),sy(0));
  ctx.lineTo(sx(maxx),sy(maxx/r.geom.ar));
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle="#067647";
  ctx.lineWidth=6;
  ctx.beginPath();
  let started=false;

  for(let x=Math.max(50,meta.xmax*.015);x<=meta.xmax;x+=meta.xmax/260){
    const y=NFLEngine.contourY(r.kind,r.designation,r.nfl,x);
    if(isFinite(y)&&y>=0&&y<=meta.ymax&&y<=x){
      if(!started){ctx.moveTo(sx(x),sy(y));started=true}
      else ctx.lineTo(sx(x),sy(y));
    }
  }

  if(started)ctx.stroke();
  ctx.restore();

  ctx.beginPath();
  ctx.arc(sx(long),sy(short),10,0,Math.PI*2);
  ctx.fillStyle="#d92d20";
  ctx.fill();
  ctx.lineWidth=4;
  ctx.strokeStyle="#fff";
  ctx.stroke();
}


init();
