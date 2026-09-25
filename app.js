const storageKey = "wxyy-2-thin-section-index";
const state = loadState();

const form = document.querySelector("#sampleForm");
const photoInput = document.querySelector("#photoInput");
const sampleGrid = document.querySelector("#sampleGrid");
const comparePane = document.querySelector("#comparePane");
const mineralFilter = document.querySelector("#mineralFilter");
const polarFilter = document.querySelector("#polarFilter");
const notice = document.querySelector("#notice");
const importInput = document.querySelector("#importInput");

let pendingPhoto = "";

function loadState() {
  let parsed = {};
  try {
    parsed = JSON.parse(localStorage.getItem(storageKey) || "{}");
  } catch {
    parsed = {};
  }
  const samples = Array.isArray(parsed.samples) ? parsed.samples.map(normalizeSample).filter(Boolean) : [];
  const compare = Array.isArray(parsed.compare)
    ? parsed.compare.filter((id) => samples.some((sample) => sample.id === id))
    : [];
  return { samples, compare };
}

// 同时兼容新版整包导出（英文字段）和旧版观察清单（中文字段）两种结构
function normalizeSample(raw) {
  if (!raw || typeof raw !== "object") return null;
  const code = String(raw.code ?? raw.样本编号 ?? "").trim();
  if (!code) return null;
  return {
    id: raw.id || crypto.randomUUID(),
    photo: raw.photo || "",
    code,
    location: String(raw.location ?? raw.采样地点 ?? "").trim(),
    magnification: String(raw.magnification ?? raw.放大倍数 ?? "").trim(),
    polarization: raw.polarization || raw.偏光类型 || "单偏光",
    minerals: String(raw.minerals ?? raw.主要矿物 ?? "").trim(),
    texture: String(raw.texture ?? raw.颗粒结构 ?? "").trim(),
    comment: String(raw.comment ?? raw.老师批注 ?? "").trim(),
    createdAt: raw.createdAt || new Date().toISOString()
  };
}

function save() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function showNotice(message, tone = "info") {
  notice.textContent = message;
  notice.dataset.tone = tone;
  notice.hidden = false;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve) => {
    if (!file) return resolve("");
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.readAsDataURL(file);
  });
}

function mineralTerms() {
  return mineralFilter.value.split(/[、,，;；\s]+/).map((term) => term.trim()).filter(Boolean);
}

function filteredSamples() {
  const terms = mineralTerms();
  const polarization = polarFilter.value;
  return state.samples.filter((sample) => {
    const minerals = sample.minerals || "";
    const mineralMatch = terms.every((term) => minerals.includes(term));
    const polarMatch = !polarization || sample.polarization === polarization;
    return mineralMatch && polarMatch;
  });
}

function render() {
  const rows = filteredSamples();
  if (rows.length) {
    sampleGrid.innerHTML = rows.map((sample) => `
      <article class="sample-card">
        ${sample.photo ? `<img src="${sample.photo}" alt="${sample.code}显微照片">` : "<div class=\"photo-placeholder\"></div>"}
        <div class="sample-body">
          <h3>${sample.code}</h3>
          <p>${sample.location || "未记录地点"} · ${sample.magnification || "未记录倍数"} · ${sample.polarization}</p>
          <p>矿物：${sample.minerals || "未记录"}</p>
          <p>结构：${sample.texture || "未记录"}</p>
          <p>${sample.comment || "未填写批注"}</p>
          <div class="card-actions">
            <label><input type="checkbox" data-compare="${sample.id}" ${state.compare.includes(sample.id) ? "checked" : ""}>对比</label>
            <button type="button" data-delete="${sample.id}">删除</button>
          </div>
        </div>
      </article>
    `).join("");
  } else if (state.samples.length) {
    const terms = mineralTerms();
    const target = terms.length ? `同时包含「${terms.join("、")}」的样本` : "符合当前筛选的样本";
    sampleGrid.innerHTML = `<p class="empty-hint">没有找到${target}，试试减少矿物名或更换偏光类型。</p>`;
  } else {
    sampleGrid.innerHTML = "<p class=\"empty-hint\">还没有样本，先从左侧录入一张薄片照片，或点击右上角「导入样本库」。</p>";
  }

  renderCompare();
}

function renderCompare() {
  const compareSamples = state.compare
    .map((id) => state.samples.find((sample) => sample.id === id))
    .filter(Boolean)
    .slice(0, 2);

  if (!compareSamples.length) {
    comparePane.innerHTML = "<p>勾选两张样本卡片后可并排对比。</p>";
    return;
  }

  const cards = compareSamples.map((sample) => `
    <article class="compare-item">
      ${sample.photo ? `<img src="${sample.photo}" alt="${sample.code}对比图">` : ""}
      <h3>${sample.code}</h3>
      <p>${sample.polarization} · ${sample.minerals || "未记录矿物"}</p>
      <p>结构：${sample.texture || "未记录"}</p>
      <p>老师批注：${sample.comment || "未填写"}</p>
    </article>
  `);

  if (compareSamples.length === 1) {
    cards.push(`
      <article class="compare-item compare-placeholder">
        <p>已移走另一张样本，这张继续保留。</p>
        <p>请在样本区再勾选一张，恢复并排对比。</p>
      </article>
    `);
  }

  comparePane.innerHTML = cards.join("");
}

photoInput.addEventListener("change", async () => {
  pendingPhoto = await readFileAsDataUrl(photoInput.files[0]);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const code = data.get("code").trim();
  if (state.samples.some((sample) => sample.code === code)) {
    showNotice(`编号 ${code} 已存在，请核对后再保存，避免换班续录重复。`, "error");
    return;
  }
  if (!pendingPhoto && photoInput.files[0]) {
    pendingPhoto = await readFileAsDataUrl(photoInput.files[0]);
  }
  state.samples.unshift({
    id: crypto.randomUUID(),
    photo: pendingPhoto,
    code,
    location: data.get("location").trim(),
    magnification: data.get("magnification").trim(),
    polarization: data.get("polarization"),
    minerals: data.get("minerals").trim(),
    texture: data.get("texture").trim(),
    comment: data.get("comment").trim(),
    createdAt: new Date().toISOString()
  });
  pendingPhoto = "";
  photoInput.value = "";
  form.reset();
  save();
  render();
  showNotice(`已保存样本 ${code}。`);
});

sampleGrid.addEventListener("click", (event) => {
  const deleteId = event.target.dataset.delete;
  if (deleteId) {
    state.samples = state.samples.filter((sample) => sample.id !== deleteId);
    state.compare = state.compare.filter((id) => id !== deleteId);
    save();
    render();
  }
});

sampleGrid.addEventListener("change", (event) => {
  const id = event.target.dataset.compare;
  if (!id) return;
  if (event.target.checked) {
    state.compare = [id, ...state.compare.filter((item) => item !== id)].slice(0, 2);
  } else {
    state.compare = state.compare.filter((item) => item !== id);
  }
  save();
  render();
});

[mineralFilter, polarFilter].forEach((field) => field.addEventListener("input", render));

document.querySelector("#exportBtn").addEventListener("click", () => {
  if (!state.samples.length) {
    showNotice("样本库为空，没有可导出的内容。", "error");
    return;
  }
  const bundle = {
    app: "thin-section-index",
    version: 2,
    exportedAt: new Date().toISOString(),
    samples: state.samples
  };
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `thin-section-library-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  showNotice(`已导出 ${state.samples.length} 条样本（含照片），文件可拷到另一台电脑导入。`);
});

document.querySelector("#importBtn").addEventListener("click", () => importInput.click());

importInput.addEventListener("change", async () => {
  const file = importInput.files[0];
  importInput.value = "";
  if (!file) return;

  let parsed;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    showNotice("导入失败：文件不是有效的 JSON，请使用「导出样本库」生成的文件。", "error");
    return;
  }

  const list = Array.isArray(parsed) ? parsed : parsed && Array.isArray(parsed.samples) ? parsed.samples : null;
  if (!list) {
    showNotice("导入失败：文件里找不到样本列表，请检查是否选错文件。", "error");
    return;
  }

  const knownCodes = new Set(state.samples.map((sample) => sample.code));
  const imported = [];
  let duplicated = 0;
  let invalid = 0;
  let legacy = 0;

  for (const raw of list) {
    const sample = normalizeSample(raw);
    if (!sample) {
      invalid += 1;
      continue;
    }
    if (knownCodes.has(sample.code)) {
      duplicated += 1;
      continue;
    }
    knownCodes.add(sample.code);
    if (raw.code === undefined && raw.样本编号 !== undefined) legacy += 1;
    imported.push(sample);
  }

  if (!imported.length && !duplicated && !invalid) {
    showNotice("导入失败：文件中没有样本记录。", "error");
    return;
  }

  state.samples = [...imported, ...state.samples];
  save();
  render();

  const parts = [`新增 ${imported.length} 条`];
  if (duplicated) parts.push(`跳过重复编号 ${duplicated} 条`);
  if (invalid) parts.push(`${invalid} 条缺少编号无法识别`);
  if (legacy) parts.push(`其中 ${legacy} 条旧版记录已按新结构带入`);
  showNotice(`导入完成：${parts.join("，")}。`);
});

render();
